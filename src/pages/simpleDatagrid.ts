import { InsertDialogOpts } from "../components/insertDialog";
import { HelperFieldType, Table, system, fieldTypeFromHelper } from "../system";
import { pluralize, upcaseFirst } from "../utils/inflectors";
import { stringLiteral } from "../utils/sqlHelpers";
import * as yom from "../yom";
import {
  simpleColumnFromField,
  simpleToggleColumnSort,
} from "./datagridInternals/fromModel";
import {
  SimpleColumn,
  styledSimpleDatagrid,
  ToolbarConfig,
} from "./datagridInternals/styledSimpleDatagrid";
import { checkbox } from "../components/checkbox";
import { button } from "../components/button";
import {
  BasicStatements,
  DomStatements,
  StateStatements,
  StateStatementsOrFn,
} from "../statements";
import {
  CellNode,
  DgStateHelpers,
  FieldEditProcConfig,
  RowHeight,
  dgState,
  resizeableSeperator,
} from "./datagridInternals/shared";
import { Node } from "../nodeTypes";
import { nodes } from "../nodeHelpers";
import { materialIcon } from "../components";
import { styles as sharedStyles } from "./datagridInternals/styles";

type FieldConfigs = Record<string, FieldConfig>;

export interface FieldConfig extends FieldEditProcConfig {
  canEdit?: boolean;
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
    | { type: "href"; href?: string };

  constructor(private table: Table) {}

  header(header: Node) {
    this.#header = header;
    return this;
  }

  insertDialog(opts?: Partial<InsertDialogOpts>) {
    this.#add = { type: "dialog", opts };
    return this;
  }

  insertPage(href?: string) {
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

  _finish(addHref: string): ToolbarConfig {
    return {
      delete: this.#delete,
      export: this.#export,
      header: this.#header ?? stringLiteral(pluralize(this.table.displayName)),
      add:
        this.#add?.type === "href"
          ? { type: "href", href: this.#add.href ?? addHref }
          : { type: "dialog", opts: this.#add?.opts },
    };
  }
}

export interface ExtraColumnOpts {
  columnIndex: number;
}

export class SimpleDatagridPageBuilder {
  #table: Table;
  #path?: string;
  #allow?: yom.SqlExpression;
  #viewButtonUrl?: (id: yom.SqlExpression) => yom.SqlExpression;
  #selectable?: boolean;
  #canEdit?: boolean | yom.SqlExpression;
  #ignoreFields?: string[];
  #fieldOrder?: string[];
  #extraState?: StateStatementsOrFn;
  #extraColumns: ((opts: ExtraColumnOpts) => SimpleColumn)[] = [];
  #fields: FieldConfigs = {};
  #toolbarBuilder: DatagridToolbarBuilder;
  #pageSize?: number;
  #rowHeight?: RowHeight;

  constructor(table: string) {
    this.#table = system.db.tables[table];
    if (!this.#table) {
      throw new Error(`No table ${table} found`);
    }
    this.#toolbarBuilder = new DatagridToolbarBuilder(this.#table);
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
            this.#table.name,
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

  canEdit(canEdit: boolean | yom.SqlExpression) {
    this.#canEdit = canEdit;
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
    this.#extraColumns.push(() => column);
    return this;
  }

  virtual(column: {
    name: string;
    headerText?: string;
    type: yom.FieldType | HelperFieldType;
    expr: yom.SqlExpression;
    width?: number;
    cell?: CellNode;
  }) {
    const header = stringLiteral(
      column.headerText ??
        column.name
          .split("_")
          .map((v, i) => (i === 0 ? upcaseFirst(v) : v))
          .join(" "),
    );
    this.#extraColumns.push(({ columnIndex }) => {
      const toggleColumnSort = simpleToggleColumnSort(columnIndex);
      return {
        cell: column.cell ?? ((cell) => cell.value),
        header: [
          nodes.element("span", {
            styles: sharedStyles.headerText,
            children: header,
          }),
          nodes.switch(
            {
              condition: `sort_info.col = ${columnIndex} and sort_info.ascending`,
              node: materialIcon("ArrowUpward"),
            },
            {
              condition: `sort_info.col = ${columnIndex} and not sort_info.ascending`,
              node: materialIcon("ArrowDownward"),
            },
          ),
          resizeableSeperator({
            minWidth: 50,
            setWidth: (width) =>
              new BasicStatements().modify(
                `update ui.column_width set width = ${width} where col = ${columnIndex}`,
              ),
            width: `(select width from ui.column_width where col = ${columnIndex})`,
          }),
        ],
        keydownHeaderHandler: (s) =>
          s.if(`event.key = 'Enter'`, (s) =>
            s.statements(toggleColumnSort, dgState.triggerRefresh),
          ),
        headerClickHandler: (s) =>
          s.statements(toggleColumnSort, dgState.triggerRefresh),
        queryGeneration: {
          alwaysGenerate: false,
          sqlName: column.name,
          expr: column.expr,
          procFieldType: fieldTypeFromHelper(column.type),
        },
        width: column.width ?? 200,
        columnIndex,
      };
    });
    return this;
  }

  extraState(state: StateStatementsOrFn) {
    this.#extraState = state;
    return this;
  }

  toolbar(f: (t: DatagridToolbarBuilder) => unknown) {
    f(this.#toolbarBuilder);
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
              `(select id from ui.dg_table limit 1 offset cell.row - 1)`,
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
              `(select id from ui.dg_table limit 1 offset cell.row - 1)`,
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
        canEdit: fieldConfig?.canEdit ?? this.#canEdit,
        columnIndex: columns.length,
      });
      if (column) {
        columns.push(column);
      }
    }
    for (const extraColumn of this.#extraColumns) {
      columns.push(extraColumn({ columnIndex: columns.length }));
    }
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
    extraState.statements(this.#extraState);
    const path = this.#path ?? this.#table.baseUrl;
    const addHref = path.endsWith("/") ? path + "add" : path + "/add";
    const content = nodes.sourceMap(
      `simpleDatagridPage(${this.#table.name})`,
      styledSimpleDatagrid({
        columns: this.#getColumns(),
        allow: this.#allow,
        idField: this.#table.primaryKeyFieldName,
        pageSize: this.#pageSize,
        tableModel: this.#table,
        toolbar: this.#toolbarBuilder._finish(addHref),
        extraState,
        rowHeight: this.#rowHeight,
      }),
    );
    system.currentApp!.pages.push({
      path,
      content,
    });
  }
}

export function simpleDatagridPage(
  table: string,
  f: (b: SimpleDatagridPageBuilder) => unknown,
) {
  const builder = new SimpleDatagridPageBuilder(table);
  f(builder);
  builder._finish();
}
