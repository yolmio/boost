import { button } from "../components/button";
import { InsertDialogOpts } from "../components/insertDialog";
import { Table } from "../app";
import { nodes } from "../nodeHelpers";
import { app } from "../app";
import { upcaseFirst } from "../utils/inflectors";
import { stringLiteral } from "../utils/sqlHelpers";
import { columnFromField } from "./datagridInternals/fromModel";
import {
  columnPopover,
  FilterType,
  SortConfig,
  styledDatagrid,
  SuperGridColumn,
  ToolbarConfig,
} from "./datagridInternals/styledDatagrid";
import { styles as sharedStyles } from "./datagridInternals/styles";
import { checkbox } from "../components/checkbox";
import { DefaultView } from "./datagridInternals/datagridBase";
import {
  CellNode,
  DgStateHelpers,
  FieldEditProcConfig,
  resizeableSeperator,
} from "./datagridInternals/shared";
import {
  BasicStatements,
  StateStatements,
  StateStatementsOrFn,
} from "../statements";
import * as yom from "../yom";
import { Node } from "../nodeTypes";
import { FilterTermHelper } from "./datagridInternals/filterPopover";

type FieldConfigs = Record<string, FieldConfig>;

export interface FieldConfig extends FieldEditProcConfig {
  immutable?: boolean | yom.SqlExpression;
  displayName?: string;
}

function idColumn(
  tableModel: Table,
  index: number,
  startFixedColumns: number
): SuperGridColumn {
  const idDisplayName = tableModel.primaryKeyFieldName
    .split("_")
    .map((v, i) => (i === 0 ? upcaseFirst(v) : v))
    .join(" ");
  const sqlName = tableModel.primaryKeyIdent;
  const sortConfig = {
    type: "numeric",
    displayName: idDisplayName,
  } as SortConfig;
  return {
    filterDisplayName: idDisplayName,
    columnsDisplayName: idDisplayName,
    filterOptGroup: "Field",
    filter: { type: "number", notNull: true },
    sort: sortConfig,
    displayInfo: {
      initialWidth: 150,
      initiallyDisplaying: false,
      header: (state) => [
        nodes.element("span", {
          styles: sharedStyles.headerText,
          children: stringLiteral(idDisplayName),
        }),
        columnPopover(state, index, startFixedColumns, sortConfig),
        resizeableSeperator({
          minWidth: 50,
          setWidth: (width) =>
            new BasicStatements().modify(
              `update ui.column set width = ${width} where id = ${index}`
            ),
          width: `(select width from ui.column where id = ${index})`,
        }),
      ],
      cell: (cell) => cell.value,
    },
    queryGeneration: {
      expr: sqlName,
      alwaysGenerate: true,
    },
    viewStorageName: sqlName,
  };
}

function toggleRowSelection(id: string) {
  return new BasicStatements().if({
    condition: `exists (select id from ui.selected_row where id = ${id})`,
    then: (s) => s.modify(`delete from selected_row where id = ${id}`),
    else: (s) => s.modify(`insert into selected_row (id) values (${id})`),
  });
}

export class DatagridToolbarBuilder {
  #views = true;
  #hideColumns = true;
  #filter = true;
  #sort = true;
  #delete = false;
  #export = false;
  #add?:
    | { type: "dialog"; opts?: Partial<InsertDialogOpts> }
    | { type: "href"; href: string };

  insertDialog(opts?: Partial<InsertDialogOpts>) {
    this.#add = { type: "dialog", opts };
    return this;
  }

  insertPage(href: string) {
    this.#add = { type: "href", href };
    return this;
  }

  views(views?: boolean) {
    this.#views = views ?? true;
    return this;
  }

  hideColumns(hideColumns?: boolean) {
    this.#hideColumns = hideColumns ?? true;
    return this;
  }

  filter(filter?: boolean) {
    this.#filter = filter ?? true;
    return this;
  }

  sort(sort?: boolean) {
    this.#sort = sort ?? true;
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
      views: this.#views,
      hideColumns: this.#hideColumns,
      filter: this.#filter,
      sort: this.#sort,
      delete: this.#delete,
      export: this.#export,
      add: this.#add,
    };
  }
}

export interface ExtraColumnOpts {
  startFixedColumns: number;
  currentColumnId: number;
}

export class DatagridPageBuilder {
  #table: Table;
  #path?: string;
  #datagridName?: string;
  #viewButtonUrl?: (id: yom.SqlExpression) => yom.SqlExpression;
  #selectable?: boolean;
  #defaultView?: DefaultView;
  #immutable?: boolean | yom.SqlExpression;
  #ignoreFields?: string[];
  #extraState?: StateStatementsOrFn;
  #extraColumns: ((opts: ExtraColumnOpts) => SuperGridColumn)[] = [];
  #fields: FieldConfigs = {};
  #toolbarConfig?: ToolbarConfig;
  #pageSize = 100;

