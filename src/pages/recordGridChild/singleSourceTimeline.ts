import { button } from "../../components/button";
import { chip } from "../../components/chip";
import { confirmDangerDialog } from "../../components/confirmDangerDialog";
import { divider } from "../../components/divider";
import { iconButton } from "../../components/iconButton";
import { InsertDialogOpts, insertDialog } from "../../components/insertDialog";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay";
import { AutoLabelOnLeftFieldOverride } from "../../components/internal/insertFormShared";
import { materialIcon } from "../../components/materialIcon";
import { popoverMenu } from "../../components/menu";
import { typography } from "../../components/typography";
import { updateDialog } from "../../components/updateDialog";
import { getUniqueUiId } from "../../components/utils";
import {
  each,
  element,
  eventHandlers,
  ifNode,
  sourceMap,
  state,
} from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import {
  commitTransaction,
  commitUiChanges,
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
} from "../../procHelpers";
import { app } from "../../app";
import { Style } from "../../styleTypes";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { ClientProcStatement, SqlExpression, StateStatement } from "../../yom";
import { RecordGridContext } from "./shared";
import { recordDefaultItemContent, styles } from "./timelineShared";

export type TableDisplayValue =
  | string
  | {
      expr: SqlExpression;
      display: (e: SqlExpression) => Node;
      label: string;
    };

type TableValue = string | { expr: SqlExpression };

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

export interface Opts {
  styles?: Style;
  timelineHeader: string;
  additionalState?: (ctx: RecordGridContext) => StateStatement[];
  afterHeaderNode?: (ctx: RecordGridContext) => Node;

  table: string;
  dateExpr: SqlExpression;
  customFrom?: (ctx: RecordGridContext) => string;
  foreignKeyExpr?: SqlExpression;
  disableInsert?: boolean;
  itemContent: (
    ctx: RecordGridContext
  ) => RecordDefaultTableItemContent | CustomTableItemContent;
  insertDialogOpts?: (ctx: RecordGridContext) => InsertDialogOpts;
  icon: {
    styles: Style;
    content: Node;
  };
}

