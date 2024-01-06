import { iconButton } from "../../components/iconButton";
import { InsertDialogOpts } from "../../components/insertDialog";
import { list, listItem, listItemButton } from "../../components/list";
import { materialIcon } from "../../components/materialIcon";
import { getUniqueUiId } from "../../components/utils";
import { system, BoolEnumLikeConfig, DurationSize, Table } from "../../system";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles } from "../../styleUtils";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import {
  addDatagridRfns,
  BaseColumn,
  datagridBase,
  DefaultView,
} from "./datagridBase";
import { styles as sharedStyles } from "./styles";
import { toolbar } from "./toolbar";
import { viewDrawer } from "./viewDrawer";
import { DomStatements, StateStatementsOrFn } from "../../statements";
import { DgStateHelpers } from "./shared";
import * as yom from "../../yom";
import { FilterTermHelper } from "./filterPopover";
import { lazyPerApp } from "../../utils/memoize";
import { createBounceViewTransition } from "./toolbarPopover";

export interface ToolbarConfig {
  views: boolean;
  hideColumns: boolean;
  filter: boolean;
  sort: boolean;
  delete: boolean;
  export: boolean;
  quickSearch?: (quickSearch: yom.SqlExpression) => yom.SqlExpression;
  add?:
  | { type: "dialog"; opts?: Partial<InsertDialogOpts> }
  | { type: "href"; href: string };
}

export type SortConfig =
  | { type: "string" | "numeric" | "checkbox"; displayName: string }
  | {
    type: "custom";
    displayName: string;
    ascNode: Node;
    descNode: Node;
    ascText: string;
    descText: string;
  };

const stringSortAscNode = `'A → Z'`;
const stringSortDescNode = `'Z → A'`;
const stringSortAscText = stringSortAscNode;
const stringSortDescText = stringSortDescNode;

const numericSortAscNode = `'1 → 9'`;
const numericSortDescNode = `'9 → 1'`;
const numericSortAscText = numericSortAscNode;
const numericSortDescText = numericSortDescNode;

const checkboxStyles = {
  ml: 1,
  display: "inline-flex",
};
const checkboxSortAscNode = lazyPerApp(() =>
  nodes.element("span", {
    styles: checkboxStyles,
    children: [
      materialIcon("CheckBoxOutlined"),
      `' → '`,
      materialIcon("CheckBoxOutlineBlank"),
    ],
  }),
);
const checkboxSortDescNode = lazyPerApp(() =>
  nodes.element("span", {
    styles: checkboxStyles,
    children: [
      materialIcon("CheckBoxOutlineBlank"),
      `' → '`,
      materialIcon("CheckBoxOutlined"),
    ],
  }),
);
const checkboxSortAscText = `'☐ → ✓'`;
const checkboxSortDescText = `'✓ → ☐'`;

function getSortAscNode(sort: SortConfig) {
  switch (sort.type) {
    case "string":
      return stringSortAscNode;
    case "checkbox":
      return checkboxSortAscNode();
    case "numeric":
      return numericSortAscNode;
    case "custom":
      return sort.ascNode;
  }
}

function getSortDescNode(sort: SortConfig) {
  switch (sort.type) {
    case "string":
      return stringSortDescNode;
    case "checkbox":
      return checkboxSortDescNode();
    case "numeric":
      return numericSortDescNode;
    case "custom":
      return sort.descNode;
  }
}

export function getSortAscText(sort: SortConfig) {
  switch (sort.type) {
    case "string":
      return stringSortAscText;
    case "checkbox":
      return checkboxSortAscText;
    case "numeric":
      return numericSortAscText;
    case "custom":
      return sort.ascText;
  }
}

export function getSortDescText(sort: SortConfig) {
  switch (sort.type) {
    case "string":
      return stringSortDescText;
    case "checkbox":
      return checkboxSortDescText;
    case "numeric":
      return numericSortDescText;
    case "custom":
      return sort.descText;
  }
}

export interface SuperGridColumn extends BaseColumn {
  viewStorageName: string;
  columnsDisplayName?: string;
  filterDisplayName?: string;
  filterOptGroup?: string;
  filter?: FilterType;
  sort?: SortConfig;
}

export type FilterType =
  | {
    type:
    | "string"
    | "number"
    | "date"
    | "bool"
    | "timestamp"
    | "minutes_duration";
    notNull: boolean;
  }
  | {
    type: "table";
    table: string;
    notNull: boolean;
  }
  | {
    type: "enum";
    enum: string;
    notNull: boolean;
  }
  | {
    type: "enum_like_bool";
    config: BoolEnumLikeConfig;
    notNull: boolean;
  }
  | {
    type: "custom";
    node?: (helpers: FilterTermHelper, state: DgStateHelpers) => Node;
  };

