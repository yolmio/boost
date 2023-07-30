import { VirtualType } from "../../modelTypes.js";
import {
  each,
  element,
  eventHandlers,
  ifNode,
  sourceMap,
  state,
} from "../../nodeHelpers.js";
import {
  commitTransaction,
  commitUiChanges,
  debugQuery,
  exit,
  getElProperty,
  getWindowProperty,
  if_,
  modify,
  scalar,
  serviceProc,
  setScalar,
  startTransaction,
  table,
  try_,
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { Style } from "../../styleTypes.js";
import { createStyles, cssVar } from "../../styleUtils.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { UnionExpr, createUnionQuery } from "../../utils/union.js";
import { chip } from "../../components/chip.js";
import { iconButton } from "../../components/iconButton.js";
import { materialIcon } from "../../components/materialIcon.js";
import { popoverMenu } from "../../components/menu.js";
import { typography } from "../../components/typography.js";
import { confirmDangerDialog } from "../../components/confirmDangerDialog.js";
import { updateDialog } from "../../components/updateDialog.js";
import { button } from "../../components/button.js";
import { insertDialog } from "../../components/insertDialog.js";
import { divider } from "../../components/divider.js";
import {
  ClientProcStatement,
  DynamicClass,
  SqlExpression,
  StateStatement,
} from "../../yom.js";
import { Node } from "../../nodeTypes.js";
import { FormStateProcedureExtensions } from "../../formState.js";
import { getUniqueUiId } from "../../components/utils.js";
import { AutoLabelOnLeftFieldOverride } from "../../components/internal/updateFormShared.js";
import { RecordGridContext } from "./shared.js";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay.js";

export const name = "relatedRecordsTimeline";

export type TableDisplayValue =
  | string
  | {
      expr: SqlExpression;
      label: string;
      type: VirtualType;
    };

interface ValueExpr {
  expr: SqlExpression;
  type: VirtualType;
}

type TableValue = string | ValueExpr;

export interface RecordDefaultTableItemContent {
  type: "RecordDefault";
  headerValues?: TableValue[];
  header: (...values: SqlExpression[]) => Node;
  displayValues?: TableDisplayValue[];
  disableDefaultAction?: boolean;
  customAction?: {
    values: TableValue[];
    node: (...values: SqlExpression[]) => Node;
  };
}

export interface CustomTableItemContent {
  type: "Custom";
  values: TableValue[];
  node: (...values: SqlExpression[]) => Node;
}

type InsertDialogOpts = {
  withValues?: Record<string, string>;
} & FormStateProcedureExtensions;

export interface TableTimelineSource {
  table: string;
  customFrom?: string;
  dateExpr?: SqlExpression;
  foreignKeyExpr?: SqlExpression;
  disableInsert?: boolean;
  itemContent: RecordDefaultTableItemContent | CustomTableItemContent;
  insertDialogOpts?: InsertDialogOpts;
  icon: {
    styles: Style;
    content: Node;
  };
}

export interface Opts {
  dateField?: string;
  timelineHeader: string;
  additionalState?: (ctx: RecordGridContext) => StateStatement[];
  afterHeaderNode?: (ctx: RecordGridContext) => Node;
  styles?: Style;
  sources: (ctx: RecordGridContext) => TableTimelineSource[];
}

const styles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gridColumnSpan: "full",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    pt: 2,
    px: 1,
  },
  addButtonWrapper: {
    position: "relative",
  },
  addPopover: {
    width: 240,
  },
  editPopover: {
    width: 120,
  },
  item: {
    display: "flex",
    minHeight: 80,
  },
  date: {
    display: "flex",
    flexDirection: "column",
    mx: 1,
    mt: 1,
    color: cssVar(`palette-text-secondary`),
    alignItems: "center",
    fontSize: "sm",
    minWidth: 60,
  },
  iconWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  line: {
    width: 2,
    backgroundColor: cssVar(`palette-neutral-100`),
    flexGrow: 1,
  },
  itemContent: {
    ml: 2,
    flexGrow: 1,
    display: "flex",
    alignItems: "start",
  },
  itemLeft: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },
  itemValues: {
    display: "flex",
    gap: 1,
    flexWrap: "wrap",
    mb: 2,
  },
  itemValueWrapper: {
    display: "flex",
  },
  itemValue: {
    mr: 0.5,
    color: "text-secondary",
    my: 0,
    fontSize: "sm",
    alignSelf: "flex-end",
  },
  multilineValue: {
    whiteSpace: "pre-wrap",
    my: 0,
  },
});

const addButtonId = stringLiteral(getUniqueUiId());

