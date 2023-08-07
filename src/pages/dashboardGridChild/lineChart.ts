import { circularProgress } from "../../components/circularProgress";
import { element, ifNode, state } from "../../nodeHelpers";
import { debugExpr, debugQuery, table } from "../../procHelpers";
import { createStyles, cssVar } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";

export const name = "lineChart";

export interface Opts {
  stateQuery: string;
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
  return element("div", {
    styles: styles.root,
    children: [
      element("h3", {
        styles: styles.header,
        children: stringLiteral(opts.header),
      }),
      element("div", {
        styles: styles.card,
        children: state({
          procedure: [table(`result`, opts.stateQuery)],
          statusScalar: `status`,
          children: ifNode(
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
