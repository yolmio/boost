import { alert } from "../components/alert";
import { button } from "../components/button";
import { circularProgress } from "../components/circularProgress";
import { formControl } from "../components/formControl";
import { formLabel } from "../components/formLabel";
import { input } from "../components/input";
import { materialIcon } from "../components/materialIcon";
import { getTableRecordSelect } from "../components/tableRecordSelect";
import { typography } from "../components/typography";
import { app } from "../app";
import { nodes } from "../nodeHelpers";
import { Node, RouteNode } from "../nodeTypes";
import { createStyles, cssVar } from "../styleUtils";
import { normalizeCase, upcaseFirst } from "../utils/inflectors";
import { lazy } from "../utils/memoize";
import { stringLiteral } from "../utils/sqlHelpers";
import * as yom from "../yom";
import {
  DomStatements,
  StateStatements,
  StateStatementsOrFn,
} from "../statements";

export type SimpleTableReportOpts = {
  name: string;
  urlName?: string;
  procedure: StateStatementsOrFn;
  rows: (string | { header: string; value: string })[];
};

export interface ReportBase {
  name: string;
  urlName?: string;
  procedure?: StateStatementsOrFn;
  parameters?: ReportParameter[];
}

export type ReportParameter = DateParameter | ForeignKeyParameter;

export interface ParameterBase {
  name: string;
  initialValue?: string;
  control?: Node;
  required?: boolean;
}

export interface DateParameter extends ParameterBase {
  type: "Date";
}

export interface ForeignKeyParameter extends ParameterBase {
  type: "Table";
  table: string;
}

export type Row =
  | string
  | { header: string; cell: Node }
  | {
      header: string;
      expr: string;
      cell?: (value: string) => Node;
    };

export interface SingleColumnFixedRowsTableReport extends ReportBase {
  rows: Row[];
}

export interface TableReport extends ReportBase {
  stateTable?: string;
  query?: string;
  columns: TableColumn[];
  download?: boolean;
}

export interface TableColumn {
  header: string;
  downloadHeader?: string;
  cell: (record: string) => Node;
  download?: (record: string) => string;
  href?: (record: string) => string;
}

export interface TableComparisonReport extends ReportBase {
  left: {
    stateTable?: string;
    query?: string;
    header?: Node;
    columns: TableColumn[];
    download?: boolean;
  };
  right: {
    stateTable?: string;
    query?: string;
    header?: Node;
    columns: TableColumn[];
    download?: boolean;
  };
}

export interface CustomReport extends ReportBase {
  state: StateStatementsOrFn;
  node: Node;
}

function getParameterDisplayName(p: ParameterBase): string {
  return stringLiteral(
    p.name
      .split("_")
      .map((v, i) => (i === 0 ? upcaseFirst(v) : v))
      .join(" ")
  );
}

function wrapInParameters(parameters: ReportParameter[], children: Node) {
  return nodes.state({
    procedure: (s) => {
      for (const param of parameters) {
        let type: yom.FieldType;
        switch (param.type) {
          case "Date":
            type = { type: "Date" };
            break;
          case "Table":
            type = { type: "BigUint" };
            break;
        }
        s.scalar(param.name, type, param.initialValue);
      }
    },
    children: [
      nodes.mode({
        render: "'immediate'",
        children: nodes.element("div", {
          styles: styles.parameters,
          children: parameters.map((p) => {
            let control = p.control ?? getParameterControl(p);
            return formControl({
              children: [
                formLabel({
                  children: getParameterDisplayName(p),
                }),
                control,
              ],
            });
          }),
        }),
      }),
      children,
    ],
  });
}

function getParameterControl(parameter: ReportParameter) {
  switch (parameter.type) {
    case "Date":
      return input({
        slots: { input: { props: { type: "'date'", value: parameter.name } } },
        on: {
          input: (s) =>
            s.if(`try_cast(target_value as date) is not null`, (s) =>
              s.setScalar(parameter.name, `try_cast(target_value as date)`)
            ),
        },
      });
    case "Table":
      return getTableRecordSelect(parameter.table, {
        onSelectValue: (v) => (s) => s.setScalar(parameter.name, v),
        value: parameter.name,
      });
  }
}

function tableNode(stateTable: string, columns: TableColumn[]) {
  return nodes.element("table", {
    styles: styles.table,
    children: [
      nodes.element("thead", {
        children: columns.map((col) =>
          nodes.element("th", {
            styles: styles.eachHeaderCell,
            children: stringLiteral(col.header),
          })
        ),
      }),
      nodes.element("tbody", {
        children: nodes.each({
          table: stateTable,
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
              })
            ),
          }),
        }),
      }),
    ],
  });
}

