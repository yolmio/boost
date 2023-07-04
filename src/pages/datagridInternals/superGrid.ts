import { iconButton } from "../../components/iconButton.js";
import { InsertDialogOpts } from "../../components/insertDialog.js";
import { list, listItem, listItemButton } from "../../components/list.js";
import { materialIcon } from "../../components/materialIcon.js";
import { getUniqueUiId } from "../../components/utils.js";
import { addDecisionTable, addPage } from "../../modelHelpers.js";
import { BoolEnumLikeConfig, DurationSize, Table } from "../../modelTypes.js";
import { element, eventHandlers, ifNode, state } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import {
  debugQuery,
  delay,
  exit,
  if_,
  modify,
  scalar,
  setScalar,
} from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { ClientProcStatement, StateStatement } from "../../yom.js";
import {
  addDatagridDts,
  BaseColumn,
  BaseColumnQueryGeneration,
  baseDatagrid,
  Cell,
  DefaultView,
  triggerQueryRefresh,
} from "./baseDatagrid.js";
import { styles as sharedStyles } from "./styles.js";
import { toolbar } from "./toolbar.js";
import { viewDrawer } from "./viewDrawer.js";

export interface ToolbarConfig {
  views: boolean;
  hideColumns: boolean;
  filter: boolean;
  sort: boolean;
  delete: boolean;
  export: boolean;
  search?: { matchConfig: string };
  add?:
    | { type: "dialog"; opts: Partial<InsertDialogOpts> }
    | { type: "href"; href: string };
}

export interface SortConfig {
  ascNode: Node;
  descNode: Node;
  ascText: string;
  descText: string;
}

export interface SuperGridColumn {
  queryGeneration?: BaseColumnQueryGeneration;
  viewStorageName: string;
  displayName?: string;
  initialWidth: number;
  initiallyDisplaying: boolean;
  header: Node;
  filter?: {
    type: FilterType;
    notNull: boolean;
  };
  sort?: SortConfig;
  keydownCellHandler?: ClientProcStatement[];
  keydownHeaderHandler?: ClientProcStatement[];
  cell: Cell;
}

export type FilterType =
  | { type: "string" | "number" | "date" | "bool" }
  | {
      type: "table";
      table: string;
    }
  | {
      type: "enum";
      enum: string;
    }
  | {
      type: "enum_like_bool";
      config: BoolEnumLikeConfig;
    }
  | { type: "duration"; size: DurationSize };

export function eqFilterType(l: FilterType, r: FilterType) {
  if (typeof l === "string") {
    return l === r;
  }
  if (typeof r === "string") {
    return false;
  }
  if (l.type === "table") {
    return r.type === "table" && r.table === l.table;
  }
  if (l.type === "enum") {
    return r.type === "enum" && r.enum === l.enum;
  }
  return false;
}

export function defaultOpForFieldType(type: FilterType) {
  switch (type.type) {
    case "number":
      return "num_eq";
    case "string":
      return "str_eq";
    case "date":
      return "date_eq";
    case "enum":
      return "enum_eq";
    case "table":
      return "fk_eq";
    case "bool":
      return "bool_eq";
    case "enum_like_bool":
      return "enum_like_bool_eq";
    case "duration":
      if (type.size === "minutes") {
        return "minute_duration_eq";
      }
      throw new Error("unhandled duration size");
  }
}

const styles = createStyles({
  seperatorWrapper: {
    position: "absolute",
    right: -8,
    cursor: "col-resize",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    width: 16,
    zIndex: 1000,
    "& > div": {
      visibility: "hidden",
    },
    "&:hover > div": {
      visibility: "visible",
    },
  },
  seperator: {
    display: "flex",
    alignItems: "center",
    cursor: "col-resize",
    fontSize: "2xl",
    color: "text-secondary",
    zIndex: 1000,
    userSelect: "none",
    height: 36,
    width: 4,
    backgroundColor: "primary-500",
    "&.active": {
      "& > div": {
        visibility: "visible",
      },
    },
  },
  columnDialog: {
    backgroundColor: "background-popup",
    borderRadius: "md",
    boxShadow: "md",
    display: "flex",
    flexDirection: "column",
    zIndex: 100,
    minWidth: 192,
    width: 192,
    border: "1px solid",
    borderColor: "divider",
  },
  drawerGridWrapper: {
    width: "100%",
    height: "100%",
    display: "flex",
  },
  queryError: {
    position: "absolute",
    bottom: "20",
    left: "8",
    backgroundColor: "danger-500",
    zIndex: 10000,
    color: "common-white",
    p: 2,
  },
});

