import { element, ifNode, state } from "../../nodeHelpers";
import {
  commitTransaction,
  debugExpr,
  dynamicQuery,
  if_,
  modify,
  scalar,
  serviceProc,
  setScalar,
  startTransaction,
  stopPropagation,
} from "../../procHelpers";
import { downcaseFirst, pluralize } from "../../utils/inflectors";
import { alert } from "../../components/alert";
import { button } from "../../components/button";
import { circularProgress } from "../../components/circularProgress";
import { divider } from "../../components/divider";
import { iconButton } from "../../components/iconButton";
import { input } from "../../components/input";
import { materialIcon } from "../../components/materialIcon";
import { typography } from "../../components/typography";
import { columnsPopover as columnsPopover } from "./columnsPopover";
import { filterPopover } from "./filterPopover";
import { sortPopover as sortPopover } from "./sortPopover";
import { triggerQueryRefresh } from "./shared";
import { toolbarPopover } from "./toolbarPopover";
import { confirmDangerDialog } from "../../components/confirmDangerDialog";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { getUniqueUiId } from "../../components/utils";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { SuperGridColumn, SuperGridDts, ToolbarConfig } from "./styledDatagrid";
import { DatagridDts, makeCountQuery, makeIdsQuery } from "./datagridBase";
import { Table } from "../../app";
import { select } from "../../components/select";
import { Node } from "../../nodeTypes";
import { insertDialog } from "../../components/insertDialog";

const columnsButtonId = stringLiteral(getUniqueUiId());
const sortButtonId = stringLiteral(getUniqueUiId());
const filterButtonId = stringLiteral(getUniqueUiId());

const styles = createStyles({
  toolbarWrapper: {
    overflowX: "auto",
    flexShrink: 0,
  },
  toolbar: {
    px: 1,
    my: 0.5,
    gap: 1,
    md: {
      gap: 2,
      px: 2,
      my: 1,
    },
    display: "flex",
    alignItems: "center",
    width: "100%",
    "& > *": {
      flexShrink: 0,
    },
  },
  skeletonLeft: {
    backgroundColor: "neutral-soft-hover-bg",
    width: 80,
    borderRadius: "sm",
    my: 0.5,
    height: 32,
  },
  skeletonRight: {
    backgroundColor: "neutral-soft-hover-bg",
    width: 200,
    height: 32,
    borderRadius: "sm",
    my: 0.5,
    ml: 0.5,
  },
});