const progress = lazy(() => circularProgress());
const error = lazy(() =>
  alert({
    color: "danger",
    children: `'Unable to generate report at this time. Please try again later.'`,
  })
);

function wrapWithLoadingErrorSwitch(node: Node) {
  return nodes.switch(
    {
      condition: `status in ('requested', 'fallback_triggered')`,
      node: progress(),
    },
    {
      condition: `status = 'failed'`,
      node: error(),
    },
    {
      condition: `true`,
      node,
    }
  );
}

function tableDownloadStatements(
  tableName: string,
  columns: TableColumn[],
  reportName: string
) {
  let selectColumns = "";
  for (const col of columns) {
    const header = col.downloadHeader ?? col.header;
    if (col.download) {
      if (selectColumns) {
        selectColumns += ", ";
      }
      selectColumns += `${col.download("record")} as "${header}"`;
      continue;
    }
    const cell = col.cell(`record`);
    if (typeof cell !== "string") {
      continue;
    }
    if (selectColumns) {
      selectColumns += ", ";
    }
    selectColumns += `${cell} as "${header}"`;
  }
  return (s: DomStatements) =>
    s
      .queryToCsv(`select ${selectColumns} from ${tableName} as record`, `csv`)
      .download(`${stringLiteral(reportName)} || '.csv'`, `csv`);
}

const styles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    md: { flexDirection: "row" },
  },
  links: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "divider",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "divider",
    p: 2,
    gap: 2,
    md: { width: 300 },
  },
  routeContainer: {
    flexGrow: 1,
    height: "100%",
  },
  notFoundPage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  sectionHeader: {
    mb: 1.5,
  },
  sectionLinks: {
    display: "flex",
    flexDirection: "column",
  },
  link: {
    pl: 1.5,
    py: 1,
    textDecoration: "none",
    color: cssVar(`palette-neutral-600`),
    dark: {
      color: cssVar(`palette-neutral-200`),
    },
    fontWeight: "lg",
    borderRadius: "sm",
    "&.active": {
      color: cssVar(`palette-primary-soft-color`),
      dark: {
        color: cssVar(`palette-primary-soft-color`),
      },
      bgcolor: cssVar(`palette-primary-soft-bg`),
    },
  },
  pageHeader: {
    mb: 2,
  },
  parameters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 2,
    mb: 4,
  },
  pageWrapper: {
    py: 3,
    px: 3,
    display: "flex",
    flexDirection: "column",
    alignItems: "start",
  },
  table: {
    backgroundColor: "background-body",
    borderCollapse: "separate",
    borderSpacing: 0,
    border: "1px solid",
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
  },
  staticHeaderCell: {
    px: 2.5,
    py: 1.5,
    fontSize: "sm",
    backgroundColor: "neutral-50",
    textAlign: "left",
    fontWeight: "lg",
    color: "text-secondary",
    boxSizing: "border-box",
    ":not(tr:last-child) > &": {
      borderBottom: "1px solid",
      borderColor: "divider",
    },
    borderRight: "1px solid",
    borderColor: "divider",
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
  downloadButtonWraper: {
    mb: 1,
  },
  headerTableDownloadWrapper: {
    display: "flex",
    gap: 2,
    justifyContent: "space-between",
  },
});

