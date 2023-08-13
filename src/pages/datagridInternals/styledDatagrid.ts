import { iconButton } from "../../components/iconButton";
import { InsertDialogOpts } from "../../components/insertDialog";
import { list, listItem, listItemButton } from "../../components/list";
import { materialIcon } from "../../components/materialIcon";
import { getUniqueUiId } from "../../components/utils";
import { app, BoolEnumLikeConfig, DurationSize, Table } from "../../app";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles } from "../../styleUtils";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { StateStatement } from "../../yom";
import {
  addDatagridDts,
  BaseColumn,
  BaseColumnQueryGeneration,
  datagridBase,
  DefaultView,
} from "./datagridBase";
import { styles as sharedStyles } from "./styles";
import { toolbar } from "./toolbar";
import { Cell, ColumnEventHandlers } from "./types";
import { viewDrawer } from "./viewDrawer";
import { triggerQueryRefresh } from "./shared";
import {
  DomStatements,
  StateStatements,
  StateStatementsOrFn,
} from "../../statements";

export interface ToolbarConfig {
  views: boolean;
  hideColumns: boolean;
  filter: boolean;
  sort: boolean;
  delete: boolean;
  export: boolean;
  search?: { matchConfig: string };
  add?:
    | { type: "dialog"; opts?: Partial<InsertDialogOpts> }
    | { type: "href"; href: string };
}

export interface SortConfig {
  ascNode: Node;
  descNode: Node;
  ascText: string;
  descText: string;
}

export interface FilterConfig {
  type: FilterType;
  notNull: boolean;
}

export interface SuperGridColumn extends ColumnEventHandlers {
  queryGeneration?: BaseColumnQueryGeneration;
  viewStorageName: string;
  displayName?: string;
  initialWidth: number;
  initiallyDisplaying: boolean;
  header: Node;
  filter?: FilterConfig;
  sort?: SortConfig;
  cell: Cell;
}

export type FilterType =
  | { type: "string" | "number" | "date" | "bool" | "timestamp" }
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
    case "timestamp":
      return "timestamp_eq";
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

const popoverId = stringLiteral(getUniqueUiId());

