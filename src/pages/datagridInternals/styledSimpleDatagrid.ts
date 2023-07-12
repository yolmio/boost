import { alert } from "../../components/alert.js";
import { confirmDangerDialog } from "../../components/confirmDangerDialog.js";
import { iconButton } from "../../components/iconButton.js";
import {
  insertDialog,
  InsertDialogOpts,
} from "../../components/insertDialog.js";
import { materialIcon } from "../../components/materialIcon.js";
import { typography } from "../../components/typography.js";
import { Authorization, Table } from "../../modelTypes.js";
import { element, ifNode, sourceMap, state } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import {
  commitTransaction,
  if_,
  modify,
  scalar,
  serviceProc,
  setScalar,
  startTransaction,
} from "../../procHelpers.js";
import { createStyles, flexGrowStyles } from "../../styleUtils.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { StateStatement } from "../../yom.js";
import {
  getCountQuery,
  SimpleBaseColumn,
  SimpleBaseColumnQueryGeneration,
  simplDatagridBase,
} from "./simpleDatgridBase.js";
import { styles as sharedStyles } from "./styles.js";
import { triggerQueryRefresh } from "./shared.js";
import { Cell, ColumnEventHandlers, RowHeight } from "./types.js";
import { circularProgress } from "../../components/circularProgress.js";

export interface ToolbarConfig {
  header: Node;
  delete: boolean;
  export: boolean;
  search?: { matchConfig: string };
  add?:
    | { type: "dialog"; opts?: Partial<InsertDialogOpts> }
    | { type: "href"; href: string };
}

export interface SimpleColumn extends ColumnEventHandlers {
  queryGeneration?: SimpleBaseColumnQueryGeneration;
  width: number;
  header: Node;
  cell: Cell;
}

export interface StyledSimpleGridConfig {
  tableModel: Table;
  toolbar: ToolbarConfig;
  columns: SimpleColumn[];
  idField: string;
  pageSize?: number;
  extraState?: StateStatement[];
  auth?: Authorization;
  sourceMapName?: string;
  rowHeight?: RowHeight;
}

const styles = createStyles({
  toolbar: {
    display: "flex",
    px: 2,
    py: 1,
    gap: 1,
    alignItems: "baseline",
  },
});

export function styledSimpleDatagrid(config: StyledSimpleGridConfig) {
  const baseColumns = config.columns.map(
    (c): SimpleBaseColumn => ({
      cell: c.cell,
      header: c.header,
      keydownCellHandler: c.keydownCellHandler,
      keydownHeaderHandler: c.keydownHeaderHandler,
      headerClickHandler: c.headerClickHandler,
      cellClickHandler: c.cellClickHandler,
      queryGeneration: c.queryGeneration,
      initialWidth: c.width,
    })
  );
  let addButton: Node | undefined;
  if (config.toolbar.add?.type === "href") {
    addButton = iconButton({
      variant: "soft",
      color: "primary",
      size: "sm",
      children: materialIcon("Add"),
      href: stringLiteral(config.toolbar.add.href),
    });
  } else if (config.toolbar.add?.type === "dialog") {
    const withValues: Record<string, string> =
      config.toolbar.add.opts?.withValues ?? {};
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
          ...config.toolbar.add.opts,
          table: config.tableModel.name,
          open: `adding`,
          onClose: [setScalar(`adding`, `false`)],
          content: {
            type: "AutoLabelOnLeft",
            ignoreFields: Object.keys(withValues),
          },
          afterSubmitService: (state) => [
            ...((config.toolbar.add as any).opts?.afterSubmitService?.(state) ??
              []),
            triggerQueryRefresh(),
          ],
        }),
      ],
    });
  }
  let content: Node = simplDatagridBase({
    source: "db." + ident(config.tableModel.name),
    idFieldSource: config.tableModel.primaryKeyFieldName
      ? ident(config.tableModel.primaryKeyFieldName)
      : "id",
    children: (dg) =>
      ifNode(
        `status = 'failed'`,
        alert({
          color: "danger",
          children: `'Unable to load data.'`,
        }),
        [
          element("div", {
            styles: styles.toolbar,
            children: [
              typography({
                level: "h4",
                children: config.toolbar.header,
              }),
              ifNode(
                `status = 'fallback_triggered' and dg_refresh_key != 0`,
                typography({
                  startDecorator: circularProgress({ size: "sm" }),
                  level: "body2",
                  children: `'Reloading...'`,
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
              config.toolbar.delete
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
                                  scalar(
                                    `count`,
                                    "(" +
                                      getCountQuery(
                                        "db." + config.tableModel.name
                                      ) +
                                      ")"
                                  ),
                                ],
                                children: `count`,
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
                                modify(
                                  `delete from db.${ident(
                                    config.tableModel.name
                                  )}`
                                ),
                              ],
                              [
                                modify(
                                  `delete from db.${ident(
                                    config.tableModel.name
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
              addButton,
            ],
          }),
          ifNode(
            `(status = 'requested' or status = 'fallback_triggered') and dg_refresh_key = 0`,
            element("div", {
              styles: sharedStyles.emptyGrid,
            }),
            dg
          ),
        ]
      ),
    columns: baseColumns,
    idField: config.idField,
    datagridStyles: {
      root: sharedStyles.root,
      row: sharedStyles.row,
      cell: sharedStyles.cell(),
      headerCell: sharedStyles.headerCell(),
      header: sharedStyles.header,
    },
    pageSize: config.pageSize,
    extraState: config.extraState,
    auth: config.auth,
    rowHeight: config.rowHeight ?? "medium",
  });
  if (config.sourceMapName) {
    content = sourceMap(config.sourceMapName, content);
  }
  return content;
}
