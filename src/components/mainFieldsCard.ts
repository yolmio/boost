import { Field } from "../modelTypes.js";
import { element, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { record, scalar } from "../procHelpers.js";
import { model } from "../singleton.js";
import {
  flexGrowStyles,
  getGridItemStyles,
  getGridStyles,
  GridDescription,
  GridItemDescription,
} from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "./internal/fieldInlineDisplay.js";
import { button } from "./button.js";
import { materialIcon } from "./materialIcon.js";
import { typography } from "./typography.js";

export interface FieldDisplayPart extends GridItemDescription {
  field?: string;
}

export interface MainFieldsCard extends GridDescription {
  table: string;
  idExpr: string;
  header: string;
  parts: FieldDisplayPart[];
}

export function mainFieldsCard(opts: MainFieldsCard) {
  const tableModel = model.database.tables[opts.table];
  const fields: Field[] = [];
  for (const part of opts.parts) {
    if (part.field) {
      const field = tableModel.fields[part.field];
      if (!field) {
        throw new Error(`Field ${part.field} not found in table ${opts.table}`);
      }
      fields.push(field);
    }
  }
  const selectFields = fields
    .map((f) => `record.${f.name.name} as ${f.name.name}`)
    .join(", ");
  const query = `select id, ${selectFields} from db.${tableModel.name.name} as record where id = ${opts.idExpr}`;
  return state({
    procedure: [record(`record`, query)],
    children: element("div", {
      styles: getGridStyles(opts),
      children: [
        element("div", {
          styles: { gridColumn: `span 12 / span 12`, display: "flex", gap: 1 },
          children: [
            typography({
              level: "h5",
              children: opts.header,
            }),
            element("div", {
              styles: flexGrowStyles,
            }),
            button({
              children: "'Edit'",
              variant: "soft",
              size: "sm",
              color: "info",
              startDecorator: materialIcon("Edit"),
            }),
            button({
              children: "'Delete'",
              variant: "soft",
              size: "sm",
              color: "danger",
              startDecorator: materialIcon("Delete"),
            }),
          ],
        }),
        opts.parts.map((part) => {
          const gridItemStyles = getGridItemStyles(part);
          if (!("field" in part)) {
            return element("div", { styles: gridItemStyles });
          }
          const fieldModel = tableModel.fields[part.field!];
          const value = inlineFieldDisplay(
            fieldModel,
            `record.${fieldModel.name.name}`
          );
          return element("div", {
            styles: [
              { display: "flex", flexDirection: "column", minHeight: 48 },
              gridItemStyles,
            ],
            children: [
              typography({
                level: "body2",
                children: stringLiteral(fieldModel.name.displayName),
              }),
              value,
            ],
          });
        }),
      ],
    }),
  });
}
