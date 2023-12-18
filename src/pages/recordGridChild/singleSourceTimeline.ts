import { button } from "../../components/button";
import { divider } from "../../components/divider";
import { InsertDialogOpts, insertDialog } from "../../components/insertDialog";
import { AutoLabelOnLeftFieldOverride } from "../../components/internal/insertFormShared";
import { materialIcon } from "../../components/materialIcon";
import { typography } from "../../components/typography";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { hub } from "../../hub";
import { Style } from "../../styleTypes";
import { ident } from "../../utils/sqlHelpers";
import { recordDefaultItemContent, styles } from "./timelineShared";
import * as yom from "../../yom";
import { StateStatementsOrFn } from "../../statements";
import { RecordGridBuilder } from "../recordGrid";

export type TableDisplayValue =
  | string
  | {
      expr: yom.SqlExpression;
      display: (e: yom.SqlExpression) => Node;
      label: string;
    };

type TableValue = string | { expr: yom.SqlExpression };

export interface RecordDefaultTableItemContent {
  type: "RecordDefault";
  headerValues?: TableValue[];
  header: (...values: yom.SqlExpression[]) => Node;
  displayValues?: TableDisplayValue[];
  disableDefaultAction?: boolean;
  customAction?: {
    values: TableValue[];
    node: (...values: yom.SqlExpression[]) => Node;
  };
}

export interface CustomTableItemContent {
  type: "Custom";
  values: TableValue[];
  node: (...values: yom.SqlExpression[]) => Node;
}

export interface Opts {
  styles?: Style;
  timelineHeader: string;
  additionalState?: StateStatementsOrFn;
  afterHeaderNode?: Node;

  table: string;
  dateExpr: yom.SqlExpression;
  customFrom?: string;
  foreignKeyExpr?: yom.SqlExpression;
  disableInsert?: boolean;
  itemContent: RecordDefaultTableItemContent | CustomTableItemContent;
  insertDialogOpts?: InsertDialogOpts;
  icon: {
    styles: Style;
    content: Node;
  };
}

export function content(opts: Opts, ctx: RecordGridBuilder) {
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
  const tableModel = hub.db.tables[opts.table];
  const itemContent = opts.itemContent;
  const insertDialogOpts = opts.insertDialogOpts;
  const withValues: Record<string, string> = insertDialogOpts?.withValues ?? {};
  let foreignKeyField = Object.values(tableModel.fields).find(
    (f) => f.type === "ForeignKey" && f.table === ctx.table.name,
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
        }),
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
            : `record.header_value_${headerIdx}`,
        ) ?? []),
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
          : `record.custom_value_${valueIdx}`,
      ),
    );
  }
  const item = nodes.element("div", {
    styles: styles.item,
    children: [
      nodes.element("div", {
        styles: styles.date,
        children: [
          nodes.element("span", {
            children: `format.date(record.date, '%-d %b')`,
          }),
          nodes.element("span", {
            children: `format.date(record.date, '%Y')`,
          }),
        ],
      }),
      nodes.element("div", {
        styles: styles.iconWrapper,
        children: [
          nodes.element("span", {
            styles: {
              ...styles.icon,
              ...opts.icon.styles,
            },
            children: opts.icon.content,
          }),
          nodes.if(
            `record.iteration_index != (select count(*) from result) - 1`,
            nodes.element("span", {
              styles: styles.line,
            }),
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
              "Please specify a foreignKeyExpr when multiple fields could be used and you don't specify a customFrom",
            );
          }
          foreignKeyExpr = ident(f.name);
        }
      }
    }
    fullQuery += ` from db.${ident(
      opts.table,
    )} as record where ${foreignKeyExpr} = ${ctx.recordId}`;
  }
  fullQuery += ` limit row_count`;
  return nodes.sourceMap(
    `singleSourceTimeline`,
    nodes.state({
      procedure: (s) => s.scalar(`row_count`, `50`),
      children: nodes.state({
        watch: [ctx.refreshKey, `row_count`],
        procedure: (s) =>
          s
            .table(`result`, fullQuery)
            .scalar(`service_row_count`, `row_count`)
            .statements(opts.additionalState),
        statusScalar: `status`,
        children: nodes.element("div", {
          styles: opts.styles ? [styles.root, opts.styles] : styles.root,
          children: [
            nodes.eventHandlers({
              document: {
                scroll: (s) =>
                  s
                    .if(
                      `status != 'received' or (service_row_count is not null and (select count(*) from result) < service_row_count)`,
                      (s) => s.return(),
                    )
                    .getWindowProperty("scrollY", "scroll_y")
                    .getWindowProperty("innerHeight", "height")
                    .getElProperty(
                      "scrollHeight",
                      "doc_scroll_height",
                      "'yolm-document-body'",
                    )
                    .if(`doc_scroll_height - scroll_y - height < 500`, (s) =>
                      s.setScalar(`row_count`, `row_count + 50`),
                    ),
              },
            }),
            divider(),
            nodes.element("div", {
              styles: styles.header,
              children: [
                typography({ level: "h4", children: opts.timelineHeader }),
                nodes.state({
                  procedure: (s) => s.scalar(`adding`, `false`),
                  children: [
                    button({
                      variant: "soft",
                      size: "sm",
                      color: "primary",
                      children: `'Add'`,
                      startDecorator: materialIcon("Add"),
                      on: {
                        click: (s) => s.setScalar(`adding`, `true`),
                      },
                    }),
                    insertDialog({
                      open: `ui.adding`,
                      onClose: (s) => s.setScalar(`ui.adding`, `false`),
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
                      afterTransactionCommit: (state, s) => {
                        insertDialogOpts?.afterTransactionCommit?.(state, s);
                        s.statements(ctx.triggerRefresh);
                      },
                      afterSubmitClient: insertDialogOpts?.afterSubmitClient,
                    }),
                  ],
                }),
              ],
            }),
            opts.afterHeaderNode,
            nodes.element("div", {
              styles: styles.items,
              children: nodes.each({
                table: `result`,
                recordName: `record`,
                key: `record.id`,
                children: item,
              }),
            }),
          ],
        }),
      }),
    }),
  );
}