export function seperator(idx: number, minWidth?: number) {
  let newValue = "start_width + (event.client_x - start_x)";
  if (typeof minWidth === "number") {
    newValue = `case when ${newValue} < ${minWidth} then ${minWidth} else ${newValue} end`;
  }
  return state({
    procedure: [
      scalar("start_width", { type: "BigInt" }),
      scalar(`start_x`, { type: "BigInt" }),
      scalar(`pending_width`, { type: "BigInt" }),
      scalar(`waiting`, `false`),
    ],
    children: element("div", {
      styles: styles.seperatorWrapper,
      dynamicClasses: [
        {
          classes: "active",
          condition: "start_width is not null",
        },
      ],
      on: {
        mouseDown: [
          setScalar(
            "start_width",
            `(select width from ui.column where id = ${idx})`
          ),
          setScalar(`start_x`, `event.client_x`),
        ],
      },
      children: [
        element("div", {
          styles: styles.seperator,
        }),
        ifNode(
          `start_width is not null`,
          eventHandlers({
            document: {
              mouseMove: [
                setScalar(`pending_width`, newValue),
                if_(`not waiting`, [
                  setScalar(`waiting`, `true`),
                  delay(`16`),
                  modify(
                    `update ui.column set width = pending_width where id = ${idx} `
                  ),
                  setScalar(`waiting`, `false`),
                ]),
              ],
              mouseUp: [setScalar(`start_width`, `null`)],
            },
          })
        ),
      ],
    }),
  });
}

const popoverId = stringLiteral(getUniqueUiId());

export function columnPopover(
  i: number,
  startFixedColumns: number,
  sort: SortConfig | undefined
) {
  function updateBetweenColumns(before: string, after: string) {
    return modify(
      `update ui.column set ordering = ordering.new(${before}, ${after}) where id = ${i}`
    );
  }
  function getColumnN(n: number) {
    return `(select ordering from ui.column order by ordering offset ${n} limit 1)`;
  }
  return state({
    procedure: [scalar("dialog_open", "false")],
    children: [
      iconButton({
        variant: "plain",
        color: "neutral",
        size: "sm",
        props: { id: `${popoverId} || '-${i}'`, tabIndex: "-1" },
        on: {
          click: [setScalar(`ui.dialog_open`, `true`)],
        },
        children: materialIcon({
          fontSize: "md",
          name: "MoreVert",
        }),
      }),
      ifNode(
        "dialog_open",
        list({
          styles: styles.columnDialog,
          floating: {
            anchorEl: `${popoverId} || '-${i}'`,
            placement: `'bottom-end'`,
            strategy: `'absolute'`,
            shift: {
              mainAxis: "true",
              crossAxis: "true",
            },
            offset: {
              mainAxis: `4`,
              crossAxis: `0`,
            },
            flip: {
              crossAxis: `false`,
              mainAxis: `false`,
            },
          },
          on: {
            clickAway: [setScalar(`ui.dialog_open`, `false`)],
          },
          children: [
            sort
              ? [
                  listItem({
                    on: {
                      click: [
                        modify(
                          `update ui.column set
                      sort_index = case when sort_index is null then (select count(*) from ui.column where sort_index is not null) else sort_index end,
                      sort_asc = true
                    where id = ${i}`
                        ),
                        triggerQueryRefresh(),
                      ],
                    },
                    children: listItemButton({
                      variant: "plain",
                      color: "neutral",
                      children: ["'Sort '", sort.ascNode],
                    }),
                  }),
                  listItem({
                    on: {
                      click: [
                        modify(
                          `update ui.column set
                      sort_index = case when sort_index is null then (select count(*) from ui.column where sort_index is not null) else sort_index end,
                      sort_asc = false
                    where id = ${i}`
                        ),
                        triggerQueryRefresh(),
                      ],
                    },
                    children: listItemButton({
                      variant: "plain",
                      color: "neutral",
                      children: ["'Sort '", sort.descNode],
                    }),
                  }),
                ]
              : undefined,
            listItem({
              on: {
                click: [
                  modify(
                    `update ui.column set displaying = false where id = ${i}`
                  ),
                ],
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Hide Field'",
              }),
            }),
            listItem({
              on: {
                click: [
                  scalar(
                    `next_col`,
                    `(select min(ordering) from ui.column where ordering > (select ordering from ui.column where id = ${i}))`
                  ),
                  if_(`next_col is null`, [exit()]),
                  updateBetweenColumns(
                    `next_col`,
                    `(select min(ordering) from ui.column where ordering > next_col)`
                  ),
                ],
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Move right'",
              }),
            }),
            listItem({
              on: {
                click: [
                  scalar(
                    `current_col`,
                    `(select ordering from ui.column where id = ${i})`
                  ),
                  scalar(
                    `prev_col`,
                    `(select max(ordering) from ui.column where ordering < current_col)`
                  ),
                  if_(
                    `prev_col is null or (select count(*) from column where ordering < current_col) <= ${
                      startFixedColumns + 1
                    }`,
                    [exit()]
                  ),
                  updateBetweenColumns(
                    `(select max(ordering) from ui.column where ordering < prev_col)`,
                    `prev_col`
                  ),
                ],
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Move left'",
              }),
            }),
            listItem({
              on: {
                click: [
                  updateBetweenColumns(
                    `(select max(ordering) from ui.column)`,
                    `null`
                  ),
                ],
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Move to end'",
              }),
            }),
            listItem({
              on: {
                click: [
                  updateBetweenColumns(
                    getColumnN(startFixedColumns),
                    getColumnN(startFixedColumns + 1)
                  ),
                ],
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Move to start'",
              }),
            }),
          ],
        })
      ),
    ],
  });
}