export function content(opts: Opts, ctx: RecordGridContext) {
  const sources = opts.sources(ctx);
  const query = createUnionQuery({
    orderBy: "date desc, union_source_idx, id desc",
    limit: `row_count`,
    orderByFields: ["date", "id"],
    sources: sources.map((source) => {
      const tableModel = model.database.tables[source.table];
      let customFrom = source.customFrom;
      if (!customFrom) {
        let foreignKeyExpr = source.foreignKeyExpr;
        if (!foreignKeyExpr) {
          for (const f of Object.values(tableModel.fields)) {
            if (f.type === "ForeignKey" && f.table === ctx.table.name) {
              if (foreignKeyExpr) {
                throw new Error(
                  "Please specify a foreignKeyExpr when multiple fields could be used and you don't specify a customFrom"
                );
              }
              foreignKeyExpr = f.name;
            }
          }
        }
        customFrom = ` from db.${ident(
          source.table
        )} where ${foreignKeyExpr} = ${ctx.recordId}`;
      }
      let dateExpr = source.dateExpr ?? opts.dateField;
      if (!dateExpr) {
        throw new Error("Please specify a dateExpr or dateField");
      }
      const fields = new Set<string>();
      const exprs: UnionExpr[] = [];
      function addValue(value: TableValue, exprName: string) {
        if (typeof value === "string") {
          fields.add(value);
        } else {
          exprs.push({
            name: exprName,
            expr: value.expr,
            type: value.type,
          });
        }
      }
      if (source.itemContent.type === "RecordDefault") {
        const { displayValues, headerValues, customAction } =
          source.itemContent;
        if (displayValues) {
          for (let i = 0; i < displayValues.length; i++) {
            addValue(displayValues[i], `display_value_${i}`);
          }
        }
        if (headerValues) {
          for (let i = 0; i < headerValues.length; i++) {
            addValue(headerValues[i], `header_value_${i}`);
          }
        }
        if (customAction) {
          for (let i = 0; i < customAction.values.length; i++) {
            addValue(customAction.values[i], `custom_action_value_${i}`);
          }
        }
      } else {
        for (let i = 0; i < source.itemContent.values.length; i++) {
          addValue(source.itemContent.values[i], `custom_value_${i}`);
        }
      }
      return {
        type: "Table",
        table: source.table,
        customFrom,
        exprs,
        fields: [...fields],
        orderByExprs: [
          dateExpr,
          `${ident(source.table)}.${ident(
            tableModel.primaryKeyFieldName ?? "id"
          )}`,
        ],
      };
    }),
  });
  const sourceIconStyles: any = {};
  const sourceIconDynamicClasses: DynamicClass[] = [];
  for (let i = 0; i < sources.length; i++) {
    sourceIconStyles["&.table-" + i] = sources[i].icon.styles;
    sourceIconDynamicClasses.push({
      condition: `record.union_source_idx = ${i}`,
      classes: "table-" + i,
    });
  }
  const basePopoverMenuId = stringLiteral(getUniqueUiId());
  const item = element("div", {
    styles: styles.item,
    children: [
      element("div", {
        styles: styles.date,
        children: [
          element("span", {
            children: `format.date(record.date, '%-d %b')`,
          }),
          element("span", {
            children: `format.date(record.date, '%Y')`,
          }),
        ],
      }),
      element("div", {
        styles: styles.iconWrapper,
        children: [
          element("span", {
            styles: {
              display: "flex",
              alignSelf: "baseline",
              color: "white",
              borderRadius: "50%",
              my: 1,
              p: 1,
              "--icon-font-size": "1.5rem",
              ...sourceIconStyles,
            },
            dynamicClasses: sourceIconDynamicClasses,
            children: {
              t: "Switch",
              cases: sources.map((t, i) => ({
                condition: `record.union_source_idx = ${i}`,
                node: t.icon.content,
              })),
            },
          }),
          ifNode(
            `record.iteration_index != (select count(*) from result) - 1`,
            element("span", {
              styles: styles.line,
            })
          ),
        ],
      }),
      {
        t: "Switch",
        cases: sources.map(({ itemContent, table: tableName }, sourceIdx) => {
          let node: Node;
          if (itemContent.type === "RecordDefault") {
            const tableModel = model.database.tables[tableName];
            const editIgnoreFields: string[] = [];
            for (const field of Object.values(tableModel.fields)) {
              if (
                field.type === "ForeignKey" &&
                field.table === ctx.table.name
              ) {
                editIgnoreFields.push(field.name);
                continue;
              }
            }
            let action: Node | undefined;
            if (itemContent.customAction) {
              action = itemContent.customAction.node(
                ...itemContent.customAction.values.map((v, valueIdx) => {
                  if (typeof v === "string") {
                    return query.getField(sourceIdx, "record", v);
                  } else {
                    return query.getField(
                      sourceIdx,
                      "record",
                      `custom_action_value_${valueIdx}`
                    );
                  }
                })
              );
            } else if (!itemContent.disableDefaultAction) {
              action = state({
                procedure: [
                  scalar(`editing`, `false`),
                  scalar(`deleting`, `false`),
                ],
                children: [
                  popoverMenu({
                    menuListOpts: {
                      styles: styles.editPopover,
                      floating: {
                        placement: `'bottom-end'`,
                      },
                    },
                    id: `${basePopoverMenuId} || '-' || record.iteration_index`,
                    button: ({ buttonProps, onButtonClick }) =>
                      iconButton({
                        variant: "plain",
                        color: "neutral",
                        size: "sm",
                        children: materialIcon("MoreHoriz"),
                        props: buttonProps,
                        on: {
                          click: onButtonClick,
                        },
                      }),
                    items: [
                      {
                        onClick: [setScalar(`ui.editing`, `true`)],
                        children: `'Edit'`,
                      },
                      {
                        onClick: [setScalar(`ui.deleting`, `true`)],
                        children: `'Delete'`,
                      },
                    ],
                  }),
                  ifNode(
                    `editing`,
                    updateDialog({
                      table: tableName,
                      open: `ui.editing`,
                      onClose: [setScalar(`ui.editing`, `false`)],
                      recordId: `record.id`,
                      content: {
                        type: "AutoLabelOnLeft",
                        ignoreFields: editIgnoreFields,
                      },
                      afterTransactionCommit: () => [ctx.triggerRefresh],
                    })
                  ),
                  confirmDangerDialog({
                    onConfirm: (closeModal) => [
                      setScalar(`dialog_waiting`, `true`),
                      commitUiChanges(),
                      try_<ClientProcStatement>({
                        body: [
                          serviceProc([
                            startTransaction(),
                            modify(
                              `delete from db.${ident(
                                tableName
                              )} where id = record.id`
                            ),
                            commitTransaction(),
                            ctx.triggerRefresh,
                          ]),
                        ],
                        catch: [
                          setScalar(`dialog_waiting`, `false`),
                          setScalar(
                            `dialog_error`,
                            `'Unable to delete, try again another time.'`
                          ),
                          exit(),
                        ],
                      }),
                      ...closeModal,
                    ],
                    open: `ui.deleting`,
                    onClose: [setScalar(`ui.deleting`, `false`)],
                    description: `'Are you sure you want to delete this ' || ${stringLiteral(
                      tableModel.displayName.toLowerCase()
                    )} || '?'`,
                  }),
                ],
              });
            }
            node = element("div", {
              styles: styles.itemContent,
              children: [
                element("div", {
                  styles: styles.itemLeft,
                  children: [
                    typography({
                      level: "h6",
                      children: itemContent.header(
                        ...(itemContent.headerValues?.map((v, headerIdx) =>
                          query.getField(
                            sourceIdx,
                            "record",
                            typeof v === "string"
                              ? v
                              : `header_value_${headerIdx}`
                          )
                        ) ?? [])
                      ),
                    }),
                    itemContent.displayValues
                      ? element("div", {
                          styles: styles.itemValues,
                          children: itemContent.displayValues.map(
                            (value, valueIdx) => {
                              if (typeof value === "string") {
                                const field = tableModel.fields[value];
                                if (!field) {
                                  throw new Error(
                                    `Field ${value} does not exist in table ${tableModel.name}}`
                                  );
                                }
                                const valueExpr = query.getField(
                                  sourceIdx,
                                  "record",
                                  field.name
                                );
                                if (field.type === "Bool") {
                                  return ifNode(
                                    valueExpr,
                                    chip({
                                      variant: "soft",
                                      color: "neutral",
                                      size: "sm",
                                      children: stringLiteral(
                                        field.displayName
                                      ),
                                    })
                                  );
                                }
                                let content = element("div", {
                                  styles: styles.itemValueWrapper,
                                  children: [
                                    element("p", {
                                      styles: styles.itemValue,
                                      children: `${stringLiteral(
                                        field.displayName
                                      )} || ':'`,
                                    }),
                                    inlineFieldDisplay(field, valueExpr),
                                  ],
                                });
                                if (field.notNull) {
                                  return content;
                                }
                                return ifNode(
                                  valueExpr + ` is not null`,
                                  content
                                );
                              } else {
                                const expr = query.getField(
                                  sourceIdx,
                                  "record",
                                  `display_value_${valueIdx}`
                                );
                                return element("div", {
                                  styles: styles.itemValueWrapper,
                                  children: [
                                    element("p", {
                                      styles: styles.itemValue,
                                      children: `${stringLiteral(
                                        value.label
                                      )} || ':'`,
                                    }),
                                    expr,
                                  ],
                                });
                              }
                            }
                          ),
                        })
                      : undefined,
                  ],
                }),
                action,
              ],
            });
          } else {
            node = itemContent.node(
              ...itemContent.values.map((v, valueIdx) =>
                query.getField(
                  sourceIdx,
                  "record",
                  typeof v === "string" ? v : `custom_value_${valueIdx}`
                )
              )
            );
          }
          return {
            condition: `record.union_source_idx = ${sourceIdx}`,
            node,
          };
        }),
      },
    ],
  });
  return sourceMap(
    `relatedRecordsTimeline`,
    state({
      procedure: [scalar(`row_count`, `50`)],
      children: state({
        watch: [ctx.refreshKey, `row_count`],
        procedure: [
          table(`result`, query.query),
          scalar(`service_row_count`, `row_count`),
          ...(opts.additionalState?.(ctx) ?? []),
        ],
        statusScalar: `status`,
        children: element("div", {
          styles: opts.styles ? [styles.root, opts.styles] : styles.root,
          children: [
            eventHandlers({
              document: {
                scroll: [
                  if_(
                    `status != 'received' or (service_row_count is not null and (select count(*) from result) < service_row_count)`,
                    [exit()]
                  ),
                  getWindowProperty("scrollY", "scroll_y"),
                  getWindowProperty("innerHeight", "height"),
                  getElProperty(
                    "scrollHeight",
                    "doc_scroll_height",
                    "'yolm-document-body'"
                  ),
                  if_(`doc_scroll_height - scroll_y - height < 500`, [
                    setScalar(`row_count`, `row_count + 50`),
                  ]),
                ],
              },
            }),
            divider(),
            element("div", {
              styles: styles.header,
              children: [
                typography({ level: "h5", children: opts.timelineHeader }),
                state({
                  procedure: sources.map((t, i) =>
                    scalar(`adding_${i}`, `false`)
                  ),
                  children: [
                    element("div", {
                      styles: styles.addButtonWrapper,
                      children: popoverMenu({
                        menuListOpts: {
                          styles: styles.addPopover,
                          floating: {
                            strategy: "'fixed'",
                            placement: `'bottom-end'`,
                            flip: { mainAxis: "true", crossAxis: "true" },
                            shift: { mainAxis: "false", crossAxis: "false" },
                          },
                        },
                        id: addButtonId,
                        button: ({ buttonProps, onButtonClick }) =>
                          button({
                            variant: "soft",
                            size: "sm",
                            color: "primary",
                            children: `'Add'`,
                            startDecorator: materialIcon("Add"),
                            props: buttonProps,
                            on: {
                              click: onButtonClick,
                            },
                          }),
                        items: sources.map((t, i) => ({
                          children:
                            `'Add ' || ` +
                            stringLiteral(
                              model.database.tables[t.table].displayName
                            ),
                          onClick: [setScalar(`ui.adding_${i}`, `true`)],
                        })),
                      }),
                    }),
                    sources
                      .filter((t) => !t.disableInsert)
                      .map((t, i) => {
                        const tableModel = model.database.tables[t.table];
                        const opts = t.insertDialogOpts ?? {};
                        const withValues: Record<string, string> =
                          opts.withValues ?? {};
                        let foreignKeyField = Object.values(
                          tableModel.fields
                        ).find(
                          (f) =>
                            f.type === "ForeignKey" &&
                            f.table === ctx.table.name
                        );
                        const overrides: Record<
                          string,
                          AutoLabelOnLeftFieldOverride
                        > = {
                          date: {
                            initialValue: `current_date()`,
                          },
                        };
                        if (foreignKeyField) {
                          overrides[foreignKeyField.name] = {
                            initialValue: ctx.recordId,
                          };
                          withValues[foreignKeyField.name] = ctx.recordId;
                        }
                        const ignoreFields = Object.keys(withValues);
                        return insertDialog({
                          open: `ui.adding_${i}`,
                          onClose: [setScalar(`ui.adding_${i}`, `false`)],
                          table: t.table,
                          content: {
                            type: "AutoLabelOnLeft",
                            fieldOverrides: overrides,
                            ignoreFields,
                          },
                          withValues,
                          beforeSubmitClient: opts.beforeSubmitClient,
                          beforeTransactionStart: opts.beforeTransactionStart,
                          afterTransactionStart: opts.afterTransactionStart,
                          beforeTransactionCommit: opts.beforeTransactionCommit,
                          afterTransactionCommit: (state) => [
                            ...(opts.afterTransactionCommit?.(state) ?? []),
                            ctx.triggerRefresh,
                          ],
                          afterSubmitClient: opts.afterSubmitClient,
                        });
                      }),
                  ],
                }),
              ],
            }),
            opts.afterHeaderNode?.(ctx),
            each({
              table: `result`,
              recordName: `record`,
              key: `record.id || '_' || record.union_source_idx`,
              children: item,
            }),
          ],
        }),
      }),
    })
  );
}
