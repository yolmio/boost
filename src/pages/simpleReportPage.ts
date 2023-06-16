import { alert } from "../components/alert.js";
import { button } from "../components/button.js";
import { circularProgress } from "../components/circularProgress.js";
import { formControl } from "../components/formControl.js";
import { formLabel } from "../components/formLabel.js";
import { iconButton } from "../components/iconButton.js";
import { input } from "../components/input.js";
import { materialIcon } from "../components/materialIcon.js";
import { simpleDistinctLineChart } from "../components/simpleDistinctLineChart.js";
import { getTableRecordSelect } from "../components/tableRecordSelect.js";
import { typography } from "../components/typography.js";
import { addPage } from "../modelHelpers.js";
import {
  each,
  element,
  ifNode,
  mode,
  route,
  sourceMap,
  state,
  switchNode,
} from "../nodeHelpers.js";
import { Node, RouteNode } from "../nodeTypes.js";
import {
  debugExpr,
  download,
  if_,
  popSource,
  pushSource,
  queryToCsv,
  scalar,
  setScalar,
  table,
} from "../procHelpers.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { normalizeCase, upcaseFirst } from "../utils/inflectors.js";
import { lazy } from "../utils/memoize.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { FieldType, StateStatement } from "../yom.js";

export type SimpleTableReportOpts = {
  name: string;
  urlName?: string;
  procedure: StateStatement[];
  rows: (string | { header: string; value: string })[];
};

