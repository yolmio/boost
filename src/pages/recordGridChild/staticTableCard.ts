import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay";
import { card } from "../../components/card";
import { Style } from "../../styleTypes";
import { RecordGridBuilder } from "../recordGrid";

type Row =
  | string
  | {
      label: string;
      expr: string;
      display?: (value: string) => Node;
    };

export interface Opts {
  styles?: Style;
  rows: Row[];
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

export function content(opts: Opts, ctx: RecordGridBuilder) {
  let selectFields = "";
  const rows = opts.rows;
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
    children: nodes.state({
      watch: ctx.refreshKeys,
      procedure: (s) => s.record(`record`, query),
      children: nodes.element("table", {
        children: nodes.element("tbody", {
          children: rows.map((row, i) => {
            if (typeof row === "string") {
              const field = ctx.table.fields[row];
              const value = inlineFieldDisplay(field, `record.${field.name}`);
              return nodes.element("tr", {
                children: [
                  nodes.element("th", {
                    styles: i === 0 ? styles.header : styles.headerWithDivider,
                    props: { scope: "'row'" },
                    children: stringLiteral(field.displayName),
                  }),
                  nodes.element("td", {
                    styles: i === 0 ? {} : styles.cell,
                    children: value,
                  }),
                ],
              });
            } else {
              const expr = `record.e_${i}`;
              return nodes.element("tr", {
                children: [
                  nodes.element("th", {
                    styles: i === 0 ? styles.header : styles.headerWithDivider,
                    props: { scope: "'row'" },
                    children: row.label,
                  }),
                  nodes.element("td", {
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
