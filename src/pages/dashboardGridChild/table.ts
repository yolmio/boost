import { alert, materialIcon, skeleton, typography } from "../../components";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles } from "../../styleUtils";
import { normalizeCase, upcaseFirst } from "../../utils/inflectors";
import { stringLiteral } from "../../utils/sqlHelpers";

export interface TableColumnObject {
  header: string;
  cell: (record: string) => Node;
  href?: (record: string) => string;
}

export interface Opts {
  header: string;
  query: string;
  columns: (string | TableColumnObject)[];
}

const styles = createStyles({
  root: {
    gridColumnSpan: "full",
    display: "flex",
    flexDirection: "column",
    gap: 1.5,
    xl: {
      gridColumnSpan: 6,
    },
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
  const columns = opts.columns.map((col) =>
    typeof col === "string"
      ? {
          header: upcaseFirst(normalizeCase(col).join(" ")),
          cell: (r: string) => `${r}.${col}`,
        }
      : col,
  );
  return nodes.element("div", {
    styles: styles.root,
    children: [
      typography({
        level: "h4",
        children: stringLiteral(opts.header),
      }),
      nodes.state({
        watch: [`global_refresh_key`],
        procedure: (s) => s.table(`table`, opts.query),
        statusScalar: `status`,
        children: nodes.if({
          condition: `status = 'failed'`,
          then: alert({
            size: "lg",
            startDecorator: materialIcon("Error"),
            color: "danger",
            children: `'Error'`,
          }),
          else: nodes.element("table", {
            styles: styles.table,
            children: [
              nodes.element("thead", {
                children: columns.map((col) =>
                  nodes.element("th", {
                    styles: styles.eachHeaderCell,
                    children: stringLiteral(col.header),
                  }),
                ),
              }),
              nodes.element("tbody", {
                children: nodes.if({
                  condition: `status in ('requested', 'fallback_triggered')`,
                  then: nodes.element("tr", {
                    children: opts.columns.map(() =>
                      nodes.element("td", {
                        styles: styles.cell,
                        children: skeleton({
                          variant: "text",
                          level: "body-md",
                        }),
                      }),
                    ),
                  }),
                  else: nodes.each({
                    table: `table`,
                    recordName: `each_record`,
                    children: nodes.element("tr", {
                      children: columns.map((col) =>
                        nodes.element("td", {
                          styles: styles.cell,
                          children: col.href
                            ? nodes.element("a", {
                                styles: styles.cellLink,
                                props: {
                                  href: col.href(`each_record`),
                                },
                                children: col.cell(`each_record`),
                              })
                            : col.cell(`each_record`),
                        }),
                      ),
                    }),
                  }),
                }),
              }),
            ],
          }),
        }),
      }),
    ],
  });
}
