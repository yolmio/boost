import { element, state } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { record } from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay.js";
import { RecordGridContext } from "./shared.js";
import { Style } from "../../styleTypes.js";
import { card } from "../../components/card.js";

export const name = "twoColumnDisplayCard";

const styles = createStyles({
  root: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 1,
    my: 0,
    md: {
      my: 0.5,
      gridTemplateColumns: "1fr 1fr",
    },
  },
  cell: {
    display: "flex",
    flexDirection: "column",
    minHeight: 54,
  },
  label: {
    fontWeight: "lg",
    fontSize: "sm",
    pl: 1.5,
  },
  data: {
    p: 0,
    m: 0,
    pl: 1.5,
    mt: 0.5,
    fontSize: "md",
    color: "text-secondary",
  },
});

export interface Opts {
  styles?: Style;
  cells: (
    | string
    | {
        label: string;
        expr: string;
        display?: (value: string) => Node;
      }
  )[];
}

export function content(opts: Opts, ctx: RecordGridContext) {
  let selectFields = "";
  for (let i = 0; i < opts.cells.length; i++) {
    const cell = opts.cells[i];
    selectFields += ", ";
    if (typeof cell === "string") {
      const field = ctx.table.fields[cell];
      if (!field) {
        throw new Error(`Field ${cell} not found in table ${ctx.table.name}`);
      }
      selectFields += `record.${field.name} as ${field.name}`;
    } else {
      selectFields += `${cell.expr} as e_${i}`;
    }
  }
  const query = `select id${selectFields} from db.${ident(
    ctx.table.name
  )} as record where id = ${ctx.recordId}`;
  return card({
    variant: "outlined",
    styles: opts.styles,
    children: state({
      watch: [ctx.refreshKey],
      procedure: [record(`record`, query)],
      children: element("dl", {
        styles: styles.root,
        children: opts.cells.map((row, i) => {
          let label: string;
          let value: Node;
          if (typeof row === "string") {
            const field = ctx.table.fields[row];
            label = stringLiteral(field.displayName);
            value = inlineFieldDisplay(field, `record.${field.name}`);
          } else {
            label = row.label;
            const expr = `record.e_${i}`;
            value = row.display ? (row.display(expr) as Node) : expr;
          }
          return element("div", {
            styles: styles.cell,
            children: [
              element("dt", { styles: styles.label, children: label }),
              element("dd", { styles: styles.data, children: value }),
            ],
          });
        }),
      }),
    }),
  });
}
