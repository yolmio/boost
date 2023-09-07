import { nodes } from "../../nodeHelpers";
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
import { toolbarPopover } from "./toolbarPopover";
import { confirmDangerDialog } from "../../components/confirmDangerDialog";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { getUniqueUiId } from "../../components/utils";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { SuperGridColumn, SuperGridDts, ToolbarConfig } from "./styledDatagrid";
import { DatagridRfns, makeCountQuery, makeIdsQuery } from "./datagridBase";
import { Table } from "../../app";
import { select } from "../../components/select";
import { Node } from "../../nodeTypes";
import { insertDialog } from "../../components/insertDialog";
import { DgStateHelpers } from "./shared";
import * as yom from "../../yom";

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
  state: DgStateHelpers,
  toolbar: ToolbarConfig,
  columns: SuperGridColumn[],
  baseDts: DatagridRfns,
  superDts: SuperGridDts,
  tableModel: Table,
  additionalWhere?: yom.SqlExpression
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
    addButton = nodes.state({
      procedure: (s) => s.scalar(`adding`, `false`),
      children: [
        iconButton({
          variant: "soft",
          color: "primary",
          size: "sm",
          children: materialIcon("Add"),
          on: { click: (s) => s.setScalar(`adding`, `true`) },
        }),
        insertDialog({
          ...toolbar.add.opts,
          table: tableModel.name,
          open: `adding`,
          onClose: (s) => s.setScalar(`adding`, `false`),
          content: {
            type: "AutoLabelOnLeft",
            ignoreFields: Object.keys(withValues),
          },
          afterTransactionCommit: (formState, s) => {
            (toolbar.add as any).opts?.afterTransactionCommit?.(formState, s);
            s.statements(state.triggerRefresh);
          },
        }),
      ],
    });
  }
  return nodes.element("div", {
    styles: styles.toolbarWrapper,
    children: nodes.element("div", {
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
                  click: (s) =>
                    s.setScalar(
                      "ui.view_drawer_open",
                      "not ui.view_drawer_open"
                    ),
                },
              }),
              divider({ orientation: "vertical" }),
            ]
          : null,
        nodes.if({
          condition: `(status = 'requested' or status = 'fallback_triggered') and dg_refresh_key = 0`,
          then: [
            nodes.element("div", {
              styles: styles.skeletonLeft,
            }),
            nodes.element("div", {
              styles: styles.skeletonRight,
            }),
          ],
          else: [
            toolbar.hideColumns || toolbar.filter || toolbar.sort
              ? nodes.state({
                  procedure: (s) => {
                    if (toolbar.hideColumns) {
                      s.scalar(`columns_dialog_open`, `false`);
                    }
                    if (toolbar.filter) {
                      s.scalar(`filter_dialog_open`, `false`);
                    }
                    if (toolbar.sort) {
                      s.scalar(`sort_dialog_open`, `false`);
                    }
                  },
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
                              click: (s) => {
                                if (toolbar.filter) {
                                  s.setScalar(`filter_dialog_open`, `false`);
                                }
                                if (toolbar.sort) {
                                  s.setScalar(`sort_dialog_open`, `false`);
                                }
                                s.setScalar(
                                  `columns_dialog_open`,
                                  `not columns_dialog_open`
                                ).stopPropagation();
                              },
                            },
                          }),
                          toolbarPopover({
                            openScalar: "ui.columns_dialog_open",
                            buttonId: columnsButtonId,
                            children: columnsPopover(state, superDts),
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
                              click: (s) => {
                                if (toolbar.hideColumns) {
                                  s.setScalar(`columns_dialog_open`, `false`);
                                }
                                if (toolbar.sort) {
                                  s.setScalar(`sort_dialog_open`, `false`);
                                }
                                s.setScalar(
                                  `filter_dialog_open`,
                                  `not filter_dialog_open`
                                ).stopPropagation();
                              },
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
                              click: (s) => {
                                if (toolbar.hideColumns) {
                                  s.setScalar(`columns_dialog_open`, `false`);
                                }
                                if (toolbar.filter) {
                                  s.setScalar(`filter_dialog_open`, `false`);
                                }
                                s.setScalar(
                                  `sort_dialog_open`,
                                  `not sort_dialog_open`
                                ).stopPropagation();
                              },
                            },
                          }),
                          toolbarPopover({
                            openScalar: `ui.sort_dialog_open`,
                            buttonId: sortButtonId,
                            children: sortPopover(state, columns),
                          }),
                        ]
                      : null,
                  ],
                })
              : null,

            select({
              slots: { select: { props: { value: `row_height` } } },
              on: {
                change: (s) =>
                  s.setScalar(`row_height`, `cast(target_value as bigint)`),
              },
              children: [
                nodes.element("option", {
                  props: { value: `44` },
                  children: `'Short Rows'`,
                }),
                nodes.element("option", {
                  props: { value: `56` },
                  children: `'Medium Rows'`,
                }),
                nodes.element("option", {
                  props: { value: `88` },
                  children: `'Tall Rows'`,
                }),
                nodes.element("option", {
                  props: { value: `128` },
                  children: `'Extra Tall Rows'`,
                }),
              ],
              size: "sm",
              variant: "plain",
              color: "neutral",
            }),
            nodes.if(
              `status = 'fallback_triggered' and dg_refresh_key != 0`,
              typography({
                startDecorator: circularProgress({ size: "sm" }),
                level: "body2",
                children: nodes.if({
                  condition: `row_count = 100`,
                  then: `'Reloading...'`,
                  else: `'Loading more rows...'`,
                }),
              })
            ),
            nodes.if(
              `saving_edit`,
              typography({
                startDecorator: circularProgress({ size: "sm" }),
                level: "body2",
                children: `'Saving change...'`,
              })
            ),
            nodes.if(
              `display_error_message is not null`,
              alert({
                startDecorator: materialIcon("Report"),
                size: "sm",
                color: "danger",
                variant: "solid",
                children: `display_error_message`,
              })
            ),
            nodes.if(
              `status = 'failed'`,
              alert({
                startDecorator: materialIcon("Report"),
                size: "sm",
                color: "danger",
                variant: "solid",
                children: `'Failed to load data'`,
              })
            ),
            nodes.element("div", { styles: flexGrowStyles }),
            toolbar.delete
              ? nodes.state({
                  procedure: (s) => s.scalar(`deleting`, `false`),
                  children: [
                    iconButton({
                      size: "sm",
                      color: "danger",
                      variant: "soft",
                      children: materialIcon("DeleteOutlined"),
                      on: { click: (s) => s.setScalar(`deleting`, `true`) },
                    }),
                    confirmDangerDialog({
                      open: `deleting`,
                      onClose: (s) => s.setScalar(`deleting`, `false`),
                      description: nodes.element("span", {
                        children: [
                          `'Are you sure you want to delete '`,
                          nodes.if({
                            condition: `selected_all`,
                            then: nodes.state({
                              procedure: (s) =>
                                s.dynamicQuery({
                                  query: makeCountQuery(
                                    baseDts,
                                    `db.` + ident(tableModel.name),
                                    additionalWhere
                                  ),
                                  columnCount: 1,
                                  resultTable: `dyn_count`,
                                }),
                              children: `(select field_0 from dyn_count)`,
                            }),
                            else: `(select count(*) from selected_row)`,
                          }),
                          `' records?'`,
                        ],
                      }),
                      onConfirm: (closeModal) => (s) =>
                        s
                          .serviceProc((s) =>
                            s
                              .startTransaction()
                              .if({
                                condition: `selected_all`,
                                then: (s) =>
                                  s
                                    .dynamicQuery({
                                      query: makeIdsQuery(
                                        baseDts,
                                        `db.` + ident(tableModel.name),
                                        additionalWhere
                                      ),
                                      columnCount: 1,
                                      resultTable: `ids`,
                                    })
                                    .modify(
                                      `delete from db.${ident(
                                        tableModel.name
                                      )} where id in (select cast(field_0 as bigint) from ids)`
                                    ),
                                else: (s) =>
                                  s.modify(
                                    `delete from db.${ident(
                                      tableModel.name
                                    )} where id in (select id from ui.selected_row)`
                                  ),
                              })
                              .commitTransaction()
                              .statements(state.triggerRefresh)
                          )
                          .statements(closeModal),
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
            toolbar.quickSearch &&
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
                  input: (s) =>
                    s
                      .setScalar("ui.quick_search_query", "target_value")
                      .statements(state.triggerRefresh),
                },
              }),
            addButton,
          ],
        }),
      ],
    }),
  });
}
