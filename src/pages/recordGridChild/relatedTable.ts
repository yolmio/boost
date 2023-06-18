import { each, element, sourceMap, state } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { scalar, setScalar, table } from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay.js";
import { deleteRecordDialog } from "../../components/deleteRecordDialog.js";
import { updateDialog } from "../../components/updateDialog.js";
import { iconButton } from "../../components/iconButton.js";
import { materialIcon } from "../../components/materialIcon.js";
import { button } from "../../components/button.js";
import { insertDialog } from "../../components/insertDialog.js";
import { AutoLabelOnLeftInsertFormContent } from "../../components/internal/insertFormShared.js";
import { deepmerge } from "../../utils/deepmerge.js";
import { RecordGridContext } from "./shared.js";
import { model } from "../../singleton.js";

export const name = "relatedTable";

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

export function content(opts: Opts, ctx: RecordGridContext) {
  const tableModel = model.database.tables[opts.table];
  const foreignKeyField = Object.values(tableModel.fields).find(
    (f) => f.type === "ForeignKey" && f.table === ctx.table.name.name
  );
  if (!foreignKeyField) {
    throw new Error(
      `No foreign key field found for ${ctx.table.name.name} to ${opts.table}`
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
  return sourceMap(
    `relatedTable(table: ${opts.table})`,
    state({
      watch: [ctx.refreshKey],
      procedure: [
        table(
          "record",
          `select id ${selectFields} from db.${ident(
            opts.table
          )} as record where ${foreignKeyField.name.name} = ${ctx.recordId}`
        ),
      ],
      children: element("div", {
        styles: {
          display: "flex",
          flexDirection: "column",
          gap: 1,
          gridColumnSpan: "full",
          overflowX: "auto",
        },
        children: [
          element("table", {
            children: [
              element("thead", {
                children: element("tr", {
                  children: [
                    opts.fields.map((field) => {
                      if (typeof field === "string") {
                        const fieldModel = tableModel.fields[field];
                        return element("th", {
                          styles: styles.header,
                          children: stringLiteral(fieldModel.name.displayName),
                        });
                      } else {
                        return element("th", {
                          styles: styles.header,
                          children: stringLiteral(field.label),
                        });
                      }
                    }),
                    element("th", {
                      props: { width: "50px" },
                      styles: styles.header,
                      children: `'Edit'`,
                    }),
                    element("th", {
                      props: { width: "50px" },
                      styles: styles.header,
                      children: `'Delete'`,
                    }),
                  ],
                }),
              }),
              element("tbody", {
                children: each({
                  table: "record",
                  recordName: "record",
                  key: "record.id",
                  children: element("tr", {
                    children: [
                      opts.fields.map((field, i) => {
                        if (typeof field === "string") {
                          const fieldModel = tableModel.fields[field];
                          return element("td", {
                            styles: styles.cell,
                            children: inlineFieldDisplay(
                              fieldModel,
                              `record.${field}`
                            ),
                          });
                        } else {
                          const expr = `record.e_${i}`;
                          return element("td", {
                            styles: styles.cell,
                            children: field.display
                              ? field.display(`record.e_${i}`)
                              : expr,
                          });
                        }
                      }),
                      state({
                        procedure: [
                          scalar(`editing`, `false`),
                          scalar(`deleting`, `false`),
                        ],
                        children: [
                          element("td", {
                            styles: styles.cell,
                            children: iconButton({
                              variant: "plain",
                              color: "neutral",
                              size: "sm",
                              children: materialIcon("Edit"),
                              on: { click: [setScalar(`editing`, `true`)] },
                            }),
                          }),
                          updateDialog({
                            content: {
                              type: "AutoLabelOnLeft",
                              ignoreFields: [foreignKeyField.name.name],
                            },
                            onClose: [setScalar(`editing`, `false`)],
                            open: `editing`,
                            table: opts.table,
                            recordId: `record.id`,
                            initialRecord: `record`,
                            afterSubmitService: () => [ctx.triggerRefresh],
                          }),
                          element("td", {
                            styles: styles.cell,
                            children: iconButton({
                              variant: "plain",
                              color: "danger",
                              size: "sm",
                              children: materialIcon("DeleteOutline"),
                              on: { click: [setScalar(`deleting`, `true`)] },
                            }),
                          }),
                          deleteRecordDialog({
                            onClose: [setScalar(`deleting`, `false`)],
                            open: `deleting`,
                            table: ctx.table.name.name,
                            recordId: `record.id`,
                            afterDeleteService: [ctx.triggerRefresh],
                          }),
                        ],
                      }),
                    ],
                  }),
                }),
              }),
            ],
          }),
          state({
            procedure: [scalar(`adding`, `false`)],
            children: [
              element("div", {
                styles: { display: "flex", justifyContent: "flex-end" },
                children: button({
                  size: "sm",
                  variant: "outlined",
                  startDecorator: materialIcon("Add"),
                  children: `'Add ${ctx.table.name.displayName}…'`,
                  on: { click: [setScalar(`adding`, `true`)] },
                }),
              }),
              insertDialog({
                content: deepmerge(
                  {
                    type: "AutoLabelOnLeft",
                    ignoreFields: [foreignKeyField.name.name],
                  },
                  opts.insertDialog
                ),
                withValues: { [foreignKeyField.name.name]: ctx.recordId },
                onClose: [setScalar(`adding`, `false`)],
                open: `adding`,
                table: opts.table,
                afterSubmitService: () => [ctx.triggerRefresh],
              }),
            ],
          }),
        ],
      }),
    })
  );
}