export interface SuperGridDts {
  idToDisplayName: string;
  idToDefaultOp: string;
}

/**
 * Create decision tables that help handle the query generation for the datagrid.
 */
function addSupergridDatagridDts(
  datagridName: string,
  columns: SuperGridColumn[]
): SuperGridDts {
  const displayNames: string[] = [];
  const defaultOps: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.displayName) {
      displayNames.push(`${i},${stringLiteral(col.displayName)}`);
    }
    if (col.filter) {
      const op = defaultOpForFieldType(col.filter.type);
      defaultOps.push(
        [i, "cast(" + stringLiteral(op) + "as enums.dg_filter_op)"].join(",")
      );
    }
  }
  const idToDisplayName = `${datagridName}_dg_col_id_to_display_name`;
  addDecisionTable({
    bound: false,
    parameters: [{ name: "id", type: "SmallUint" }],
    csv: `input.id,display_name\n` + displayNames.join("\n"),
    name: idToDisplayName,
    output: { name: "display_name", type: "String" },
  });
  const idToDefaultOp = `${datagridName}_dg_col_id_to_op`;
  addDecisionTable({
    bound: false,
    parameters: [{ name: "id", type: "SmallUint" }],
    csv: `input.id,op\n` + defaultOps.join("\n"),
    name: idToDefaultOp,
    output: { name: "op", type: { type: "Enum", enum: "dg_filter_op" } },
  });
  return { idToDefaultOp, idToDisplayName };
}

export interface SuperGridConfig {
  datagridName: string;
  tableModel: Table;
  toolbar: ToolbarConfig;
  path: string;
  columns: SuperGridColumn[];
  idField: string;
  pageSize: number;
  extraState?: StateStatement[];
  defaultView?: DefaultView;
}

export function superGrid(config: SuperGridConfig) {
  const baseColumns = config.columns.map(
    (c): BaseColumn => ({
      cell: c.cell,
      header: c.header,
      initiallyDisplaying: c.initiallyDisplaying,
      initialWidth: c.initialWidth,
      keydownCellHandler: c.keydownCellHandler,
      keydownHeaderHandler: c.keydownHeaderHandler,
      queryGeneration: c.queryGeneration,
      viewStorageName: c.viewStorageName,
    })
  );
  const superDts = addSupergridDatagridDts(config.datagridName, config.columns);
  const dts = addDatagridDts(config.datagridName, baseColumns);
  const content = baseDatagrid({
    source: "db." + ident(config.tableModel.name),
    children: (dg) => [
      toolbar(
        config.toolbar,
        config.columns,
        dts,
        superDts,
        config.tableModel,
        config.toolbar.search?.matchConfig
      ),
      state({
        procedure: [scalar(`show_query_err`, `false`)],
        children: [
          eventHandlers({
            document: {
              keydown: [
                if_(`event.meta_key and event.key = 'v'`, [
                  setScalar(`show_query_err`, `not show_query_err`),
                ]),
              ],
            },
          }),
          ifNode(
            `show_query_err`,
            element("div", {
              styles: styles.queryError,
              children: [
                element("p", {
                  children: `dg_error.message`,
                }),
                element("p", {
                  children: `dg_error.description`,
                }),
              ],
            })
          ),
        ],
      }),
      element("div", {
        styles: styles.drawerGridWrapper,
        children: [
          viewDrawer(config.datagridName, dts),
          ifNode(
            `(status = 'requested' or status = 'fallback_triggered') and refresh_key = 0`,
            element("div", {
              styles: sharedStyles.emptyGrid,
            }),
            dg
          ),
        ],
      }),
    ],
    datagridName: config.datagridName,
    dts,
    columns: baseColumns,
    enableViews: config.toolbar.views,
    idField: config.idField,
    datagridStyles: {
      root: sharedStyles.root,
      row: sharedStyles.row,
      cell: sharedStyles.cell(),
      headerCell: sharedStyles.headerCell(),
      header: sharedStyles.header,
    },
    enableFiltering: config.toolbar.filter,
    pageSize: config.pageSize,
    quickSearchMatchConfig: config.toolbar.search?.matchConfig,
    extraState: config.extraState,
    defaultView: config.defaultView,
  });
  addPage({
    path: config.path,
    content,
  });
}
