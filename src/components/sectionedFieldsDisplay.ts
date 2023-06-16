import { Field } from "../modelTypes.js";
import { element, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { record, scalar } from "../procHelpers.js";
import { model } from "../singleton.js";
import {
  getGridItemStyles,
  getGridStyles,
  GridDescription,
  GridItemDescription,
} from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "./internal/fieldInlineDisplay.js";
import { typography } from "./typography.js";

export interface FieldDisplayPart extends GridItemDescription {
  field?: string;
}

export interface Section extends GridDescription {
  header?: string;
  parts: FieldDisplayPart[];
}

export interface SectionedFieldsDisplayOpts {
  table: string;
  idExpr: string;
  sections: Section[];
}

export function sectionedFieldsDisplay(opts: SectionedFieldsDisplayOpts) {
  const tableModel = model.database.tables[opts.table];
  const fields: Field[] = [];
  for (const section of opts.sections) {
    for (const part of section.parts) {
      if (part.field) {
        fields.push(tableModel.fields[part.field]);
      }
    }
  }
  const selectFields = fields
    .map((f) => `record.${f.name.name} as ${f.name.name}`)
    .join(", ");
  const query = `select id, ${selectFields} from db.${tableModel.name.name} as record where id = ${opts.idExpr}`;
  return state({
    procedure: [record(`record`, query)],
    children: element("div", {
      styles: { display: "flex", flexDirection: "column", gap: 3 },
      children: opts.sections.map((s) => {
        const children: Node[] = [];
        if (s.header) {
          children.push(
            typography({
              level: "h5",
              styles: { gridColumn: `span 12 / span 12` },
              children: s.header,
            })
          );
        }
        for (const part of s.parts) {
          const gridItemStyles = getGridItemStyles(part);
          if (!("field" in part)) {
            children.push(element("div", { styles: gridItemStyles }));
            continue;
          }
          const fieldModel = tableModel.fields[part.field!];
          const value = inlineFieldDisplay(
            fieldModel,
            `record.${fieldModel.name.name}`
          );
          children.push(
            element("div", {
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
            })
          );
        }
        return element("div", {
          styles: getGridStyles(s),
          children,
        });
      }),
    }),
  });
}