  constructor(table: string) {
    this.#table = app.db.tables[table];
    if (!this.#table) {
      throw new Error(`No table ${table} found`);
    }
  }

  pageSize(pageSize: number) {
    this.#pageSize = pageSize;
    return this;
  }

  datagridName(name: string) {
    this.#datagridName = name;
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

  defaultView(view: DefaultView) {
    this.#defaultView = view;
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

  column(column: SuperGridColumn) {
    this.#extraColumns.push(() => column);
    return this;
  }

  customFilterColumn(column: {
    storageName: string;
    displayName?: string;
    expr: (
      value1: yom.SqlExpression,
      value2: yom.SqlExpression,
      value3: yom.SqlExpression
    ) => yom.SqlExpression;
    node?: (helpers: FilterTermHelper, state: DgStateHelpers) => Node;
  }) {
    this.#extraColumns.push(() => ({
      viewStorageName: column.storageName,
      filterDisplayName:
        column.displayName ??
        column.storageName
          .split("_")
          .map((v, i) => (i === 0 ? upcaseFirst(v) : v))
          .join(" "),
      filterOptGroup: "Other",
      filterExpr: column.expr,
      filter: {
        type: "custom",
        node: column.node,
      },
    }));
    return this;
  }

  customSortColumn(column: {
    storageName: string;
    expr: (record: string) => yom.SqlExpression;
    sort: Omit<SortConfig, "displayName"> & { displayName?: string };
  }) {
    this.#extraColumns.push(() => ({
      viewStorageName: column.storageName,
      queryGeneration: {
        expr: column.expr("record"),
        alwaysGenerate: false,
      },
      sort: {
        ...column.sort,
        displayName:
          column.sort.displayName ??
          column.storageName
            .split("_")
            .map((v, i) => (i === 0 ? upcaseFirst(v) : v))
            .join(" "),
      } as any,
    }));
    return this;
  }

  /**
   * A column that is basically like a field, but is actually backed by some sql expression
   */
  virtualColumn(column: {
    storageName: string;
    displayName?: string;
    columnsDisplayName?: string;
    expr: yom.SqlExpression;
    filterDisplayName?: string;
    filterOptGroup?: string;
    filter?: FilterType;
    sort?: Omit<SortConfig, "displayName"> & { displayName?: string };
    cell?: CellNode;
    initialWidth?: number;
    initiallyDisplaying?: boolean;
  }) {
    const displayName =
      column.displayName ??
      column.storageName
        .split("_")
        .map((v, i) => (i === 0 ? upcaseFirst(v) : v))
        .join(" ");
    const sort = { ...column.sort, displayName } as SortConfig;
    this.#extraColumns.push(({ currentColumnId, startFixedColumns }) => ({
      viewStorageName: column.storageName,
      queryGeneration: {
        expr: column.expr,
        alwaysGenerate: false,
      },
      displayInfo: {
        cell: column.cell ?? ((cell) => cell.value),
        header: (state) => [
          nodes.element("span", {
            styles: sharedStyles.headerText,
            children: stringLiteral(column.columnsDisplayName ?? displayName),
          }),
          columnPopover(state, currentColumnId, startFixedColumns, sort),
          resizeableSeperator({
            minWidth: 50,
            setWidth: (width) =>
              new BasicStatements().modify(
                `update ui.column set width = ${width} where id = ${currentColumnId}`
              ),
            width: `(select width from ui.column where id = ${currentColumnId})`,
          }),
        ],
        initiallyDisplaying: column.initiallyDisplaying ?? false,
        initialWidth: column.initialWidth ?? 150,
      },
      filterDisplayName: column.filterDisplayName,
      filterOptGroup: column.filterOptGroup,
      filter: column.filter,
      sort,
    }));
    return this;
  }

  extraState(state: StateStatementsOrFn) {
    this.#extraState = state;
    return this;
  }

  toolbar(f: (t: DatagridToolbarBuilder) => DatagridToolbarBuilder) {
    this.#toolbarConfig = f(new DatagridToolbarBuilder())._finish();
    return this;
  }

  #getColumns() {
    const columns: SuperGridColumn[] = [];
    if (this.#selectable) {
      columns.push({
        displayInfo: {
          initiallyDisplaying: true,
          initialWidth: 36,
          cell: () =>
            checkbox({
              variant: "outlined",
              size: "sm",
              checked: `selected_all or exists (select id from selected_row where id = cast(dg_record.field_0 as bigint))`,
              slots: { input: { props: { tabIndex: "-1" } } },
              on: {
                click: toggleRowSelection(`cast(dg_record.field_0 as bigint)`),
              },
            }),
          header: () =>
            checkbox({
              variant: "outlined",
              size: "sm",
              checked: `selected_all`,
              slots: { input: { props: { tabIndex: "-1" } } },
              on: {
                click: (s) =>
                  s
                    .setScalar(`selected_all`, `not selected_all`)
                    .modify(`delete from selected_row`),
              },
            }),
        },
        keydownCellHandler: (s) =>
          s.if(`event.key = 'Enter' or event.key = ' '`, (s) =>
            s
              .scalar(
                `row_id`,
                `(select field_0 from ui.dg_table limit 1 offset cell.row - 1)`
              )
              .statements(toggleRowSelection(`cast(row_id as bigint)`))
          ),
        keydownHeaderHandler: (s) =>
          s.if(`event.key = 'Enter' or event.key = ' '`, (s) =>
            s
              .setScalar(`selected_all`, `not selected_all`)
              .modify(`delete from selected_row`)
          ),
        viewStorageName: "dg_checkbox_col",
      });
    }
    if (this.#viewButtonUrl) {
      const viewButtonUrl = this.#viewButtonUrl;
      columns.push({
        displayInfo: {
          initialWidth: 76,
          cell: () =>
            button({
              variant: "soft",
              color: "primary",
              size: "sm",
              children: `'View'`,
              href: viewButtonUrl(`dg_record.field_0`),
              props: { tabIndex: "-1" },
            }),
          header: () => `'View'`,
          initiallyDisplaying: true,
        },
        viewStorageName: "dg_view_button_col",
      });
    }
    const startFixedColumns = columns.length;
    columns.push(idColumn(this.#table, columns.length, startFixedColumns));
    let dynamicFieldCount = 1;
    for (const field of Object.values(this.#table.fields)) {
      if (this.#ignoreFields?.includes(field.name)) {
        continue;
      }
      const fieldConfig = this.#fields?.[field.name];
      let immutable;
      if (typeof fieldConfig?.immutable === "string") {
        immutable = "field_" + field.name + "_is_immutable";
      } else if (typeof fieldConfig?.immutable === "boolean") {
        immutable = fieldConfig.immutable;
      } else if (typeof this.#immutable === "string") {
        immutable = "global_is_immutable";
      } else {
        immutable = this.#immutable;
      }
      const column = columnFromField({
        table: this.#table.name,
        field,
        dynIndex: dynamicFieldCount,
        columnIndex: columns.length,
        startFixedColumns,
        beforeEditTransaction: fieldConfig?.beforeEditTransaction,
        beforeEdit: fieldConfig?.beforeEdit,
        afterEditTransaction: fieldConfig?.afterEditTransaction,
        afterEdit: fieldConfig?.afterEdit,
        immutable,
      });
      if (column) {
        columns.push(column);
        dynamicFieldCount += 1;
      }
    }
    if (this.#extraColumns) {
      for (const f of this.#extraColumns) {
        columns.push(f({ currentColumnId: columns.length, startFixedColumns }));
      }
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
    if (typeof this.#immutable === "string") {
      extraState.scalar(`global_is_immutable`, this.#immutable);
    }
    for (const field of Object.values(this.#table.fields)) {
      const fieldConfig = this.#fields?.[field.name];
      if (typeof fieldConfig?.immutable === "string") {
        extraState.scalar(
          `field_${field.name}_is_immutable`,
          fieldConfig.immutable
        );
      }
    }
    extraState.statements(this.#extraState);
    let defaultView;
    if (this.#defaultView) {
      defaultView = { ...this.#defaultView };
      if (defaultView.columnOrder) {
        if (this.#viewButtonUrl) {
          defaultView.columnOrder.unshift("dg_view_button_col");
        }
        if (this.#selectable) {
          defaultView.columnOrder.unshift("dg_checkbox_col");
        }
      }
    }
    const content = nodes.sourceMap(
      `datagridPage(${this.#table.name})`,
      styledDatagrid({
        columns: this.#getColumns(),
        datagridName: this.#datagridName ?? this.#table.name,
        idField: `field_0`,
        pageSize: this.#pageSize,
        tableModel: this.#table,
        toolbar: this.#toolbarConfig ?? new DatagridToolbarBuilder()._finish(),
        extraState,
        defaultView: this.#defaultView,
      })
    );
    app.ui.pages.push({
      path: this.#path ?? this.#table.baseUrl,
      content,
    });
  }
}

export function datagridPage(
  table: string,
  f: (t: DatagridPageBuilder) => unknown
) {
  const builder = new DatagridPageBuilder(table);
  f(builder);
  builder._finish();
}
