import { circularProgress } from "../../components/circularProgress.js";
import { element, ifNode, state } from "../../nodeHelpers.js";
import { table } from "../../procHelpers.js";
import { Style } from "../../styleTypes.js";
import { createStyles, cssVar } from "../../styleUtils.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";

export const name = "pieChart";

export interface Opts {
  styles?: Style;
  cardStyles?: Style;
  stateQuery: string;
  lineChartQuery: string;
  labels: string;
  header: string;
  donut?: boolean;
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
  return element("div", {
    styles: opts.styles ? [styles.root, opts.styles] : styles.root,
    children: [
      element("h3", {
        styles: styles.header,
        children: stringLiteral(opts.header),
      }),
      element("div", {
        styles: opts.cardStyles ? [styles.card, opts.cardStyles] : styles.card,
        children: state({
          procedure: [table(`result`, opts.stateQuery)],
          statusScalar: `status`,
          children: ifNode(
            `status = 'fallback_triggered'`,
            circularProgress({ size: "md" }),
            {
              t: "PieChart",
              series: opts.lineChartQuery,
              styles: {
                root: styles.chartRoot,
                sliceDonut: styles.slice,
                label: styles.label,
              },
              donut: opts.donut?.toString(),
              donutWidth: "30",
              labels: opts.labels,
              labelDirection: "'explode'",
              labelOffset: "32",
              chartPadding: "56",
            }
          ),
        }),
      }),
    ],
  });
}