export function eqFilterType(l: FilterType, r: FilterType) {
  if (l.type !== r.type) {
    return false;
  }
  switch (l.type) {
    case "string":
    case "number":
    case "date":
    case "bool":
    case "timestamp":
    case "minutes_duration":
      return l.notNull === (r as any).notNull;
    case "table":
      return (r as any).table === l.table && l.notNull === (r as any).notNull;
    case "enum":
      return (r as any).enum === l.enum && l.notNull === (r as any).notNull;
    case "enum_like_bool":
      return (r as any).config === l.config && l.notNull === (r as any).notNull;
    case "custom":
      return (r as any).node === l.node;
  }
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
    case "minutes_duration":
      return "minute_duration_eq";
    case "custom":
      return "custom";
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
  columnDialog: (app, name: string) => {
    createBounceViewTransition(app, name, "top right");
    return {
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
      viewTransitionName: name,
    };
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
  state: DgStateHelpers,
  i: number,
  startFixedColumns: number,
  sort: SortConfig | undefined,
) {
  function updateBetweenColumns(before: string, after: string) {
    return new DomStatements().modify(
      `update ui.column set ordering = ordering.new(${before}, ${after}) where id = ${i}`,
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
            `update ui.column set sort_index = sort_index + 1 where sort_index is not null`,
          )
          .modify(
            `update ui.column set sort_index = 0, sort_asc = ${asc} where id = ${i}`,
          ),
    });
  }
  return [
    iconButton({
      variant: "plain",
      color: "neutral",
      size: "sm",
      props: { id: `${popoverId} || '-${i}'`, tabIndex: "-1" },
      on: {
        click: (s) =>
          s
            .setScalar(
              `ui.open_column_dialog`,
              `case when ui.open_column_dialog = ${i} then null else ${i} end`,
            )
            .stopPropagation()
            .triggerViewTransition("immediate"),
      },
      ariaLabel: `'Open column menu'`,
      children: materialIcon({
        fontSize: "md",
        name: "MoreVert",
      }),
    }),
    nodes.if(
      `ui.open_column_dialog = ${i}`,
      list({
        styles: styles.columnDialog(`col-pop-${i}`),
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
          clickAway: (s) =>
            s
              .setScalar(`ui.open_column_dialog`, `null`)
              .triggerViewTransition("immediate"),
        },
        children: [
          sort
            ? [
              listItem({
                on: {
                  click: (s) =>
                    s.statements(setColumnSort(true), state.triggerRefresh),
                },
                children: listItemButton({
                  variant: "plain",
                  color: "neutral",
                  children: ["'Sort '", getSortAscNode(sort)],
                }),
              }),
              listItem({
                on: {
                  click: (s) =>
                    s.statements(setColumnSort(false), state.triggerRefresh),
                },
                children: listItemButton({
                  variant: "plain",
                  color: "neutral",
                  children: ["'Sort '", getSortDescNode(sort)],
                }),
              }),
            ]
            : undefined,
          listItem({
            on: {
              click: (s) =>
                s.modify(
                  `update ui.column set displaying = false where id = ${i}`,
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
                    `(select min(ordering) from ui.column where ordering > (select ordering from ui.column where id = ${i}))`,
                  )
                  .if(`next_col is null`, (s) => s.return())
                  .statements(
                    updateBetweenColumns(
                      `next_col`,
                      `(select min(ordering) from ui.column where ordering > next_col)`,
                    ),
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
                    `(select ordering from ui.column where id = ${i})`,
                  )
                  .scalar(
                    `prev_col`,
                    `(select max(ordering) from ui.column where ordering < current_col)`,
                  )
                  .if(
                    `prev_col is null or (select count(*) from column where ordering < current_col) <= ${startFixedColumns + 1
                    }`,
                    (s) => s.return(),
                  )
                  .statements(
                    updateBetweenColumns(
                      `(select max(ordering) from ui.column where ordering < prev_col)`,
                      `prev_col`,
                    ),
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
                `null`,
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
                getColumnN(startFixedColumns + 1),
              ),
            },
            children: listItemButton({
              variant: "plain",
              color: "neutral",
              children: "'Move to start'",
            }),
          }),
        ],
      }),
    ),
  ];
}

