import { InsertDialogOpts } from "../components/insertDialog";
import {
  debugExpr,
  if_,
  modify,
  scalar,
  setScalar,
  table,
} from "../procHelpers";
import { app } from "../app";
import { pluralize } from "../utils/inflectors";
import { ident, stringLiteral } from "../utils/sqlHelpers";
import { getTableBaseUrl } from "../utils/url";
import { SqlExpression, StateStatement } from "../yom";
import {
  simpleColumnFromField,
  simpleColumnFromVirtual,
} from "./datagridInternals/fromModel";
import {
  SimpleColumn,
  styledSimpleDatagrid,
  ToolbarConfig,
} from "./datagridInternals/styledSimpleDatagrid";
import { checkbox } from "../components/checkbox";
import { FieldEditProcConfig } from "./datagridInternals/editHelper";
import { button } from "../components/button";
import { RowHeight } from "./datagridInternals/types";
import { addPage } from "../appHelpers";

export interface ToolbarOpts {
  delete?: boolean;
  export?: boolean;
  search?: boolean | { matchConfig: string };
  add?:
    | "dialog"
    | "href"
    | { type: "dialog"; opts?: Partial<InsertDialogOpts> }
    | { type: "href"; href: string };
}

export interface DatagridPageOpts {
  table: string;
  allow?: SqlExpression;
  path?: string;
  selectable?: boolean;
  toolbar?: ToolbarOpts;
  fields?: FieldConfigs;
  extraColumns?: SimpleColumn[];
  fieldOrder?: string[];
  ignoreFields?: string[];
  viewButton?: boolean | { getLink: (id: string) => string };
  rowHeight?: RowHeight;
}

type FieldConfigs = Record<string, FieldConfig>;

export interface FieldConfig extends FieldEditProcConfig {
  immutable?: boolean;
  header?: string;
}

function toggleRowSelection(id: string) {
  return if_(
    `exists (select id from ui.selected_row where id = ${id})`,
    [modify(`delete from selected_row where id = ${id}`)],
    [modify(`insert into selected_row (id) values (${id})`)]
  );
}

function getColumns(
  tableName: string,
  selectable: boolean,
  viewButtonUrl: ((id: string) => string) | undefined,
  opts: DatagridPageOpts
): SimpleColumn[] {
  const tableModel = app.db.tables[tableName];
  const columns: SimpleColumn[] = [];
  if (selectable) {
    columns.push({
      width: 36,
      cell: () =>
        checkbox({
          variant: "outlined",
          size: "sm",
          checked: `selected_all or exists (select id from selected_row where id = record.id)`,
          slots: { checkbox: { props: { tabIndex: "-1" } } },
        }),
      header: checkbox({
        variant: "outlined",
        size: "sm",
        checked: `selected_all`,
        slots: { checkbox: { props: { tabIndex: "-1" } } },
      }),
      cellClickHandler: [
        scalar(
          `row_id`,
          `(select id from ui.dg_table limit 1 offset cell.row - 1)`
        ),
        toggleRowSelection(`row_id`),
      ],
      headerClickHandler: [
        setScalar(`selected_all`, `not selected_all`),
        modify(`delete from selected_row`),
      ],
      keydownCellHandler: [
        scalar(
          `row_id`,
          `(select id from ui.dg_table limit 1 offset cell.row - 1)`
        ),
        toggleRowSelection(`cast(row_id as bigint)`),
      ],
      keydownHeaderHandler: [
        setScalar(`selected_all`, `not selected_all`),
        modify(`delete from selected_row`),
      ],
    });
  }
  if (viewButtonUrl) {
    columns.push({
      width: 76,
      cell: () =>
        button({
          variant: "soft",
          color: "primary",
          size: "sm",
          children: `'View'`,
          href: viewButtonUrl(`record.id`),
          props: { tabIndex: "-1" },
        }),
      header: `'View'`,
    });
  }
  const idField = ident(tableModel.primaryKeyFieldName);
  const startFixedColumns = columns.length;
  // columns.push(idColumn(tableModel));
  const fields = opts.fieldOrder ?? [];
  for (const fieldName of Object.keys(tableModel.fields)) {
    if (opts.ignoreFields?.includes(fieldName) || fields.includes(fieldName)) {
      continue;
    }
    fields.push(fieldName);
  }
  for (const fieldName of fields) {
    const field = tableModel.fields[fieldName];
    const fieldConfig = opts.fields?.[field.name];
    const column = simpleColumnFromField({
      table: tableModel.name,
      field,
      idField,
      beforeEdit: fieldConfig?.beforeEdit,
      beforeEditTransaction: fieldConfig?.beforeEditTransaction,
      afterEdit: fieldConfig?.afterEdit,
      afterEditTransaction: fieldConfig?.afterEditTransaction,
      immutable: fieldConfig?.immutable,
      columnIndex: columns.length,
    });
    if (column) {
      columns.push(column);
    }
  }
  for (const virtual of Object.values(tableModel.virtualFields)) {
    columns.push(
      simpleColumnFromVirtual(
        tableModel.name,
        virtual,
        columns.length,
        startFixedColumns
      )
    );
  }
  return columns;
}

export function simpleDatagridPage(opts: DatagridPageOpts) {
  const tableModel = app.db.tables[opts.table];
  const path = opts.path ?? getTableBaseUrl(opts.table);
  const selectable = opts.selectable ?? true;
  let getViewButtonUrl: ((id: string) => string) | undefined;
  if (opts.viewButton === true) {
    if (!tableModel.getHrefToRecord) {
      throw new Error(
        "viewButton is true but table has no getHrefToRecord for datagrid of table " +
          opts.table
      );
    }
    getViewButtonUrl = tableModel.getHrefToRecord;
  } else if (typeof opts.viewButton === "function") {
    getViewButtonUrl = opts.viewButton;
  }
  const columns = getColumns(opts.table, selectable, getViewButtonUrl, opts);
  if (opts.extraColumns) {
    columns.push(...opts.extraColumns);
  }
  const toolbarConfig: ToolbarConfig = {
    header: stringLiteral(pluralize(tableModel.displayName)),
    delete: opts.toolbar?.delete ?? true,
    export: opts.toolbar?.export ?? false,
  };
  if (opts.toolbar?.search === true) {
    toolbarConfig.search = { matchConfig: `${opts.table}_name` };
  } else if (opts.toolbar?.search) {
    toolbarConfig.search = opts.toolbar.search;
  }
  if (opts.toolbar?.add === "dialog") {
    toolbarConfig.add = {
      type: "dialog",
      opts: {},
    };
  } else if (opts.toolbar?.add === "href") {
    toolbarConfig.add = {
      type: "href",
      href: `/${path}/add`,
    };
  } else if (opts.toolbar?.add) {
    toolbarConfig.add = opts.toolbar.add;
  }
  const extraState: StateStatement[] = [];
  if (selectable) {
    extraState.push(
      scalar(`selected_all`, `false`),
      table(`selected_row`, [{ name: "id", type: { type: "BigInt" } }])
    );
  }
  const content = styledSimpleDatagrid({
    columns,
    allow: opts.allow,
    idField: tableModel.primaryKeyFieldName,
    tableModel: tableModel,
    toolbar: toolbarConfig,
    extraState,
    sourceMapName: `tableSimpleGrid(${opts.table})`,
    rowHeight: opts.rowHeight,
  });
  addPage({
    path,
    content,
  });
}