export class SimpleReportsPageBuilder {
  #basePath = "/reports";
  #sections: {
    header: string;
    reports: { urlName: string; displayName: string; node: Node }[];
  }[] = [];

  #currentSection() {
    return this.#sections.at(-1)!;
  }

  section(header: string) {
    this.#sections.push({ header, reports: [] });
  }

  /**
   * Helper function to define parameters that can be shared between reports.
   *
   * Does absolutely nothing except make it so you don't have to import the ReportParameter type.
   */
  defineParams(...params: ReportParameter[]): ReportParameter[] {
    return params;
  }

  singleColumnFixedRowsTable(opts: SingleColumnFixedRowsTableReport) {
    const procedure = StateStatements.normalize(opts.procedure);
    for (let i = 0; i < opts.rows.length; i++) {
      const row = opts.rows[i];
      if (typeof row === "string" || !("expr" in row)) {
        continue;
      }
      procedure.pushSource(`opts.rows[${i}].expr`);
      procedure.scalar(`row_${i}`, row.expr);
      procedure.popSource();
    }
    let node = nodes.sourceMap(
      `simpleReportsPage.singleColumnFixedRowsTable(${opts.name})`,
      nodes.state({
        watch: opts.parameters?.map((p) => p.name),
        procedure,
        statusScalar: "status",
        children: wrapWithLoadingErrorSwitch(
          nodes.element("table", {
            styles: styles.table,
            children: nodes.element("tbody", {
              children: opts.rows.map((v, i) => {
                let cell;
                if (typeof v === "string") {
                  cell = v;
                } else if ("expr" in v) {
                  if (v.cell) {
                    cell = v.cell(`row_${i}`);
                  } else {
                    cell = `row_${i}`;
                  }
                } else {
                  cell = v.cell;
                }
                return nodes.element("tr", {
                  children: [
                    nodes.element("th", {
                      styles: styles.staticHeaderCell,
                      props: { scope: "'row'" },
                      children:
                        typeof v === "string"
                          ? stringLiteral(
                              upcaseFirst(normalizeCase(v).join(" "))
                            )
                          : stringLiteral(v.header),
                    }),
                    nodes.element("td", {
                      styles: styles.cell,
                      children: cell,
                    }),
                  ],
                });
              }),
            }),
          })
        ),
      })
    );
    this.#addReport(node, opts);
  }

  table(opts: TableReport) {
    const procedure = StateStatements.normalize(opts.procedure);
    if (opts.query) {
      procedure.pushSource(`options.query`);
      procedure.table(`table_report_query`, opts.query);
      procedure.popSource();
    }
    const stateTableName = opts.stateTable ?? `table_report_query`;
    let node: Node = nodes.sourceMap(
      `simpleReportPage.table(${opts.name})`,
      nodes.state({
        watch: opts.parameters?.map((p) => p.name),
        procedure,
        statusScalar: "status",
        children: wrapWithLoadingErrorSwitch([
          opts.download
            ? button({
                variant: "outlined",
                color: "primary",
                size: "sm",
                styles: styles.downloadButtonWraper,
                startDecorator: materialIcon("Download"),
                on: {
                  click: tableDownloadStatements(
                    stateTableName,
                    opts.columns,
                    opts.name
                  ),
                },
                children: `'Download table'`,
              })
            : undefined,
          tableNode(opts.stateTable ?? `table_report_query`, opts.columns),
        ]),
      })
    );
    this.#addReport(node, opts);
  }

  tableComparison(opts: TableComparisonReport) {
    const procedure = StateStatements.normalize(opts.procedure);
    if (opts.left.query) {
      procedure.pushSource(`options.left.query`);
      procedure.table(`left_table_comparison_query`, opts.left.query);
      procedure.popSource();
    }
    if (opts.right.query) {
      procedure.pushSource(`options.right.query`);
      procedure.table(`right_table_comparison_query`, opts.right.query);
      procedure.popSource();
    }
    const leftStateTable =
      opts.left.stateTable ?? `left_table_comparison_query`;
    let leftHeader = opts.left.header;
    if (opts.left.download) {
      const downloadButton = button({
        variant: "outlined",
        color: "primary",
        size: "sm",
        startDecorator: materialIcon("Download"),
        on: {
          click: tableDownloadStatements(
            leftStateTable,
            opts.left.columns,
            opts.name
          ),
        },
        children: `'Download table'`,
      });
      if (leftHeader) {
        leftHeader = nodes.element("div", {
          styles: styles.headerTableDownloadWrapper,
          children: [leftHeader, downloadButton],
        });
      } else {
        leftHeader = nodes.element("div", {
          styles: styles.downloadButtonWraper,
          children: downloadButton,
        });
      }
    }
    const rightStateTable =
      opts.right.stateTable ?? `right_table_comparison_query`;
    let rightHeader = opts.right.header;
    if (opts.right.download) {
      const downloadButton = button({
        variant: "outlined",
        color: "primary",
        size: "sm",
        startDecorator: materialIcon("Download"),
        on: {
          click: tableDownloadStatements(
            rightStateTable,
            opts.right.columns,
            opts.name
          ),
        },
        children: `'Download table'`,
      });
      if (leftHeader) {
        rightHeader = nodes.element("div", {
          styles: styles.headerTableDownloadWrapper,
          children: [rightHeader, downloadButton],
        });
      } else {
        rightHeader = nodes.element("div", {
          styles: styles.downloadButtonWraper,
          children: downloadButton,
        });
      }
    }
    let node = nodes.sourceMap(
      `simpleReportPage.tableComparison(${opts.name})`,
      nodes.state({
        watch: opts.parameters?.map((p) => p.name),
        procedure,
        statusScalar: "status",
        children: wrapWithLoadingErrorSwitch(
          nodes.element("div", {
            styles: { display: "flex", gap: 3 },
            children: [
              nodes.element("div", {
                styles: { display: "flex", flexDirection: "column", gap: 2 },
                children: [
                  leftHeader,
                  tableNode(leftStateTable, opts.left.columns),
                ],
              }),
              nodes.element("div", {
                styles: { display: "flex", flexDirection: "column", gap: 2 },
                children: [
                  rightHeader,
                  tableNode(
                    opts.right.stateTable ?? `right_table_comparison_query`,
                    opts.right.columns
                  ),
                ],
              }),
            ],
          })
        ),
      })
    );
    this.#addReport(node, opts);
  }

  customReport(opts: CustomReport) {
    let node: Node = nodes.sourceMap(
      `simpleReportPage.customReport(${opts.name})`,
      nodes.state({
        watch: opts.parameters?.map((p) => p.name),
        procedure: opts.state,
        statusScalar: "status",
        children: wrapWithLoadingErrorSwitch(opts.node),
      })
    );
    this.#addReport(node, opts);
  }

  #addReport(node: Node, base: ReportBase) {
    const requiredParams = base.parameters?.filter((p) => p.required);
    if (requiredParams && requiredParams?.length > 0) {
      const missingFields = requiredParams
        .map(
          (p) =>
            `(case when ${p.name} is null then ` +
            getParameterDisplayName(p) +
            ` end)`
        )
        .join(",");
      node = nodes.if({
        condition: requiredParams.map((p) => `${p.name} is null`).join(" or "),
        then: alert({
          color: "info",
          variant: "outlined",
          startDecorator: materialIcon("Info"),
          children: `(select string_agg(v, ',') from (values${missingFields}) as t(v)) || ' must be specified to view this report.'`,
        }),
        else: node,
      });
    }
    if (base.parameters) {
      node = wrapInParameters(base.parameters, node);
    }
    this.#currentSection().reports.push({
      displayName: base.name,
      urlName:
        base.urlName ??
        normalizeCase(base.name.split(" ").join("-"))
          .map((v) => v.toLowerCase())
          .join("-"),
      node: nodes.element("div", {
        styles: styles.pageWrapper,
        children: [
          typography({
            level: "h4",
            styles: styles.pageHeader,
            children: stringLiteral(base.name),
          }),
          node,
        ],
      }),
    });
  }

  finish() {
    const sections: Node[] = [];
    const routes: RouteNode[] = [];
    for (const section of this.#sections) {
      sections.push(
        nodes.element("div", {
          children: [
            typography({
              level: "h6",
              styles: styles.sectionHeader,
              children: stringLiteral(section.header),
            }),
            nodes.element("div", {
              styles: styles.sectionLinks,
              children: section.reports.map((r) =>
                nodes.element("a", {
                  styles: styles.link,
                  dynamicClasses: [
                    {
                      classes: "active",
                      condition: `uri.is_match(location.pathname, ${stringLiteral(
                        this.#basePath + "/" + r.urlName
                      )})`,
                    },
                  ],
                  props: {
                    href: stringLiteral(this.#basePath + "/" + r.urlName),
                  },
                  children: stringLiteral(r.displayName),
                })
              ),
            }),
          ],
        })
      );
      if (section.reports.length === 0) {
        throw new Error("Section must have at least one report");
      }
      for (const report of section.reports) {
        routes.push(
          nodes.route({
            path: report.urlName,
            children: nodes.element("div", { children: report.node }),
          })
        );
      }
    }
    const content = nodes.element("div", {
      styles: styles.root,
      children: [
        nodes.element("div", {
          styles: styles.links,
          children: sections,
        }),
        nodes.element("div", {
          styles: styles.routeContainer,
          children: {
            t: "Routes",
            children: [
              ...routes,
              nodes.route({
                path: "*",
                children: nodes.element("div", {
                  styles: styles.notFoundPage,
                  children: typography({
                    level: "h5",
                    children: `'Click on any report to see it here!'`,
                  }),
                }),
              }),
            ],
          },
        }),
      ],
    });
    app.ui.pages.push({
      path: this.#basePath,
      content,
    });
  }
}
