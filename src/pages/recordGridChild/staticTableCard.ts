import { element, state } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { record } from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay.js";
import { RecordGridContext } from "./shared.js";
import { card } from "../../components/card.js";
import { Style } from "../../styleTypes.js";

export const name = "staticTableCard";

type Row =
  | string
  | {
      label: string;
      expr: string;
      display?: (value: string) => Node;
    };

export interface Opts {
  styles?: Style;
  rows: ((ctx: RecordGridContext) => Row[]) | Row[];
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

export function content(opts: Opts, ctx: RecordGridContext) {
  let selectFields = "";
  const rows = Array.isArray(opts.rows) ? opts.rows : opts.rows(ctx);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    selectFields += ", ";
    if (typeof row === "string") {
      const field = ctx.table.fields[row];
      if (!field) {
        throw new Error(`Field ${row} not found in table ${ctx.table.name}`);
      }
      selectFields += `record.${field.name} as ${field.name}`;
    } else {
      selectFields += `${row.expr} as e_${i}`;
    }
  }
  const query = `select id${selectFields} from db.${ctx.table.name} as record where id = ${ctx.recordId}`;
  return card({
    variant: "outlined",
    styles: opts.styles,
    children: state({
      watch: [ctx.refreshKey],
      procedure: [record(`record`, query)],
      children: element("table", {
        children: element("tbody", {
          children: rows.map((row, i) => {
            if (typeof row === "string") {
              const field = ctx.table.fields[row];
              const value = inlineFieldDisplay(field, `record.${field.name}`);
              return element("tr", {
                children: [
                  element("th", {
                    styles: i === 0 ? styles.header : styles.headerWithDivider,
                    props: { scope: "'row'" },
                    children: stringLiteral(field.displayName),
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
    }),
  });
}
