import { InsertDialogOpts } from "../components/insertDialog";
import { Table, app } from "../app";
import { pluralize } from "../utils/inflectors";
import { stringLiteral } from "../utils/sqlHelpers";
import * as yom from "../yom";
import { simpleColumnFromField } from "./datagridInternals/fromModel";
import {
  SimpleColumn,
  styledSimpleDatagrid,
  ToolbarConfig,
} from "./datagridInternals/styledSimpleDatagrid";
import { checkbox } from "../components/checkbox";
import { button } from "../components/button";
import {
  DomStatements,
  StateStatements,
  StateStatementsOrFn,
} from "../statements";
import {
  DgStateHelpers,
  FieldEditProcConfig,
  RowHeight,
} from "./datagridInternals/shared";
import { Node } from "../nodeTypes";
import { nodes } from "../nodeHelpers";

type FieldConfigs = Record<string, FieldConfig>;

export interface FieldConfig extends FieldEditProcConfig {
  immutable?: boolean;
  header?: string;
}

function toggleRowSelection(id: string) {
  return new DomStatements().if({
    condition: `exists (select id from ui.selected_row where id = ${id})`,
    then: (s) => s.modify(`delete from selected_row where id = ${id}`),
    else: (s) => s.modify(`insert into selected_row (id) values (${id})`),
  });
}

export class DatagridToolbarBuilder {
  #header?: Node;
  #delete = false;
  #export = false;
  #add?:
    | { type: "dialog"; opts?: Partial<InsertDialogOpts> }
    | { type: "href"; href: string };

  constructor(private table: Table) {}

  header(header: Node) {
    this.#header = header;
    return this;
  }

  insertDialog(opts?: Partial<InsertDialogOpts>) {
    this.#add = { type: "dialog", opts };
    return this;
  }

  insertPage(href: string) {
    this.#add = { type: "href", href };
    return this;
  }
  delete(del?: boolean) {
    this.#delete = del ?? true;
    return this;
  }

  export(exp?: boolean) {
    this.#export = exp ?? true;
    return this;
  }

  _finish(): ToolbarConfig {
    return {
      delete: this.#delete,
      export: this.#export,
      header: this.#header ?? stringLiteral(pluralize(this.table.displayName)),
      add: this.#add,
    };
  }
}

export class SimpleDatagridPageBuilder {
  #table: Table;
  #path?: string;
  #allow?: yom.SqlExpression;
  #viewButtonUrl?: (id: yom.SqlExpression) => yom.SqlExpression;
  #selectable?: boolean;
  #immutable?: boolean | yom.SqlExpression;
  #ignoreFields?: string[];
  #fieldOrder?: string[];
  #extraState?: StateStatementsOrFn;
  #extraColumns: SimpleColumn[] = [];
  #fields: FieldConfigs = {};
  #toolbarConfig?: ToolbarConfig;
  #pageSize?: number;
  #rowHeight?: RowHeight;

  constructor(table: string) {
    this.#table = app.db.tables[table];
    if (!this.#table) {
      throw new Error(`No table ${table} found`);
    }
  }

  rowHeight(rowHeight: RowHeight) {
    this.#rowHeight = rowHeight;
    return this;
  }

  allow(allow: yom.SqlExpression) {
    this.#allow = allow;
    return this;
  }

  fieldOrder(...fields: string[]) {
    this.#fieldOrder = fields;
    return this;
  }

  pageSize(pageSize: number) {
    this.#pageSize = pageSize;
    return this;
  }

  path(path: string) {
    this.#path = path;
    return this;
  }

  viewButton(getLink?: (id: yom.SqlExpression) => yom.SqlExpression) {
    if (!getLink) {
      if (!this.#table.getHrefToRecord) {
        throw new Error(
          "viewButton is true but table has no getHrefToRecord, on datagrid for table " +
            this.#table.name
        );
      }
      this.#viewButtonUrl = (id) => this.#table.getHrefToRecord!(id);
    } else {
      this.#viewButtonUrl = getLink;
    }
    return this;
  }

  selectable() {
    this.#selectable = true;
    return this;
  }

  immutable(immutable?: boolean | yom.SqlExpression) {
    this.#immutable = immutable ?? true;
    return this;
  }

  ignoreFields(...fields: string[]) {
    this.#ignoreFields = fields;
    return this;
  }

  fieldConfig(field: string, config: FieldConfig) {
    if (!this.#fields) {
      this.#fields = {};
    }
    this.#fields[field] = config;
    return this;
  }

  column(column: SimpleColumn) {
    this.#extraColumns.push(column);
    return this;
  }