export interface ReportBase {
  name: string;
  urlName?: string;
  procedure?: StateStatement[];
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

export interface StraightLineChart extends ReportBase {
  stateTable?: string;
  query?: string;
  lineChartQuery: string;
  lineChartLabels?: string;
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
  return state({
    procedure: parameters.map((p) => {
      let type: FieldType;
      switch (p.type) {
        case "Date":
          type = { type: "Date" };
          break;
        case "Table":
          type = { type: "BigUint" };
          break;
      }
      return {
        t: "ScalarDeclaration",
        name: p.name,
        expr: p.initialValue,
        type,
      };
    }),
    children: [
      mode({
        render: "'immediate'",
        children: element("div", {
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
          input: [
            if_(`try_cast(target_value as date) is not null`, [
              setScalar(parameter.name, `try_cast(target_value as date)`),
            ]),
          ],
        },
      });
    case "Table":
      return getTableRecordSelect(parameter.table, {
        onSelectValue: (v) => [setScalar(parameter.name, v)],
        value: parameter.name,
      });
  }
}

function tableNode(stateTable: string, columns: TableColumn[]) {
  return element("table", {
    styles: styles.table,
    children: [
      element("thead", {
        children: columns.map((col) =>
          element("th", {
            styles: styles.eachHeaderCell,
            children: stringLiteral(col.header),
          })
        ),
      }),
      element("tbody", {
        children: each({
          table: stateTable,
          recordName: `each_record`,
          children: element("tr", {
            children: columns.map((col) =>
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
  return switchNode(
    [`status in ('requested', 'fallback_triggered')`, progress()],
    [`status = 'failed'`, error()],
    [`true`, node]
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
  return [
    queryToCsv(`select ${selectColumns} from ${tableName} as record`, `csv`),
    download(`${stringLiteral(reportName)} || '.csv'`, `csv`),
  ];
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
    borderRightWidth: 1,
    borderStyle: "solid",
    borderColor: "divider",
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

  singleColumnFixedRowsTable(opts: SingleColumnFixedRowsTableReport) {
    const procedure = opts.procedure ?? [];
    for (let i = 0; i < opts.rows.length; i++) {
      const row = opts.rows[i];
      if (typeof row === "string" || !("expr" in row)) {
        continue;
      }
      procedure.push(pushSource(`opts.rows[${i}].expr`));
      procedure.push(scalar(`row_${i}`, row.expr));
      procedure.push(popSource());
    }
    let node = sourceMap(
      `simpleReportsPage.singleColumnFixedRowsTable(${opts.name})`,
      state({
        watch: opts.parameters?.map((p) => p.name),
        procedure,
        statusScalar: "status",
        children: wrapWithLoadingErrorSwitch(
          element("table", {
            styles: styles.table,
            children: element("tbody", {
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
                return element("tr", {
                  children: [
                    element("th", {
                      styles: styles.staticHeaderCell,
                      props: { scope: "'row'" },
                      children:
                        typeof v === "string"
                          ? stringLiteral(
                              upcaseFirst(normalizeCase(v).join(" "))
                            )
                          : stringLiteral(v.header),
                    }),
                    element("td", {
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
    const procedure = opts.procedure ?? [];
    if (opts.query) {
      procedure.push(pushSource(`options.query`));
      procedure.push(table(`table_report_query`, opts.query));
      procedure.push(popSource());
    }
    const stateTableName = opts.stateTable ?? `table_report_query`;
    let node: Node = sourceMap(
      `simpleReportPage.table(${opts.name})`,
      state({
        watch: opts.parameters?.map((p) => p.name),
        procedure,
        statusScalar: "status",
        children: wrapWithLoadingErrorSwitch([
          opts.download
            ? button({
                variant: "outlined",
                color: "info",
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
    const procedure = opts.procedure ?? [];
    if (opts.left.query) {
      procedure.push(pushSource(`options.left.query`));
      procedure.push(table(`left_table_comparison_query`, opts.left.query));
      procedure.push(popSource());
    }
    if (opts.right.query) {
      procedure.push(pushSource(`options.right.query`));
      procedure.push(table(`right_table_comparison_query`, opts.right.query));
      procedure.push(popSource());
    }
    const leftStateTable =
      opts.left.stateTable ?? `left_table_comparison_query`;
    let leftHeader = opts.left.header;
    if (opts.left.download) {
      const downloadButton = button({
        variant: "outlined",
        color: "info",
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
        leftHeader = element("div", {
          styles: styles.headerTableDownloadWrapper,
          children: [leftHeader, downloadButton],
        });
      } else {
        leftHeader = element("div", {
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
        color: "info",
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
        rightHeader = element("div", {
          styles: styles.headerTableDownloadWrapper,
          children: [rightHeader, downloadButton],
        });
      } else {
        rightHeader = element("div", {
          styles: styles.downloadButtonWraper,
          children: downloadButton,
        });
      }
    }
    let node = sourceMap(
      `simpleReportPage.tableComparison(${opts.name})`,
      state({
        watch: opts.parameters?.map((p) => p.name),
        procedure,
        statusScalar: "status",
        children: wrapWithLoadingErrorSwitch(
          element("div", {
            styles: { display: "flex", gap: 3 },
            children: [
              element("div", {
                styles: { display: "flex", flexDirection: "column", gap: 2 },
                children: [
                  leftHeader,
                  tableNode(leftStateTable, opts.left.columns),
                ],
              }),
              element("div", {
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

  straightLineChart(opts: StraightLineChart) {
    const procedure = opts.procedure ?? [];
    if (opts.query) {
      procedure.push(pushSource(`options.query`));
      procedure.push(table(`query_result`, opts.query));
      procedure.push(popSource());
    }
    let node: Node = sourceMap(
      `simpleReportPage.straightLineChart(${opts.name})`,
      state({
        watch: opts.parameters?.map((p) => p.name),
        procedure,
        statusScalar: "status",
        children: wrapWithLoadingErrorSwitch(
          simpleDistinctLineChart({
            query: opts.lineChartQuery,
            labels: opts.lineChartLabels,
            size: "lg",
          })
        ),
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
      node = ifNode(
        requiredParams.map((p) => `${p.name} is null`).join(" or "),
        alert({
          color: "info",
          variant: "outlined",
          startDecorator: materialIcon("Info"),
          children: `(select string_agg(v, ',') from (values${missingFields}) as t(v)) || ' must be specified to view this report.'`,
        }),
        node
      );
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
      node: element("div", {
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
        element("div", {
          children: [
            typography({
              level: "h6",
              styles: styles.sectionHeader,
              children: stringLiteral(section.header),
            }),
            element("div", {
              styles: styles.sectionLinks,
              children: section.reports.map((r) =>
                element("a", {
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
      for (const report of section.reports) {
        routes.push(
          route({
            path: report.urlName,
            children: element("div", { children: report.node }),
          })
        );
      }
    }
    const content = element("div", {
      styles: styles.root,
      children: [
        element("div", {
          styles: styles.links,
          children: sections,
        }),
        element("div", {
          styles: styles.routeContainer,
          children: {
            t: "Routes",
            children: [
              ...routes,
              route({
                path: "*",
                children: element("div", {
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
    addPage({ path: this.#basePath, content });
  }
}
