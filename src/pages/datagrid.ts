import { button } from "../components/button.js";
import { InsertDialogOpts } from "../components/insertDialog.js";
import { Table } from "../appTypes.js";
import { element } from "../nodeHelpers.js";
import { if_, modify, scalar, setScalar, table } from "../procHelpers.js";
import { app } from "../singleton.js";
import { upcaseFirst } from "../utils/inflectors.js";
import { ident, stringLiteral } from "../utils/sqlHelpers.js";
import { getTableBaseUrl } from "../utils/url.js";
import { StateStatement } from "../yom.js";
import {
  columnFromField,
  columnFromVirtual,
} from "./datagridInternals/fromModel.js";
import {
  columnPopover,
  styledDatagrid,
  SuperGridColumn,
  ToolbarConfig,
} from "./datagridInternals/styledDatagrid.js";
import { styles as sharedStyles } from "./datagridInternals/styles.js";
import { checkbox } from "../components/checkbox.js";
import { DefaultView } from "./datagridInternals/datagridBase.js";
import { resizeableSeperator } from "./datagridInternals/shared.js";
import { FieldEditProcConfig } from "./datagridInternals/editHelper.js";
import { addPage } from "../appHelpers.js";

export interface ToolbarOpts {
  views?: boolean;
  hideColumns?: boolean;
  filter?: boolean;
  sort?: boolean;
  delete?: boolean;
  export?: boolean;
  search?: boolean | { matchConfig: string };
  add?:
    | "dialog"
    | "href"
    | { type: "dialog"; opts?: Partial<InsertDialogOpts> }
    | { type: "href"; href: string };
}

/** All options for the datagrid page */
export interface DatagridPageOpts {
  table: string;
  datagridName?: string;
  path?: string;
  viewButton?: boolean | { getLink: (id: string) => string };
  selectable?: boolean;
  toolbar?: ToolbarOpts;
  extraColumns?: SuperGridColumn[];
  ignoreFields?: string[];
  defaultView?: DefaultView;
  fields?: FieldConfigs;
}

type FieldConfigs = Record<string, FieldConfig>;

export interface FieldConfig extends FieldEditProcConfig {
  immutable?: boolean;
  displayName?: string;
}

