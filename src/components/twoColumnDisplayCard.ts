import { element, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { record } from "../procHelpers.js";
import { model } from "../singleton.js";
import { createStyles } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { inlineFieldDisplay } from "./internal/fieldInlineDisplay.js";

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

export interface TwoColumnDisplayCardOpts {
  table: string;
  recordId: string;
  refreshKey?: string;
  cells: (
    | string
    | {
        label: string;
        expr: string;
        display?: (value: string) => Node;
      }
  )[];
}

export function twoColumnDisplayCard(opts: TwoColumnDisplayCardOpts) {
  const tableModel = model.database.tables[opts.table];
  let selectFields = "";
  for (let i = 0; i < opts.cells.length; i++) {
    const cell = opts.cells[i];
    selectFields += ", ";
    if (typeof cell === "string") {
      const field = tableModel.fields[cell];
      if (!field) {
        throw new Error(`Field ${cell} not found in table ${opts.table}`);
      }
      selectFields += `record.${field.name.name} as ${field.name.name}`;
    } else {
      selectFields += `${cell.expr} as e_${i}`;
    }
  }
  const query = `select id${selectFields} from db.${tableModel.name.name} as record where id = ${opts.recordId}`;
  return state({
    watch: opts.refreshKey ? [opts.refreshKey] : [],
    procedure: [record(`record`, query)],
    children: element("dl", {
      styles: styles.root,
      children: opts.cells.map((row, i) => {
        let label: string;
        let value: Node;
        if (typeof row === "string") {
          const field = tableModel.fields[row];
          label = stringLiteral(field.name.displayName);
          value = inlineFieldDisplay(field, `record.${field.name.name}`);
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
  });
}
