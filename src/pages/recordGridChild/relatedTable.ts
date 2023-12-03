import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles } from "../../styleUtils";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay";
import { deleteRecordDialog } from "../../components/deleteRecordDialog";
import { updateDialog } from "../../components/updateDialog";
import { iconButton } from "../../components/iconButton";
import { materialIcon } from "../../components/materialIcon";
import { button } from "../../components/button";
import { insertDialog } from "../../components/insertDialog";
import { AutoLabelOnLeftInsertFormContent } from "../../components/internal/insertFormShared";
import { deepmerge } from "../../utils/deepmerge";
import { app } from "../../app";
import { RecordGridBuilder } from "../recordGrid";

export interface Opts {
  table: string;
  fields: (
    | string
    | {
        expr: (record: string) => string;
        display?: (e: string) => Node;
        label: string;
      }
  )[];
  addButtonText?: string;
  insertDialog?: Omit<AutoLabelOnLeftInsertFormContent, "type">;
}

const styles = createStyles({
  header: {
    fontWeight: "lg",
    textAlign: "left",
    py: 1.5,
    px: 1.5,
    borderBottom: "1px solid",
    borderColor: "divider",
  },
  cell: {
    py: 1.5,
    px: 1.5,
    borderBottom: "1px solid",
    borderColor: "divider",
  },
  footCell: {
    py: 1.5,
    px: 1.5,
  },
  footHeadCell: {
    fontWeight: "lg",
    textAlign: "right",
    py: 1.5,
    px: 1.5,
  },
});

export function content(opts: Opts, ctx: RecordGridBuilder) {
  const tableModel = app.db.tables[opts.table];
  const foreignKeyField = Object.values(tableModel.fields).find(
    (f) => f.type === "ForeignKey" && f.table === ctx.table.name,
  );
  if (!foreignKeyField) {
    throw new Error(
      `No foreign key field found for ${ctx.table.name} to ${opts.table}`,
    );
  }
  let selectFields = "";
  for (let i = 0; i < opts.fields.length; i++) {
    selectFields += ", ";
    const field = opts.fields[i];
    if (typeof field === "string") {
      selectFields += `record.${field} as ${field}`;
    } else {
      selectFields += `${field.expr("record")} as e_${i}`;
    }
  }
  return nodes.sourceMap(
    `relatedTable(table: ${opts.table})`,
    nodes.state({
      watch: [ctx.refreshKey],
      procedure: (s) =>
        s.table(
          "record",
          `select id ${selectFields} from db.${ident(
            opts.table,
          )} as record where ${foreignKeyField.name} = ${ctx.recordId}`,
        ),
      children: nodes.element("div", {
        styles: {
          display: "flex",
          flexDirection: "column",
          gap: 1,
          gridColumnSpan: "full",
          overflowX: "auto",
        },
        children: [
          nodes.element("table", {
            children: [
              nodes.element("thead", {
                children: nodes.element("tr", {
                  children: [
                    opts.fields.map((field) => {
                      if (typeof field === "string") {
                        const fieldModel = tableModel.fields[field];
                        return nodes.element("th", {
                          styles: styles.header,
                          children: stringLiteral(fieldModel.displayName),
                        });
                      } else {
                        return nodes.element("th", {
                          styles: styles.header,
                          children: stringLiteral(field.label),
                        });
                      }
                    }),
                    nodes.element("th", {
                      props: { width: "50px" },
                      styles: styles.header,
                      children: `'Edit'`,
                    }),
                    nodes.element("th", {
                      props: { width: "50px" },
                      styles: styles.header,
                      children: `'Delete'`,
                    }),
                  ],
                }),
              }),
              nodes.element("tbody", {
                children: nodes.each({
                  table: "record",
                  recordName: "record",
                  key: "record.id",
                  children: nodes.element("tr", {
                    children: [
                      opts.fields.map((field, i) => {
                        if (typeof field === "string") {
                          const fieldModel = tableModel.fields[field];
                          return nodes.element("td", {
                            styles: styles.cell,
                            children: inlineFieldDisplay(
                              fieldModel,
                              `record.${field}`,
                            ),
                          });
                        } else {
                          const expr = `record.e_${i}`;
                          return nodes.element("td", {
                            styles: styles.cell,
                            children: field.display
                              ? field.display(`record.e_${i}`)
                              : expr,
                          });
                        }
                      }),
                      nodes.state({
                        procedure: (s) =>
                          s
                            .scalar(`editing`, `false`)
                            .scalar(`deleting`, `false`),
                        children: [
                          nodes.element("td", {
                            styles: styles.cell,
                            children: iconButton({
                              variant: "plain",
                              color: "neutral",
                              size: "sm",
                              children: materialIcon("Edit"),
                              ariaLabel: `'Edit'`,
                              on: {
                                click: (s) => s.setScalar(`editing`, `true`),
                              },
                            }),
                          }),
                          updateDialog({
                            content: {
                              type: "AutoLabelOnLeft",
                              ignoreFields: [foreignKeyField.name],
                            },
                            onClose: (s) => s.setScalar(`editing`, `false`),
                            open: `editing`,
                            table: opts.table,
                            recordId: `record.id`,
                            afterTransactionCommit: (_, s) =>
                              s.statements(ctx.triggerRefresh),
                          }),
                          nodes.element("td", {
                            styles: styles.cell,
                            children: iconButton({
                              variant: "plain",
                              color: "danger",
                              size: "sm",
                              children: materialIcon("DeleteOutline"),
                              ariaLabel: `'Delete'`,
                              on: {
                                click: (s) => s.setScalar(`deleting`, `true`),
                              },
                            }),
                          }),
                          deleteRecordDialog({
                            onClose: (s) => s.setScalar(`deleting`, `false`),
                            open: `deleting`,
                            table: ctx.table.name,
                            recordId: `record.id`,
                            afterTransactionCommit: ctx.triggerRefresh,
                          }),
                        ],
                      }),
                    ],
                  }),
                }),
              }),
            ],
          }),
          nodes.state({
            procedure: (s) => s.scalar(`adding`, `false`),
            children: [
              nodes.element("div", {
                styles: { display: "flex", justifyContent: "flex-end" },
                children: button({
                  size: "sm",
                  variant: "outlined",
                  startDecorator: materialIcon("Add"),
                  children:
                    opts.addButtonText ?? `'Add ${ctx.table.displayName}…'`,
                  on: { click: (s) => s.setScalar(`adding`, `true`) },
                }),
              }),
              insertDialog({
                content: deepmerge(
                  {
                    type: "AutoLabelOnLeft",
                    ignoreFields: [foreignKeyField.name],
                  },
                  opts.insertDialog,
                ),
                withValues: { [foreignKeyField.name]: ctx.recordId },
                onClose: (s) => s.setScalar(`adding`, `false`),
                open: `adding`,
                table: opts.table,
                afterTransactionCommit: (_, s) =>
                  s.statements(ctx.triggerRefresh),
              }),
            ],
          }),
        ],
      }),
    }),
  );
}