  extraState(state: StateStatementsOrFn) {
    this.#extraState = state;
    return this;
  }

  toolbar(f: (t: DatagridToolbarBuilder) => DatagridToolbarBuilder) {
    this.#toolbarConfig = f(new DatagridToolbarBuilder(this.#table))._finish();
    return this;
  }

  #getColumns() {
    const columns: SimpleColumn[] = [];
    if (this.#selectable) {
      columns.push({
        width: 36,
        cell: () =>
          checkbox({
            variant: "outlined",
            size: "sm",
            checked: `selected_all or exists (select id from selected_row where id = dg_record.id)`,
            slots: { checkbox: { props: { tabIndex: "-1" } } },
          }),
        header: checkbox({
          variant: "outlined",
          size: "sm",
          checked: `selected_all`,
          slots: { checkbox: { props: { tabIndex: "-1" } } },
        }),
        cellClickHandler: (s) =>
          s
            .scalar(
              `row_id`,
              `(select id from ui.dg_table limit 1 offset cell.row - 1)`
            )
            .statements(toggleRowSelection(`row_id`)),
        headerClickHandler: (s) =>
          s
            .setScalar(`selected_all`, `not selected_all`)
            .modify(`delete from selected_row`),
        keydownCellHandler: (s) =>
          s
            .scalar(
              `row_id`,
              `(select id from ui.dg_table limit 1 offset cell.row - 1)`
            )
            .statements(toggleRowSelection(`cast(row_id as bigint)`)),
        keydownHeaderHandler: (s) =>
          s
            .setScalar(`selected_all`, `not selected_all`)
            .modify(`delete from selected_row`),
      });
    }
    if (this.#viewButtonUrl) {
      const viewButtonUrl = this.#viewButtonUrl;
      columns.push({
        width: 76,
        cell: () =>
          button({
            variant: "soft",
            color: "primary",
            size: "sm",
            children: `'View'`,
            href: viewButtonUrl(`dg_record.${this.#table.primaryKeyIdent}`),
            props: { tabIndex: "-1" },
          }),
        header: `'View'`,
      });
    }
    const idField = this.#table.primaryKeyIdent;
    const startFixedColumns = columns.length;
    const fields = this.#fieldOrder ?? [];
    for (const fieldName of Object.keys(this.#table.fields)) {
      if (
        this.#ignoreFields?.includes(fieldName) ||
        fields.includes(fieldName)
      ) {
        continue;
      }
      fields.push(fieldName);
    }
    for (const fieldName of fields) {
      const field = this.#table.fields[fieldName];
      const fieldConfig = this.#fields?.[field.name];
      const column = simpleColumnFromField({
        table: this.#table.name,
        field,
        idField,
        beforeEdit: fieldConfig?.beforeEdit,
        beforeEditTransaction: fieldConfig?.beforeEditTransaction,
        afterEdit: fieldConfig?.afterEdit,
        afterEditTransaction: fieldConfig?.afterEditTransaction,
        immutable: fieldConfig?.immutable ?? this.#immutable,
        columnIndex: columns.length,
      });
      if (column) {
        columns.push(column);
      }
    }
    // for (const virtual of Object.values(this.#table.virtualFields)) {
    //   columns.push(
    //     simpleColumnFromVirtual(
    //       this.#table.name,
    //       virtual,
    //       columns.length,
    //       startFixedColumns
    //     )
    //   );
    // }
    return columns;
  }

  _finish() {
    const extraState = new StateStatements();
    if (this.#selectable) {
      extraState.scalar(`selected_all`, `false`);
      extraState.table(`selected_row`, [
        { name: "id", type: { type: "BigInt" } },
      ]);
    }
    if (typeof this.#immutable === "string") {
    }
    extraState.statements(this.#extraState);
    const content = nodes.sourceMap(
      `simpleDatagridPage(${this.#table.name})`,
      styledSimpleDatagrid({
        columns: this.#getColumns(),
        allow: this.#allow,
        idField: this.#table.primaryKeyFieldName,
        pageSize: this.#pageSize,
        tableModel: this.#table,
        toolbar:
          this.#toolbarConfig ??
          new DatagridToolbarBuilder(this.#table)._finish(),
        extraState,
        rowHeight: this.#rowHeight,
      })
    );
    app.ui.pages.push({
      path: this.#path ?? this.#table.baseUrl,
      content,
    });
  }
}

export function simpleDatagridPage(
  table: string,
  f: (b: SimpleDatagridPageBuilder) => unknown
) {
  const builder = new SimpleDatagridPageBuilder(table);
  f(builder);
  builder._finish();
}
