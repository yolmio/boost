import { each, element, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { scalar, setScalar, table } from "../procHelpers.js";
import { model } from "../singleton.js";
import { createStyles } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "./internal/fieldInlineDisplay.js";
import { deleteRecordDialog } from "./deleteRecordDialog.js";
import { updateDialog } from "./updateDialog.js";
import { iconButton } from "./iconButton.js";
import { materialIcon } from "./materialIcon.js";
import { BaseStatement } from "../yom.js";
import { button } from "./button.js";
import { insertDialog } from "./insertDialog.js";
import { AutoLabelOnLeftInsertFormContent } from "./internal/insertFormShared.js";
import { deepmerge } from "../utils/deepmerge.js";

export interface RelatedTableFooterOpts {
  table: string;
  foreignKeyId: string;
  foreignKeyTable: string;
  refreshKey: string;
  triggerRefresh: BaseStatement;
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

export function relatedTableFooter(opts: RelatedTableFooterOpts) {
  const tableModel = model.database.tables[opts.table];
  const foreignKeyField = Object.values(tableModel.fields).find(
    (f) => f.type === "ForeignKey" && f.table === opts.foreignKeyTable
  );
  if (!foreignKeyField) {
    throw new Error(
      `No foreign key field found for ${opts.table} to ${opts.foreignKeyTable}`
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
  return state({
    watch: [opts.refreshKey],
    procedure: [
      table(
        "record",
        `select id ${selectFields} from db.${tableModel.name.name} as record where ${foreignKeyField.name.name} = ${opts.foreignKeyId}`
      ),
    ],
    children: element("div", {
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: 1,
        gridColumn: `span 12 / span 12`,
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
                          afterSubmitService: () => [opts.triggerRefresh],
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
                          table: opts.table,
                          recordId: `record.id`,
                          afterDeleteService: [opts.triggerRefresh],
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
                children: `'Add ${tableModel.name.displayName}…'`,
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
              withValues: { [foreignKeyField.name.name]: opts.foreignKeyId },
              onClose: [setScalar(`adding`, `false`)],
              open: `adding`,
              table: opts.table,
              afterSubmitService: () => [opts.triggerRefresh],
            }),
          ],
        }),
      ],
    }),
  });
}