export function columnPopover(
  i: number,
  startFixedColumns: number,
  sort: SortConfig | undefined
) {
  function updateBetweenColumns(before: string, after: string) {
    return new DomStatements().modify(
      `update ui.column set ordering = ordering.new(${before}, ${after}) where id = ${i}`
    );
  }
  function getColumnN(n: number) {
    return `(select ordering from ui.column order by ordering offset ${n} limit 1)`;
  }
  function setColumnSort(asc: boolean) {
    return new DomStatements().if({
      condition: `exists (select 1 from ui.column where sort_index is not null and id = ${i})`,
      then: (s) =>
        s.modify(`update ui.column set sort_asc = ${asc} where id = ${i}`),
      else: (s) =>
        s
          .modify(
            `update ui.column set sort_index = sort_index + 1 where sort_index is not null`
          )
          .modify(
            `update ui.column set sort_index = 0, sort_asc = ${asc} where id = ${i}`
          ),
    });
  }
  return nodes.state({
    procedure: (s) => s.scalar("dialog_open", "false"),
    children: [
      iconButton({
        variant: "plain",
        color: "neutral",
        size: "sm",
        props: { id: `${popoverId} || '-${i}'`, tabIndex: "-1" },
        on: {
          click: (s) => s.setScalar(`ui.dialog_open`, `true`),
        },
        children: materialIcon({
          fontSize: "md",
          name: "MoreVert",
        }),
      }),
      nodes.if(
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
            clickAway: (s) => s.setScalar(`ui.dialog_open`, `false`),
          },
          children: [
            sort
              ? [
                  listItem({
                    on: {
                      click: (s) =>
                        s.statements(
                          setColumnSort(true),
                          triggerQueryRefresh()
                        ),
                    },
                    children: listItemButton({
                      variant: "plain",
                      color: "neutral",
                      children: ["'Sort '", sort.ascNode],
                    }),
                  }),
                  listItem({
                    on: {
                      click: (s) =>
                        s.statements(
                          setColumnSort(false),
                          triggerQueryRefresh()
                        ),
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
                click: (s) =>
                  s.modify(
                    `update ui.column set displaying = false where id = ${i}`
                  ),
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Hide Field'",
              }),
            }),
            listItem({
              on: {
                click: (s) =>
                  s
                    .scalar(
                      `next_col`,
                      `(select min(ordering) from ui.column where ordering > (select ordering from ui.column where id = ${i}))`
                    )
                    .if(`next_col is null`, (s) => s.return())
                    .statements(
                      updateBetweenColumns(
                        `next_col`,
                        `(select min(ordering) from ui.column where ordering > next_col)`
                      )
                    ),
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Move right'",
              }),
            }),
            listItem({
              on: {
                click: (s) =>
                  s
                    .scalar(
                      `current_col`,
                      `(select ordering from ui.column where id = ${i})`
                    )
                    .scalar(
                      `prev_col`,
                      `(select max(ordering) from ui.column where ordering < current_col)`
                    )
                    .if(
                      `prev_col is null or (select count(*) from column where ordering < current_col) <= ${
                        startFixedColumns + 1
                      }`,
                      (s) => s.return()
                    )
                    .statements(
                      updateBetweenColumns(
                        `(select max(ordering) from ui.column where ordering < prev_col)`,
                        `prev_col`
                      )
                    ),
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Move left'",
              }),
            }),
            listItem({
              on: {
                click: updateBetweenColumns(
                  `(select max(ordering) from ui.column)`,
                  `null`
                ),
              },
              children: listItemButton({
                variant: "plain",
                color: "neutral",
                children: "'Move to end'",
              }),
            }),
            listItem({
              on: {
                click: updateBetweenColumns(
                  getColumnN(startFixedColumns),
                  getColumnN(startFixedColumns + 1)
                ),
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
  app.addDecisionTable({
    parameters: [{ name: "id", type: "SmallUint" }],
    csv: `input.id,display_name\n` + displayNames.join("\n"),
    name: idToDisplayName,
    output: { name: "display_name", type: "String" },
  });
  const idToDefaultOp = `${datagridName}_dg_col_id_to_op`;
  app.addDecisionTable({
    parameters: [{ name: "id", type: "SmallUint" }],
    csv: `input.id,op\n` + defaultOps.join("\n"),
    name: idToDefaultOp,
    output: { name: "op", type: { type: "Enum", enum: "dg_filter_op" } },
  });
  return { idToDefaultOp, idToDisplayName };
}

export interface StyledDatagridConfig {
  datagridName: string;
  tableModel: Table;
  toolbar: ToolbarConfig;
  columns: SuperGridColumn[];
  idField: string;
  pageSize: number;
  extraState?: StateStatementsOrFn;
  defaultView?: DefaultView;
}

export function styledDatagrid(config: StyledDatagridConfig) {
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
  return datagridBase({
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
      nodes.state({
        procedure: (s) => s.scalar(`show_query_err`, `false`),
        children: [
          nodes.eventHandlers({
            document: {
              keydown: (s) =>
                s.if(`event.meta_key and event.key = 'v'`, (s) =>
                  s.setScalar(`show_query_err`, `not show_query_err`)
                ),
            },
          }),
          nodes.if(
            `show_query_err`,
            nodes.element("div", {
              styles: styles.queryError,
              children: [
                nodes.element("p", {
                  children: `dg_error.message`,
                }),
                nodes.element("p", {
                  children: `dg_error.description`,
                }),
              ],
            })
          ),
        ],
      }),
      nodes.element("div", {
        styles: styles.drawerGridWrapper,
        children: [
          viewDrawer(config.datagridName, dts),
          nodes.if({
            expr: `(status = 'requested' or status = 'fallback_triggered') and dg_refresh_key = 0`,
            then: nodes.element("div", {
              styles: sharedStyles.emptyGrid,
            }),
            else: dg,
          }),
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
}
