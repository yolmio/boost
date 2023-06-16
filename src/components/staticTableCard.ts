import { Field } from "../modelTypes.js";
import { element, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { record } from "../procHelpers.js";
import { model } from "../singleton.js";
import { createStyles, GridDescription } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "./internal/fieldInlineDisplay.js";

export interface StaticTableCard {
  table: string;
  idExpr: string;
  refreshKey?: string;
  rows: (
    | string
    | {
        label: string;
        expr: string;
        display?: (value: string) => Node;
      }
  )[];
}

const styles = createStyles({
  header: {
    fontWeight: "lg",
    color: "text-secondary",
    textAlign: "left",
    py: 1,
  },
  headerWithDivider: {
    fontWeight: "lg",
    color: "text-secondary",
    textAlign: "left",
    borderTop: "1px solid",
    borderColor: "divider",
    py: 1,
  },
  cell: {
    borderTop: "1px solid",
    borderColor: "divider",
    py: 1,
  },
});

export function staticTableCard(opts: StaticTableCard) {
  const tableModel = model.database.tables[opts.table];
  let selectFields = "";
  for (let i = 0; i < opts.rows.length; i++) {
    const row = opts.rows[i];
    selectFields += ", ";
    if (typeof row === "string") {
      const field = tableModel.fields[row];
      if (!field) {
        throw new Error(`Field ${row} not found in table ${opts.table}`);
      }
      selectFields += `record.${field.name.name} as ${field.name.name}`;
    } else {
      selectFields += `${row.expr} as e_${i}`;
    }
  }
  const query = `select id${selectFields} from db.${tableModel.name.name} as record where id = ${opts.idExpr}`;
  return state({
    watch: opts.refreshKey ? [opts.refreshKey] : [],
    procedure: [record(`record`, query)],
    children: element("table", {
      children: element("tbody", {
        children: opts.rows.map((row, i) => {
          if (typeof row === "string") {
            const field = tableModel.fields[row];
            const value = inlineFieldDisplay(
              field,
              `record.${field.name.name}`
            );
            return element("tr", {
              children: [
                element("th", {
                  styles: i === 0 ? styles.header : styles.headerWithDivider,
                  props: { scope: "'row'" },
                  children: stringLiteral(field.name.displayName),
                }),
                element("td", {
                  styles: i === 0 ? {} : styles.cell,
                  children: value,
                }),
              ],
            });
          } else {
            const expr = `record.e_${i}`;
            return element("tr", {
              children: [
                element("th", {
                  styles: i === 0 ? styles.header : styles.headerWithDivider,
                  props: { scope: "'row'" },
                  children: row.label,
                }),
                element("td", {
                  styles: i === 0 ? {} : styles.cell,
                  children: row.display ? (row.display(expr) as Node) : expr,
                }),
              ],
            });
          }
        }),
      }),
    }),
  });
}
