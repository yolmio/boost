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
  exit,
  getElProperty,
  getWindowProperty,
  if_,
  scalar,
  setScalar,
  table,
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { Style } from "../../styleTypes.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { UnionExpr, createUnionQuery } from "../../utils/union.js";
import { materialIcon } from "../../components/materialIcon.js";
import { popoverMenu } from "../../components/menu.js";
import { typography } from "../../components/typography.js";
import { button } from "../../components/button.js";
import { insertDialog } from "../../components/insertDialog.js";
import { divider } from "../../components/divider.js";
import { DynamicClass, SqlExpression, StateStatement } from "../../yom.js";
import { Node } from "../../nodeTypes.js";
import { FormStateProcedureExtensions } from "../../formState.js";
import { getUniqueUiId } from "../../components/utils.js";
import { AutoLabelOnLeftFieldOverride } from "../../components/internal/updateFormShared.js";
import { RecordGridContext } from "./shared.js";
import { recordDefaultItemContent, styles } from "./timelineShared.js";

export const name = "timeline";

export type TableDisplayValue =
  | string
  | {
      expr: SqlExpression;
      label: string;
      type: VirtualType;
      display: (e: SqlExpression) => Node;
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
              ...styles.icon,
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
            node = recordDefaultItemContent(ctx, {
              displayValues: itemContent.displayValues?.map((v, valueIdx) => {
                if (typeof v === "string") {
                  return {
                    type: "field",
                    field: v,
                    exprValue: query.getField(sourceIdx, "record", v),
                  };
                } else {
                  return {
                    type: "expr",
                    exprValue: query.getField(
                      sourceIdx,
                      "record",
                      `display_value_${valueIdx}`
                    ),
                    display: v.display,
                    label: v.label,
                  };
                }
              }),
              header: itemContent.header(
                ...(itemContent.headerValues?.map((v, headerIdx) =>
                  query.getField(
                    sourceIdx,
                    "record",
                    typeof v === "string" ? v : `header_value_${headerIdx}`
                  )
                ) ?? [])
              ),
              tableModel: model.database.tables[tableName],
              customAction: itemContent.customAction?.node(
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
              ),
              disableDefaultAction: itemContent.disableDefaultAction,
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
    `timeline`,
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
                  procedure: sources.map((_, i) =>
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
                        items: sources
                          .filter((t) => !t.disableInsert)
                          .map((t, i) => ({
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
            element("div", {
              styles: styles.items,
              children: each({
                table: `result`,
                recordName: `record`,
                key: `record.id || '_' || record.union_source_idx`,
                children: item,
              }),
            }),
          ],
        }),
      }),
    })
  );
}
