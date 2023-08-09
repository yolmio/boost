import { circularProgress } from "../../components/circularProgress";
import { nodes } from "../../nodeHelpers";
import { StateStatementsOrFn } from "../../statements";
import { createStyles, cssVar } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import * as yom from "../../yom";

export interface Opts {
  /**
   * Adds a state node wrapper around the bar chart where you can query the database.
   *
   * If as string is passed, a table `result` is created with the result of the query
   */
  state: yom.SqlQuery | StateStatementsOrFn;
  lineChartQuery: string;
  labels: string;
  header: string;
  reverseData?: string;
}

const styles = createStyles({
  root: {
    gridColumnSpan: "full",
    display: "flex",
    flexDirection: "column",
    lg: { gridColumnSpan: 6 },
  },
  card: {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "md",
    boxShadow: "sm",
    pr: 1.5,
    pl: 1,
    pt: 1,
    pb: 1.5,
  },
  chartRoot: {
    color: "neutral-plain-color",
    height: "100%",
    width: "100%",
  },
  line: {
    strokeWidth: 4,
    fill: "none",
    stroke: cssVar("palette-primary-400"),
  },
  grid: {
    stroke: cssVar(`palette-neutral-200`),
    strokeWidth: 1,
    strokeDasharray: "2px",
  },
  point: {
    strokeLinecap: "round",
    strokeWidth: 10,
    stroke: cssVar("palette-primary-400"),
  },
  label: {
    fontSize: ".75rem",
    lineHeight: 1,
    display: "flex",
    userSelect: "none",
    "&.ct-horizontal": {
      justifyContent: "flex-start",
      alignItems: "flex-start",
    },
    "&.ct-vertical": {
      justifyContent: "flex-end",
      alignItems: "flex-end",
    },
  },
  header: {
    fontWeight: "lg",
    fontSize: "lg",
    mt: 0,
    mb: 1,
  },
});

export function content(opts: Opts) {
  return nodes.element("div", {
    styles: styles.root,
    children: [
      nodes.element("h3", {
        styles: styles.header,
        children: stringLiteral(opts.header),
      }),
      nodes.element("div", {
        styles: styles.card,
        children: nodes.state({
          procedure:
            typeof opts.state === "string"
              ? (s) => s.table(`result`, opts.state as string)
              : opts.state,
          statusScalar: `status`,
          children: nodes.if(
            `status = 'fallback_triggered'`,
            circularProgress({ size: "md" }),
            {
              t: "LineChart",
              series: [{ query: opts.lineChartQuery }],
              styles: {
                root: styles.chartRoot,
                grid: styles.grid,
                line: styles.line,
                label: styles.label,
                point: styles.point,
              },
              chartPadding: { top: "16", right: "0", left: "0", bottom: "0" },
              labels: opts.labels,
              reverseData: opts.reverseData,
            }
          ),
        }),
      }),
    ],
  });
}