function idColumn(
  tableModel: Table,
  index: number,
  startFixedColumns: number
): SuperGridColumn {
  const idDisplayName = tableModel.primaryKeyFieldName
    ? tableModel.primaryKeyFieldName
        .split("_")
        .map((v, i) => (i === 0 ? upcaseFirst(v) : v))
        .join(" ")
    : `Id`;
  const sqlName = tableModel.primaryKeyFieldName
    ? ident(tableModel.primaryKeyFieldName)
    : `id`;
  const sortConfig = {
    ascNode: "'1 → 9'",
    descNode: "'9 → 1'",
    ascText: "1 → 9",
    descText: "9 → 1",
  };
  return {
    displayName: idDisplayName,
    filter: { type: { type: "number" }, notNull: true },
    sort: sortConfig,
    initialWidth: 150,
    initiallyDisplaying: false,
    header: [
      element("span", {
        styles: sharedStyles.headerText,
        children: stringLiteral(idDisplayName),
      }),
      columnPopover(index, startFixedColumns, sortConfig),
      resizeableSeperator({
        minWidth: 50,
        setWidth: (width) =>
          modify(`update ui.column set width = ${width} where id = ${index}`),
        width: `(select width from ui.column where id = ${index})`,
      }),
    ],
    cell: ({ value }) => value,
    queryGeneration: {
      expr: sqlName,
      sqlName,
      alwaysGenerate: true,
    },
    viewStorageName: sqlName,
  };
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
): SuperGridColumn[] {
  const tableModel = app.database.tables[tableName];
  const columns: SuperGridColumn[] = [];
  if (selectable) {
    columns.push({
      initiallyDisplaying: true,
      initialWidth: 36,
      cell: () =>
        checkbox({
          variant: "outlined",
          size: "sm",
          checked: `selected_all or exists (select id from selected_row where id = cast(record.field_0 as bigint))`,
          slots: { input: { props: { tabIndex: "-1" } } },
          on: {
            click: [toggleRowSelection(`cast(record.field_0 as bigint)`)],
          },
        }),
      header: checkbox({
        variant: "outlined",
        size: "sm",
        checked: `selected_all`,
        slots: { input: { props: { tabIndex: "-1" } } },
        on: {
          click: [
            setScalar(`selected_all`, `not selected_all`),
            modify(`delete from selected_row`),
          ],
        },
      }),
      keydownCellHandler: [
        if_(`event.key = 'Enter' or event.key = ' '`, [
          scalar(
            `row_id`,
            `(select field_0 from ui.dg_table limit 1 offset cell.row - 1)`
          ),
          toggleRowSelection(`cast(row_id as bigint)`),
        ]),
      ],
      keydownHeaderHandler: [
        if_(`event.key = 'Enter' or event.key = ' '`, [
          setScalar(`selected_all`, `not selected_all`),
          modify(`delete from selected_row`),
        ]),
      ],
      viewStorageName: "dg_checkbox_col",
    });
  }
  if (viewButtonUrl) {
    columns.push({
      initialWidth: 76,
      cell: () =>
        button({
          variant: "soft",
          color: "primary",
          size: "sm",
          children: `'View'`,
          href: viewButtonUrl(`record.field_0`),
          props: { tabIndex: "-1" },
        }),
      header: `'View'`,
      initiallyDisplaying: true,
      viewStorageName: "dg_view_button_col",
    });
  }
  const startFixedColumns = columns.length;
  columns.push(idColumn(tableModel, columns.length, startFixedColumns));
  let dynamicFieldCount = 1;
  for (const field of Object.values(tableModel.fields)) {
    if (opts.ignoreFields?.includes(field.name)) {
      continue;
    }
    const fieldConfig = opts.fields?.[field.name];
    const column = columnFromField({
      table: tableModel.name,
      field,
      dynIndex: dynamicFieldCount,
      columnIndex: columns.length,
      startFixedColumns,
      beforeEditTransaction: fieldConfig?.beforeEditTransaction,
      beforeEdit: fieldConfig?.beforeEdit,
      afterEditTransaction: fieldConfig?.afterEditTransaction,
      afterEdit: fieldConfig?.afterEdit,
      immutable: fieldConfig?.immutable,
    });
    if (column) {
      columns.push(column);
      dynamicFieldCount += 1;
    }
  }
  for (const virtual of Object.values(tableModel.virtualFields)) {
    columns.push(
      columnFromVirtual(
        tableModel.name,
        virtual,
        columns.length,
        startFixedColumns
      )
    );
  }
  return columns;
}

export function datagridPage(opts: DatagridPageOpts) {
  const tableModel = app.database.tables[opts.table];
  const path = opts.path ?? getTableBaseUrl(opts.table);
  const selectable = opts.selectable ?? true;
  let getViewButtonUrl: ((id: string) => string) | undefined;
  if (opts.viewButton === true) {
    if (!tableModel.getHrefToRecord) {
      throw new Error(
        "viewButton is true but table has no getHrefToRecord, on datagrid for table " +
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
    views: opts.toolbar?.views ?? true,
    hideColumns: opts.toolbar?.hideColumns ?? true,
    filter: opts.toolbar?.filter ?? true,
    sort: opts.toolbar?.sort ?? true,
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
  if (opts.defaultView) {
    opts.defaultView = { ...opts.defaultView };
    if (opts.defaultView.columnOrder) {
      if (getViewButtonUrl) {
        opts.defaultView.columnOrder.unshift("dg_view_button_col");
      }
      if (selectable) {
        opts.defaultView.columnOrder.unshift("dg_checkbox_col");
      }
    }
  }
  const extraState: StateStatement[] = [];
  if (selectable) {
    extraState.push(
      scalar(`selected_all`, `false`),
      table(`selected_row`, [{ name: "id", type: { type: "BigInt" } }])
    );
  }
  const content = styledDatagrid({
    columns,
    datagridName: opts.datagridName ?? opts.table,
    idField: `field_0`,
    pageSize: 100,
    tableModel: tableModel,
    toolbar: toolbarConfig,
    extraState,
    defaultView: opts.defaultView,
  });
  addPage({
    path,
    content,
  });
}
