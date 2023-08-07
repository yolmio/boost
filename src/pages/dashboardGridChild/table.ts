import { card } from "../../components/card";
import { each, element, state } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { table } from "../../procHelpers";
import { createStyles } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";

export const name = "table";

export interface TableColumn {
  header: string;
  cell: (record: string) => Node;
  href?: (record: string) => string;
}

export interface Opts {
  header: string;
  query: string;
  columns: TableColumn[];
}

const styles = createStyles({
  root: {
    gridColumnSpan: "full",
    xl: {
      gridColumnSpan: 6,
    },
  },
  header: {
    fontWeight: "lg",
    fontSize: "lg",
    mt: 0,
    mb: 2,
  },
  table: {
    backgroundColor: "background-body",
    borderCollapse: "separate",
    borderSpacing: 0,
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "md",
    boxShadow: "sm",
    width: "100%",
  },
  eachHeaderCell: {
    px: 2.5,
    py: 1.5,
    fontSize: "sm",
    textAlign: "left",
    fontWeight: "lg",
    color: "text-secondary",
    boxSizing: "border-box",
    borderBottom: "2px solid",
    borderColor: "divider",
    whiteSpace: "nowrap",
  },
  cell: {
    px: 2.5,
    py: 1.5,
    fontSize: "sm",
    boxSizing: "border-box",
    ":not(tr:last-child) > &": {
      borderBottom: "1px solid",
      borderColor: "divider",
    },
    borderColor: "divider",
  },
  cellLink: {
    textDecoration: "none",
    color: "primary-500",
    fontWeight: "lg",
    "&:hover": {
      textDecoration: "underline",
    },
  },
});

export function content(opts: Opts) {
  return element("div", {
    styles: styles.root,
    children: [
      element("h4", {
        styles: styles.header,
        children: stringLiteral(opts.header),
      }),
      state({
        procedure: [table(`table`, opts.query)],
        children: element("table", {
          styles: styles.table,
          children: [
            element("thead", {
              children: opts.columns.map((col) =>
                element("th", {
                  styles: styles.eachHeaderCell,
                  children: stringLiteral(col.header),
                })
              ),
            }),
            element("tbody", {
              children: each({
                table: `table`,
                recordName: `each_record`,
                children: element("tr", {
                  children: opts.columns.map((col) =>
                    element("td", {
                      styles: styles.cell,

                      children: col.href
                        ? element("a", {
                            styles: styles.cellLink,
                            props: {
                              href: col.href(`each_record`),
                            },
                            children: col.cell(`each_record`),
                          })
                        : col.cell(`each_record`),
                    })
                  ),
                }),
              }),
            }),
          ],
        }),
      }),
    ],
  });
}