export function toolbar(
  toolbar: ToolbarConfig,
  columns: SuperGridColumn[],
  baseDts: DatagridDts,
  superDts: SuperGridDts,
  tableModel: Table,
  matchConfig: string | undefined
) {
  let addButton: Node | undefined;
  if (toolbar.add?.type === "href") {
    addButton = iconButton({
      variant: "soft",
      color: "primary",
      size: "sm",
      children: materialIcon("Add"),
      href: stringLiteral(toolbar.add.href),
    });
  } else if (toolbar.add?.type === "dialog") {
    const withValues: Record<string, string> =
      toolbar.add.opts?.withValues ?? {};
    addButton = state({
      procedure: [scalar(`adding`, `false`)],
      children: [
        iconButton({
          variant: "soft",
          color: "primary",
          size: "sm",
          children: materialIcon("Add"),
          on: { click: [setScalar(`adding`, `true`)] },
        }),
        insertDialog({
          ...toolbar.add.opts,
          table: tableModel.name,
          open: `adding`,
          onClose: [setScalar(`adding`, `false`)],
          content: {
            type: "AutoLabelOnLeft",
            ignoreFields: Object.keys(withValues),
          },
          afterTransactionCommit: (state) => [
            ...((toolbar.add as any).opts?.afterTransactionCommit?.(state) ??
              []),
            triggerQueryRefresh(),
          ],
        }),
      ],
    });
  }
  return element("div", {
    styles: styles.toolbarWrapper,
    children: element("div", {
      styles: styles.toolbar,
      children: [
        toolbar.views
          ? [
              button({
                variant: "plain",
                color: "neutral",
                size: "sm",
                children: `'Views'`,
                startDecorator: materialIcon("Menu"),
                on: {
                  click: [
                    setScalar("ui.view_drawer_open", "not ui.view_drawer_open"),
                  ],
                },
              }),
              divider({ orientation: "vertical" }),
            ]
          : null,
        ifNode(
          `(status = 'requested' or status = 'fallback_triggered') and dg_refresh_key = 0`,
          [
            element("div", {
              styles: styles.skeletonLeft,
            }),
            element("div", {
              styles: styles.skeletonRight,
            }),
          ],
          [
            toolbar.hideColumns || toolbar.filter || toolbar.sort
              ? state({
                  procedure: [
                    toolbar.hideColumns
                      ? scalar(`columns_dialog_open`, `false`)
                      : null,
                    toolbar.filter
                      ? scalar(`filter_dialog_open`, `false`)
                      : null,
                    toolbar.sort ? scalar(`sort_dialog_open`, `false`) : null,
                  ],
                  children: [
                    toolbar.hideColumns
                      ? [
                          button({
                            variant: "plain",
                            color: "neutral",
                            size: "sm",
                            props: { id: columnsButtonId },
                            children: `case 
                when (select count(*) from column where not displaying) = 0 then 'Columns' 
                when (select count(*) from column where not displaying) = 1 then '1 hidden column'
                else (select count(*) from column where not displaying) || ' hidden columns'
                end`,
                            startDecorator: materialIcon(
                              "VisibilityOffOutlined"
                            ),
                            on: {
                              click: [
                                toolbar.filter
                                  ? setScalar(`ui.filter_dialog_open`, `false`)
                                  : null,
                                toolbar.sort
                                  ? setScalar(`ui.sort_dialog_open`, `false`)
                                  : null,
                                setScalar(
                                  `ui.columns_dialog_open`,
                                  `not ui.columns_dialog_open`
                                ),
                                stopPropagation(),
                              ],
                            },
                          }),
                          toolbarPopover({
                            openScalar: "ui.columns_dialog_open",
                            buttonId: columnsButtonId,
                            children: columnsPopover(superDts),
                          }),
                        ]
                      : null,
                    toolbar.filter
                      ? [
                          button({
                            variant: "plain",
                            color: "neutral",
                            size: "sm",
                            props: { id: filterButtonId },
                            startDecorator: materialIcon("FilterAltOutlined"),
                            children: `case
                              when (select count(column_id) from filter_term) = 0 then 'Filter'
                              when (select count(distinct column_id) from filter_term) = 1 then 'Filtered by 1 field'
                              else 'Filtered by ' || (select count(distinct column_id) from filter_term) || ' fields'
                            end`,
                            on: {
                              click: [
                                setScalar(`ui.columns_dialog_open`, `false`),
                                setScalar(`ui.sort_dialog_open`, `false`),
                                setScalar(
                                  `ui.filter_dialog_open`,
                                  `not ui.filter_dialog_open`
                                ),
                                stopPropagation(),
                              ],
                            },
                          }),
                          toolbarPopover({
                            openScalar: `ui.filter_dialog_open`,
                            buttonId: filterButtonId,
                            children: filterPopover(columns, superDts),
                          }),
                        ]
                      : null,
                    toolbar.sort
                      ? [
                          button({
                            variant: "plain",
                            color: "neutral",
                            size: "sm",
                            props: { id: sortButtonId },
                            startDecorator: materialIcon("SwapVert"),
                            children: `case 
                when (select count(*) from column where sort_index is not null) = 0 then 'Sort' 
                when (select count(*) from column where sort_index is not null) = 1 then 'Sorted by 1 field'
                else 'Sorted by ' || (select count(*) from column where sort_index is not null) || ' fields'
                end`,
                            on: {
                              click: [
                                setScalar(`ui.filter_dialog_open`, `false`),
                                setScalar(`ui.columns_dialog_open`, `false`),
                                setScalar(
                                  `ui.sort_dialog_open`,
                                  `not ui.sort_dialog_open`
                                ),
                                stopPropagation(),
                              ],
                            },
                          }),
                          toolbarPopover({
                            openScalar: `ui.sort_dialog_open`,
                            buttonId: sortButtonId,
                            children: sortPopover(columns),
                          }),
                        ]
                      : null,
                  ],
                })
              : null,

            select({
              slots: { select: { props: { value: `row_height` } } },
              on: {
                change: [
                  setScalar(`row_height`, `cast(target_value as bigint)`),
                ],
              },
              children: [
                element("option", {
                  props: { value: `44` },
                  children: `'Short Rows'`,
                }),
                element("option", {
                  props: { value: `56` },
                  children: `'Medium Rows'`,
                }),
                element("option", {
                  props: { value: `88` },
                  children: `'Tall Rows'`,
                }),
                element("option", {
                  props: { value: `128` },
                  children: `'Extra Tall Rows'`,
                }),
              ],
              size: "sm",
              variant: "plain",
              color: "neutral",
            }),
            ifNode(
              `status = 'fallback_triggered' and dg_refresh_key != 0`,
              typography({
                startDecorator: circularProgress({ size: "sm" }),
                level: "body2",
                children: ifNode(
                  `row_count = 100`,
                  `'Reloading...'`,
                  `'Loading more rows...'`
                ),
              })
            ),
            ifNode(
              `saving_edit`,
              typography({
                startDecorator: circularProgress({ size: "sm" }),
                level: "body2",
                children: `'Saving change...'`,
              })
            ),
            ifNode(
              `display_error_message is not null`,
              alert({
                startDecorator: materialIcon("Report"),
                size: "sm",
                color: "danger",
                variant: "solid",
                children: `display_error_message`,
              })
            ),
            ifNode(
              `status = 'failed'`,
              alert({
                startDecorator: materialIcon("Report"),
                size: "sm",
                color: "danger",
                variant: "solid",
                children: `'Failed to load data'`,
              })
            ),
            element("div", { styles: flexGrowStyles }),
            toolbar.delete
              ? state({
                  procedure: [scalar(`deleting`, `false`)],
                  children: [
                    iconButton({
                      size: "sm",
                      color: "danger",
                      variant: "soft",
                      children: materialIcon("DeleteOutlined"),
                      on: { click: [setScalar(`deleting`, `true`)] },
                    }),
                    confirmDangerDialog({
                      open: `deleting`,
                      onClose: [setScalar(`deleting`, `false`)],
                      description: element("span", {
                        children: [
                          `'Are you sure you want to delete '`,
                          ifNode(
                            `selected_all`,
                            state({
                              procedure: [
                                dynamicQuery({
                                  query: makeCountQuery(
                                    baseDts,
                                    `db.` + ident(tableModel.name),
                                    matchConfig
                                  ),
                                  columnCount: 1,
                                  resultTable: `dyn_count`,
                                }),
                              ],
                              children: `(select field_0 from dyn_count)`,
                            }),
                            `(select count(*) from selected_row)`
                          ),
                          `' records?'`,
                        ],
                      }),
                      onConfirm: (closeModal) => [
                        serviceProc([
                          startTransaction(),
                          if_(
                            `selected_all`,
                            [
                              dynamicQuery({
                                query: makeIdsQuery(
                                  baseDts,
                                  `db.` + ident(tableModel.name),
                                  matchConfig
                                ),
                                columnCount: 1,
                                resultTable: `ids`,
                              }),
                              modify(
                                `delete from db.${ident(
                                  tableModel.name
                                )} where id in (select cast(field_0 as bigint) from ids)`
                              ),
                            ],
                            [
                              modify(
                                `delete from db.${ident(
                                  tableModel.name
                                )} where id in (select id from ui.selected_row)`
                              ),
                            ]
                          ),
                          commitTransaction(),
                          triggerQueryRefresh(),
                        ]),
                        ...closeModal,
                      ],
                    }),
                  ],
                })
              : null,
            // toolbar.export
            //   ? button({
            //     size: "sm",
            //     variant: "soft",
            //     color: "neutral",
            //     children: `'Export'`,
            //     on: {
            //       click: [
            //         scalar(`csv`, { type: "String", maxLength: 65000 }),
            //         serviceProc([
            //           dynamicQueryToCsv(makeDownloadQuery(config), `query_csv`),
            //           setScalar(`csv`, `query_csv`),
            //         ]),
            //         download(`'grid.csv'`, `csv`),
            //       ],
            //     },
            //   })
            //   : null,
            toolbar.search &&
              input({
                variant: "outlined",
                color: "neutral",
                startDecorator: materialIcon("Search"),
                size: "sm",
                slots: {
                  input: {
                    props: {
                      value: "quick_search_query",
                      placeholder: `'Search ${downcaseFirst(
                        pluralize(tableModel.displayName)
                      )}'`,
                    },
                  },
                },
                on: {
                  input: [
                    setScalar("ui.quick_search_query", "target_value"),
                    triggerQueryRefresh(),
                  ],
                },
              }),
            addButton,
          ]
        ),
      ],
    }),
  });
}
