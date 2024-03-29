import { button } from "../components/button";
import {
  EmbeddedInsertDialog,
  EmbeddedInsertDialogOpts,
  resolveEmbeddedInsertDialog,
} from "../components/forms/dialogs/index";
import { Table } from "../system";
import { nodes } from "../nodeHelpers";
import { system } from "../system";
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
  canEdit?: boolean | yom.SqlExpression;
  displayName?: string;
}

function idColumn(
  tableModel: Table,
  index: number,
  startFixedColumns: number,
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
              `update ui.column set width = ${width} where id = ${index}`,
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
    | { type: "dialog"; dialog?: EmbeddedInsertDialog }
    | { type: "href"; href?: string };

  insertDialog(opts?: EmbeddedInsertDialog) {
    this.#add = { type: "dialog", dialog: opts };
    return this;
  }

  insertPage(href?: string) {
    this.#add = { type: "href", href: href };
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

  _finish(addHref: string): ToolbarConfig {
    return {
      views: this.#views,
      hideColumns: this.#hideColumns,
      filter: this.#filter,
      sort: this.#sort,
      delete: this.#delete,
      export: this.#export,
      add:
        this.#add?.type === "href"
          ? { type: "href", href: this.#add.href ?? addHref }
          : { type: "dialog", dialog: this.#add?.dialog },
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
  #canEdit?: boolean | yom.SqlExpression;
  #ignoreFields?: string[];
  #extraState?: StateStatementsOrFn;
  #extraColumns: ((opts: ExtraColumnOpts) => SuperGridColumn)[] = [];
  #fields: FieldConfigs = {};
  #toolbarBuilder = new DatagridToolbarBuilder();
  #pageSize = 100;

  constructor(table: string) {
    this.#table = system.db.tables[table];
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

  defaultView(view: DefaultView) {
    this.#defaultView = view;
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
      value3: yom.SqlExpression,
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
      columnsDisplayName: column.columnsDisplayName ?? displayName,
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
                `update ui.column set width = ${width} where id = ${currentColumnId}`,
              ),
            width: `(select width from ui.column where id = ${currentColumnId})`,
          }),
        ],
        initiallyDisplaying: column.initiallyDisplaying ?? false,
        initialWidth: column.initialWidth ?? 150,
      },
      filterDisplayName:
        column.filterDisplayName ??
        (column.filter ? column.filterDisplayName ?? displayName : undefined),
      filterOptGroup:
        column.filterOptGroup ?? (column.filter ? "Field" : undefined),
      filter: column.filter,
      sort,
    }));
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
                `(select field_0 from ui.dg_table limit 1 offset cell.row - 1)`,
              )
              .statements(toggleRowSelection(`cast(row_id as bigint)`)),
          ),
        keydownHeaderHandler: (s) =>
          s.if(`event.key = 'Enter' or event.key = ' '`, (s) =>
            s
              .setScalar(`selected_all`, `not selected_all`)
              .modify(`delete from selected_row`),
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
      let canEdit;
      if (typeof fieldConfig?.canEdit === "string") {
        canEdit = "field_" + field.name + "_can_edit";
      } else if (typeof fieldConfig?.canEdit === "boolean") {
        canEdit = fieldConfig.canEdit;
      } else if (typeof this.#canEdit === "string") {
        canEdit = "global_can_edit";
      } else {
        canEdit = this.#canEdit;
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
        canEdit,
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

  // used externally, but we don't want to polute the public API

  private createNode() {
    const extraState = new StateStatements();
    if (this.#selectable) {
      extraState.scalar(`selected_all`, `false`);
      extraState.table(`selected_row`, [
        { name: "id", type: { type: "BigInt" } },
      ]);
    }
    if (typeof this.#canEdit === "string") {
      extraState.scalar(`global_can_edit`, this.#canEdit);
    }
    for (const field of Object.values(this.#table.fields)) {
      const fieldConfig = this.#fields?.[field.name];
      if (typeof fieldConfig?.canEdit === "string") {
        extraState.scalar(`field_${field.name}_can_edit`, fieldConfig.canEdit);
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
    const path = this.#path ?? this.#table.baseUrl;
    const addHref = path.endsWith("/") ? path + "add" : path + "/add";
    return nodes.sourceMap(
      `datagridPage(${this.#table.name})`,
      styledDatagrid({
        columns: this.#getColumns(),
        datagridName: this.#datagridName ?? this.#table.name,
        idField: `field_0`,
        pageSize: this.#pageSize,
        tableModel: this.#table,
        toolbar: this.#toolbarBuilder._finish(addHref),
        extraState,
        defaultView: this.#defaultView,
      }),
    );
  }

  private createPage() {
    const path = this.#path ?? this.#table.baseUrl;
    const content = this.createNode();
    return {
      path,
      content,
    };
  }
}
