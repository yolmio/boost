import { each, element, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { scalar, setScalar, table } from "../procHelpers.js";
import { model } from "../singleton.js";
import { flexGrowStyles } from "../styleUtils.js";
import { pluralize } from "../utils/inflectors.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "./internal/fieldInlineDisplay.js";
import { button } from "./button.js";
import { card } from "./card.js";
import { deleteRecordDialog } from "./deleteRecordDialog.js";
import { updateDialog } from "./updateDialog.js";
import { iconButton } from "./iconButton.js";
import { materialIcon } from "./materialIcon.js";
import { typography } from "./typography.js";

export interface RelatedCardOpts {
  table: string;
  foreignKeyId: string;
  foreignKeyTable: string;
  fields: (
    | string
    | {
        expr: (record: string) => string;
        display?: (e: string) => Node;
        label: string;
      }
  )[];
}

export function relatedCardList(opts: RelatedCardOpts) {
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
    procedure: [scalar(`refresh_key`, `0`)],
    children: state({
      watch: [`refresh_key`],
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
        },
        children: [
          element("div", {
            styles: {
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 1,
            },
            children: [
              typography({
                children: `${stringLiteral(
                  pluralize(tableModel.name.displayName)
                )}`,
              }),
              button({
                children: `'Add'`,
                size: "sm",
                startDecorator: materialIcon("Add"),
              }),
            ],
          }),
          each({
            table: "record",
            recordName: "record",
            children: card({
              variant: "outlined",
              styles: {
                display: "flex",
                flexDirection: "row",
                gap: 1,
                alignItems: "baseline",
              },
              children: [
                element("div", {
                  styles: { display: "flex", gap: 1 },
                  children: opts.fields.map((f, i) => {
                    if (typeof f === "string") {
                      const field = tableModel.fields[f];
                      return element("p", {
                        children: [
                          element("span", {
                            styles: {
                              fontWeight: "lg",
                              color: "text-secondary",
                            },
                            children: `${stringLiteral(
                              field.name.displayName
                            )} || ': '`,
                          }),
                          inlineFieldDisplay(
                            tableModel.fields[f],
                            `record.${f}`
                          ),
                        ],
                      });
                    } else {
                      const expr = `record.e_${i}`;
                      return element("p", {
                        children: [
                          element("span", {
                            styles: {
                              fontWeight: "lg",
                              color: "text-secondary",
                            },
                            children: `${stringLiteral(f.label)} || ': '`,
                          }),
                          f.display?.(expr) ?? expr,
                        ],
                      });
                    }
                  }),
                }),
                element("div", { styles: flexGrowStyles }),
                state({
                  procedure: [scalar(`editing`, `false`)],
                  children: [
                    iconButton({
                      variant: "plain",
                      color: "neutral",
                      size: "sm",
                      children: materialIcon("Edit"),
                      on: { click: [setScalar(`ui.editing`, `true`)] },
                    }),
                    // editDialog({
                    //   open: `editing`,
                    //   onClose: [setScalar(`ui.editing`, `false`)],
                    //   recordId: `record.id`,
                    //   initialRecord: `record`,
                    //   table: opts.table,
                    //   parts: [
                    //     {
                    //       colSpan: 12,
                    //       field: "product",
                    //       initialValue: `record.product`,
                    //     },
                    //     //   {
                    //     //     colSpan: 12,
                    //     //     field: "unit_price",
                    //     //     initialValue: `record.unit_price`,
                    //     //   },
                    //     {
                    //       colSpan: 12,
                    //       field: "quantity",
                    //       initialValue: `record.quantity`,
                    //     },
                    //     //   {
                    //     //     colSpan: 12,
                    //     //     field: "discount",
                    //     //     initialValue: `record.discount`,
                    //     //   },
                    //   ],
                    //   afterSubmitService:
                    //     () => [setScalar(`refresh_key`, `refresh_key + 1`)],
                    // }),
                  ],
                }),
                state({
                  procedure: [scalar(`deleting`, `false`)],
                  children: [
                    iconButton({
                      variant: "soft",
                      color: "danger",
                      size: "sm",
                      children: materialIcon("Delete"),
                      on: { click: [setScalar(`ui.deleting`, `true`)] },
                    }),
                    deleteRecordDialog({
                      open: `deleting`,
                      onClose: [setScalar(`ui.deleting`, `false`)],
                      recordId: `record.id`,
                      table: opts.table,
                      confirmDescription: `'Are you sure you want to delete this detail?'`,
                      afterDeleteService: [
                        setScalar(`refresh_key`, `refresh_key + 1`),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
    }),
  });
}
