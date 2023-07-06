import { InsertDialogOpts } from "../components/insertDialog.js";
import { if_, modify, scalar, setScalar, table } from "../procHelpers.js";
import { model } from "../singleton.js";
import { pluralize } from "../utils/inflectors.js";
import { ident, stringLiteral } from "../utils/sqlHelpers.js";
import { getTableBaseUrl } from "../utils/url.js";
import { StateStatement } from "../yom.js";
import {
  simpleColumnFromField,
  simpleColumnFromVirtual,
} from "./datagridInternals/fromModel.js";
import {
  SimpleColumn,
  simpleDatagrid,
  ToolbarConfig,
} from "./datagridInternals/simpleDatagrid.js";
import { checkbox } from "../components/checkbox.js";
import { BeforeEditTransaction } from "./datagridInternals/editHelper.js";
import { Authorization } from "../modelTypes.js";
import { button } from "../components/button.js";

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
  auth?: Authorization;
  path?: string;
  selectable?: boolean;
  toolbar?: ToolbarOpts;
  useDynamicQuery?: boolean;
  fields?: FieldConfigs;
  extraColumns?: SimpleColumn[];
  viewButton?: boolean | { getLink: (id: string) => string };
}

type FieldConfigs = Record<string, FieldConfig>;

export interface FieldConfig {
  immutable?: boolean;
  beforeEditTransaction?: BeforeEditTransaction;
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
  viewButtonUrl?: (id: string) => string,
  fieldConfigs?: FieldConfigs
): SimpleColumn[] {
  const tableModel = model.database.tables[tableName];
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
          on: {
            click: [toggleRowSelection(`record.id`)],
          },
        }),
      header: checkbox({
        variant: "outlined",
        size: "sm",
        checked: `selected_all`,
        slots: { checkbox: { props: { tabIndex: "-1" } } },
        on: {
          click: [
            setScalar(`selected_all`, `not selected_all`),
            modify(`delete from selected_row`),
          ],
        },
      }),
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
  const idField = tableModel.primaryKeyFieldName
    ? ident(tableModel.primaryKeyFieldName)
    : `id`;
  const startFixedColumns = columns.length;
  // columns.push(idColumn(tableModel));
  let dynamicFieldCount = 1;
  for (const field of Object.values(tableModel.fields)) {
    try {
      columns.push(
        simpleColumnFromField({
          table: tableModel.name,
          field,
          idField,
          beforeEditTransaction:
            fieldConfigs?.[field.name]?.beforeEditTransaction,
        })
      );
      dynamicFieldCount += 1;
    } catch (e) {
      // console.log(field, e);
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

export function tableSimpleGrid(opts: DatagridPageOpts) {
  const tableModel = model.database.tables[opts.table];
  const path = getTableBaseUrl(opts.table);
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
  const columns = getColumns(
    opts.table,
    selectable,
    getViewButtonUrl,
    opts.fields
  );
  if (opts.extraColumns) {
    columns.push(...opts.extraColumns);
  }
  const idSqlName = tableModel.primaryKeyFieldName
    ? ident(tableModel.primaryKeyFieldName)
    : `id`;
  const toolbarConfig: ToolbarConfig = {
    header: stringLiteral(pluralize(tableModel.displayName)),
    delete: opts.toolbar?.delete ?? false,
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
  return simpleDatagrid({
    columns,
    auth: opts.auth,
    idField: opts.useDynamicQuery ? `field_0` : idSqlName,
    path,
    tableModel: tableModel,
    toolbar: toolbarConfig,
    extraState,
    useDynamicQuery: opts.useDynamicQuery ?? false,
    sourceMapName: `tableSimpleGrid(${opts.table})`,
  });
}
