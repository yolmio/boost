import { alert } from "../../components/alert";
import { confirmDangerDialog } from "../../components/confirmDangerDialog";
import { iconButton } from "../../components/iconButton";
import { materialIcon } from "../../components/materialIcon";
import { typography } from "../../components/typography";
import { Table } from "../../system";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { SqlExpression } from "../../yom";
import {
  getCountQuery,
  SimpleBaseColumn,
  SimpleBaseColumnQueryGeneration,
  simpleDatagridBase,
} from "./simpleDatagridBase";
import { styles as sharedStyles } from "./styles";
import { circularProgress } from "../../components/circularProgress";
import { StateStatements } from "../../statements";
import { CellNode, dgState, ColumnEventHandlers, RowHeight } from "./shared";
import {
  EmbeddedInsertDialog,
  resolveEmbeddedInsertDialog,
} from "../../components/forms/dialogs/index";

export interface ToolbarConfig {
  header: Node;
  delete: boolean;
  export: boolean;
  search?: { matchConfig: string };
  add?:
    | { type: "dialog"; dialog?: EmbeddedInsertDialog }
    | { type: "href"; href: string };
}

export interface SimpleColumn extends ColumnEventHandlers {
  queryGeneration?: SimpleBaseColumnQueryGeneration;
  width: number;
  header: Node;
  cell: CellNode;
}

export interface StyledSimpleGridConfig {
  tableModel: Table;
  toolbar: ToolbarConfig;
  columns: SimpleColumn[];
  idField: string;
  pageSize?: number;
  extraState?: StateStatements;
  allow?: SqlExpression;
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
    }),
  );
  let addButton: Node | undefined;
  if (config.toolbar.add?.type === "href") {
    addButton = iconButton({
      variant: "soft",
      color: "primary",
      size: "sm",
      children: materialIcon("Add"),
      href: stringLiteral(config.toolbar.add.href),
      ariaLabel: `'Add new record'`,
    });
  } else if (config.toolbar.add?.type === "dialog") {
    addButton = nodes.state({
      procedure: (s) => s.scalar(`adding`, `false`),
      children: [
        iconButton({
          variant: "soft",
          color: "primary",
          size: "sm",
          children: materialIcon("Add"),
          on: { click: (s) => s.setScalar(`adding`, `true`) },
          ariaLabel: `'Add new record'`,
        }),
        resolveEmbeddedInsertDialog(
          {
            table: config.tableModel.name,
            open: `adding`,
            onClose: (s) => s.setScalar(`adding`, `false`),
            afterTransactionCommit: (_, s) => {
              s.statements(dgState.triggerRefresh);
            },
          },
          config.toolbar.add.dialog,
        ),
      ],
    });
  }
  let content: Node = simpleDatagridBase({
    source: "db." + ident(config.tableModel.name),
    idFieldSource: ident(config.tableModel.primaryKeyFieldName),
    children: (dg) =>
      nodes.if({
        condition: `status = 'failed'`,
        then: alert({
          color: "danger",
          children: `'Unable to load data.'`,
        }),
        else: [
          nodes.element("div", {
            styles: styles.toolbar,
            children: [
              typography({
                level: "h4",
                children: config.toolbar.header,
              }),
              nodes.if(
                `status = 'fallback_triggered' and dg_refresh_key != 0`,
                typography({
                  startDecorator: circularProgress({ size: "sm" }),
                  level: "body-sm",
                  children: `'Reloading...'`,
                }),
              ),
              nodes.if(
                `saving_edit`,
                typography({
                  startDecorator: circularProgress({ size: "sm" }),
                  level: "body-sm",
                  children: `'Saving change...'`,
                }),
              ),
              nodes.if(
                `display_error_message is not null`,
                alert({
                  startDecorator: materialIcon("Report"),
                  size: "sm",
                  color: "danger",
                  variant: "solid",
                  children: `display_error_message`,
                }),
              ),
              nodes.if(
                `status = 'failed'`,
                alert({
                  startDecorator: materialIcon("Report"),
                  size: "sm",
                  color: "danger",
                  variant: "solid",
                  children: `'Failed to load data'`,
                }),
              ),
              nodes.element("div", { styles: flexGrowStyles }),
              config.toolbar.delete
                ? nodes.state({
                    procedure: (s) => s.scalar(`deleting`, `false`),
                    children: [
                      iconButton({
                        size: "sm",
                        color: "danger",
                        variant: "soft",
                        children: materialIcon("DeleteOutlined"),
                        on: { click: (s) => s.setScalar(`deleting`, `true`) },
                        ariaLabel: `'Delete selected records'`,
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
                                  s.scalar(
                                    `count`,
                                    "(" +
                                      getCountQuery(
                                        "db." + config.tableModel.name,
                                      ) +
                                      ")",
                                  ),
                                children: `count`,
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
                                    s.modify(
                                      `delete from db.${ident(
                                        config.tableModel.name,
                                      )}`,
                                    ),
                                  else: (s) =>
                                    s.modify(
                                      `delete from db.${ident(
                                        config.tableModel.name,
                                      )} where id in (select id from ui.selected_row)`,
                                    ),
                                })
                                .commitTransaction()
                                .statements(dgState.triggerRefresh),
                            )
                            .statements(closeModal),
                      }),
                    ],
                  })
                : null,
              addButton,
            ],
          }),
          nodes.if({
            condition: `(status = 'requested' or status = 'fallback_triggered') and dg_refresh_key = 0`,
            then: nodes.element("div", {
              styles: sharedStyles.emptyGrid,
            }),
            else: dg,
          }),
        ],
      }),
    columns: baseColumns,
    idField: config.idField,
    datagridStyles: {
      root: sharedStyles.root(),
      row: sharedStyles.row,
      cell: sharedStyles.cell(),
      headerCell: sharedStyles.headerCell(),
      header: sharedStyles.header,
    },
    pageSize: config.pageSize,
    extraState: config.extraState,
    allow: config.allow,
    rowHeight: config.rowHeight ?? "medium",
  });
  if (config.sourceMapName) {
    content = nodes.sourceMap(config.sourceMapName, content);
  }
  return content;
}
