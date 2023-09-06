import { circularProgress } from "../../components/circularProgress";
import { nodes } from "../../nodeHelpers";
import { PieChartNode } from "../../nodeTypes";
import { Style } from "../../styleTypes";
import { createStyles, cssVar } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { StateStatementsOrFn } from "../../statements";
import * as yom from "../../yom";

export interface Opts {
  styles?: Style;
  cardStyles?: Style;
  stateQuery?: string;
  /**
   * Adds a state node wrapper around the bar chart where you can query the database.
   *
   * If as string is passed, a table `result` is created with the result of the query
   */
  state: yom.SqlQuery | StateStatementsOrFn;
  header: string;
  pieChartOpts: Omit<PieChartNode, "t" | "styles">;
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
    height: "100%",
  },
  header: {
    fontWeight: "lg",
    fontSize: "lg",
    mt: 0,
    mb: 1,
  },
  chartRoot: {
    color: "neutral-plain-color",
    height: "100%",
    width: "100%",
  },
  label: {
    fontSize: "sm",
    fontWeight: "md",
    fill: cssVar("palette-text-secondary"),
    userSelect: "none",
  },
  slice: {
    fill: "transparent",
    ".ct-series-a &": {
      stroke: cssVar("palette-primary-400"),
    },
    ".ct-series-b &": {
      stroke: cssVar("palette-info-400"),
    },
    ".ct-series-c &": {
      stroke: cssVar("palette-danger-400"),
    },
    ".ct-series-d &": {
      stroke: cssVar("palette-success-400"),
    },
    ".ct-series-e &": {
      stroke: cssVar("palette-primary-300"),
    },
    ".ct-series-f &": {
      stroke: cssVar("palette-info-300"),
    },
    ".ct-series-g &": {
      stroke: cssVar("palette-danger-300"),
    },
    ".ct-series-h &": {
      stroke: cssVar("palette-success-300"),
    },
    ".ct-series-i &": {
      stroke: cssVar("palette-primary-200"),
    },
    ".ct-series-j &": {
      stroke: cssVar("palette-info-200"),
    },
    ".ct-series-k &": {
      stroke: cssVar("palette-danger-200"),
    },
    ".ct-series-l &": {
      stroke: cssVar("palette-success-200"),
    },
  },
});

export function content(opts: Opts) {
  if (!opts.stateQuery && !opts.state) {
    throw new Error("pieChart expects either stateQuery or state");
  }
  return nodes.element("div", {
    styles: opts.styles ? [styles.root, opts.styles] : styles.root,
    children: [
      nodes.element("h3", {
        styles: styles.header,
        children: stringLiteral(opts.header),
      }),
      nodes.element("div", {
        styles: opts.cardStyles ? [styles.card, opts.cardStyles] : styles.card,
        children: nodes.state({
          procedure:
            typeof opts.state === "string"
              ? (s) => s.table(`result`, opts.state as string)
              : opts.state,
          statusScalar: `status`,
          children: nodes.if({
            condition: `status = 'fallback_triggered'`,
            then: circularProgress({ size: "md" }),
            else: {
              t: "PieChart",
              styles: {
                root: styles.chartRoot,
                sliceDonut: styles.slice,
                label: styles.label,
              },
              donutWidth: "30",
              labelDirection: "'explode'",
              labelOffset: "32",
              chartPadding: "56",
              ...opts.pieChartOpts,
            },
          }),
        }),
      }),
    ],
  });
}