export interface SuperGridDts {
  idToColumnsDisplayName: string;
  idToSortDisplayName: string;
  idToFilterDisplayName: string;
  idToDefaultOp: string;
}

/**
 * Create decision tables that help handle the query generation for the datagrid.
 */
function addSupergridDatagridDts(
  datagridName: string,
  columns: SuperGridColumn[],
): SuperGridDts {
  const columnsDisplayName: string[][] = [];
  const sortDisplayName: string[][] = [];
  const filterDisplayName: string[][] = [];
  const defaultOps: string[][] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.columnsDisplayName) {
      columnsDisplayName.push([
        i.toString(),
        stringLiteral(col.columnsDisplayName),
      ]);
    }
    if (col.sort) {
      sortDisplayName.push([i.toString(), stringLiteral(col.sort.displayName)]);
    }
    if (col.filterDisplayName) {
      filterDisplayName.push([
        i.toString(),
        stringLiteral(col.filterDisplayName),
      ]);
    }
    if (col.filter) {
      const op = defaultOpForFieldType(col.filter);
      defaultOps.push([
        i.toString(),
        "cast(" + stringLiteral(op) + "as enums.dg_filter_op)",
      ]);
    }
  }
  const idToColumnsDisplayName = `${datagridName}_dg_col_id_to_columns_display_name`;
  system.addRuleFunction({
    parameters: [{ name: "id", type: "SmallUint" }],
    header: ["input.id", "display_name"],
    rules: columnsDisplayName,
    name: idToColumnsDisplayName,
    returnType: "String",
  });
  const idToDefaultOp = `${datagridName}_dg_col_id_to_op`;
  system.addRuleFunction({
    parameters: [{ name: "id", type: "SmallUint" }],
    header: ["input.id", "op"],
    rules: defaultOps,
    name: idToDefaultOp,
    returnType: { type: "Enum", enum: "dg_filter_op" },
  });
  const idToSortDisplayName = `${datagridName}_dg_col_id_to_sort_display_name`;
  system.addRuleFunction({
    parameters: [{ name: "id", type: "SmallUint" }],
    header: ["input.id", "display_name"],
    rules: sortDisplayName,
    name: idToSortDisplayName,
    returnType: "String",
  });
  const idToFilterDisplayName = `${datagridName}_dg_col_id_to_filter_display_name`;
  system.addRuleFunction({
    parameters: [{ name: "id", type: "SmallUint" }],
    header: ["input.id", "display_name"],
    rules: filterDisplayName,
    name: idToFilterDisplayName,
    returnType: "String",
  });
  return {
    idToDefaultOp,
    idToColumnsDisplayName,
    idToFilterDisplayName,
    idToSortDisplayName,
  };
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
  const superDts = addSupergridDatagridDts(config.datagridName, config.columns);
  const dts = addDatagridRfns(config.datagridName, config.columns);
  return datagridBase({
    source: "db." + ident(config.tableModel.name),
    children: (dg, state) => [
      nodes.sourceMap(
        "datagrid toolbar",
        toolbar(
          state,
          config.toolbar,
          config.columns,
          dts,
          superDts,
          config.tableModel,
        ),
      ),
      nodes.state({
        procedure: (s) => s.scalar(`show_query_err`, `false`),
        children: [
          nodes.eventHandlers({
            document: {
              keydown: (s) =>
                s.if(`event.meta_key and event.key = 'v'`, (s) =>
                  s.setScalar(`show_query_err`, `not show_query_err`),
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
            }),
          ),
        ],
      }),
      nodes.element("div", {
        styles: styles.drawerGridWrapper,
        children: [
          viewDrawer(config.datagridName, dts),
          nodes.if({
            condition: `(status = 'requested' or status = 'fallback_triggered') and dg_refresh_key = 0`,
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
    columns: config.columns,
    enableViews: config.toolbar.views,
    idField: config.idField,
    datagridStyles: {
      root: sharedStyles.root(),
      row: sharedStyles.row,
      cell: sharedStyles.cell(),
      headerCell: sharedStyles.headerCell(),
      header: sharedStyles.header,
    },
    enableFiltering: config.toolbar.filter,
    pageSize: config.pageSize,
    additionalWhere: config.toolbar.quickSearch?.(`ui.quick_search_query`),
    extraState: (s) => {
      s.scalar("open_column_dialog", { type: "Int" }).statements(
        config.extraState,
      );
      if (config.toolbar.quickSearch) {
        s.scalar("ui.quick_search_query", "''");
      }
    },
    defaultView: config.defaultView,
  });
}