export function content(opts: Opts, ctx: RecordGridContext) {
  const fields = new Set<string>();
  const exprs: { expr: string; name: string }[] = [];
  function addValue(value: TableValue, exprName: string) {
    if (typeof value === "string") {
      fields.add(value);
    } else {
      exprs.push({
        name: exprName,
        expr: value.expr,
      });
    }
  }
  const tableModel = app.db.tables[opts.table];
  const itemContent = opts.itemContent(ctx);
  const insertDialogOpts = opts.insertDialogOpts?.(ctx);
  const withValues: Record<string, string> = insertDialogOpts?.withValues ?? {};
  let foreignKeyField = Object.values(tableModel.fields).find(
    (f) => f.type === "ForeignKey" && f.table === ctx.table.name
  );
  const overrides: Record<string, AutoLabelOnLeftFieldOverride> = {
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
  let itemRight: Node;
  if (itemContent.type === "RecordDefault") {
    let customAction: Node | undefined;
    if (itemContent.customAction) {
      for (let i = 0; i < itemContent.customAction.values.length; i++) {
        addValue(itemContent.customAction.values[i], `custom_action_${i}`);
      }
      customAction = itemContent.customAction.node(
        ...itemContent.customAction.values.map((v, valueIdx) => {
          if (typeof v === "string") {
            return `record.${ident(v)}`;
          } else {
            return `record.custom_action_${valueIdx}`;
          }
        })
      );
    }
    if (itemContent.headerValues) {
      for (let i = 0; i < itemContent.headerValues.length; i++) {
        addValue(itemContent.headerValues[i], `header_value_${i}`);
      }
    }
    itemRight = recordDefaultItemContent(ctx, {
      displayValues: itemContent.displayValues?.map((v, i) => {
        addValue(v, `display_value_${i}`);
        if (typeof v === "string") {
          return { type: "field", field: v, exprValue: `record.${ident(v)}` };
        } else {
          return {
            type: "expr",
            exprValue: v.expr,
            display: v.display,
            label: v.label,
          };
        }
      }),
      header: itemContent.header(
        ...(itemContent.headerValues?.map((v, headerIdx) =>
          typeof v === "string"
            ? `record.${ident}`
            : `record.header_value_${headerIdx}`
        ) ?? [])
      ),
      tableModel,
      customAction,
      disableDefaultAction: itemContent.disableDefaultAction,
    });
  } else {
    for (let i = 0; i < itemContent.values.length; i++) {
      addValue(itemContent.values[i], `custom_value_${i}`);
    }
    itemRight = itemContent.node(
      ...itemContent.values.map((v, valueIdx) =>
        typeof v === "string"
          ? `record.${v}`
          : `record.custom_value_${valueIdx}`
      )
    );
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
              ...opts.icon.styles,
            },
            children: opts.icon.content,
          }),
          nodes.if(
            `record.iteration_index != (select count(*) from result) - 1`,
            element("span", {
              styles: styles.line,
            })
          ),
        ],
      }),
      itemRight,
    ],
  });
  let fullQuery = `select ${ident(tableModel.primaryKeyFieldName)} as id, ${
    opts.dateExpr
  } as date `;
  for (const field of fields) {
    fullQuery += `, ${ident(field)}`;
  }
  for (const expr of exprs) {
    fullQuery += `, ${expr.expr} as ${expr.name}`;
  }
  if (opts.customFrom) {
    fullQuery += opts.customFrom;
  } else {
    let foreignKeyExpr = opts.foreignKeyExpr;
    if (!foreignKeyExpr) {
      for (const f of Object.values(tableModel.fields)) {
        if (f.type === "ForeignKey" && f.table === ctx.table.name) {
          if (foreignKeyExpr) {
            throw new Error(
              "Please specify a foreignKeyExpr when multiple fields could be used and you don't specify a customFrom"
            );
          }
          foreignKeyExpr = ident(f.name);
        }
      }
    }
    fullQuery += ` from db.${ident(
      opts.table
    )} as record where ${foreignKeyExpr} = ${ctx.recordId}`;
  }
  fullQuery += ` limit row_count`;
  return sourceMap(
    `singleSourceTimeline`,
    state({
      procedure: [scalar(`row_count`, `50`)],
      children: state({
        watch: [ctx.refreshKey, `row_count`],
        procedure: [
          table(`result`, fullQuery),
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
                  procedure: [scalar(`adding`, `false`)],
                  children: [
                    button({
                      variant: "soft",
                      size: "sm",
                      color: "primary",
                      children: `'Add'`,
                      startDecorator: materialIcon("Add"),
                      on: {
                        click: [setScalar(`adding`, `true`)],
                      },
                    }),
                    insertDialog({
                      open: `ui.adding`,
                      onClose: [setScalar(`ui.adding`, `false`)],
                      table: opts.table,
                      content: {
                        type: "AutoLabelOnLeft",
                        fieldOverrides: overrides,
                        ignoreFields,
                      },
                      withValues,
                      beforeSubmitClient: insertDialogOpts?.beforeSubmitClient,
                      beforeTransactionStart:
                        insertDialogOpts?.beforeTransactionStart,
                      afterTransactionStart:
                        insertDialogOpts?.afterTransactionStart,
                      beforeTransactionCommit:
                        insertDialogOpts?.beforeTransactionCommit,
                      afterTransactionCommit: (state) => [
                        ...(insertDialogOpts?.afterTransactionCommit?.(state) ??
                          []),
                        ctx.triggerRefresh,
                      ],
                      afterSubmitClient: insertDialogOpts?.afterSubmitClient,
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
                key: `record.id`,
                children: item,
              }),
            }),
          ],
        }),
      }),
    })
  );
}
