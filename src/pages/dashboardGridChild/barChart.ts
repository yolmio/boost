import { circularProgress } from "../../components/circularProgress";
import { element, ifNode, state } from "../../nodeHelpers";
import { table } from "../../procHelpers";
import { Styles, createStyles, cssVar } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { SqlExpression, SqlQuery, StateStatement } from "../../yom";

export const name = "barChart";

export interface Opts {
  styles?: Styles;
  /**
   * Adds a state node wrapper around the bar chart where you can query the database.
   *
   * If as string is passed, a table `result` is created with the result of the query
   */
  state: SqlQuery | StateStatement[];
  series: { query: SqlQuery; name: string }[];
  labels: SqlQuery;
  header: string;
  reverseData?: string;
  axisY?: {
    labelInterpolation?: SqlExpression;
  };
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
  grid: {
    stroke: cssVar(`palette-neutral-200`),
    strokeWidth: 1,
    strokeDasharray: "2px",
  },
  bar: {
    fill: "none",
    strokeWidth: 10,
    ".ct-series-a &": {
      stroke: cssVar("palette-primary-400"),
    },
    ".ct-series-b &": {
      stroke: cssVar("palette-info-400"),
    },
  },
  label: {
    fontSize: "xs",
    lineHeight: 1,
    display: "flex",
    userSelect: "none",
    "&.ct-horizontal": {
      justifyContent: "center",
      alignItems: "flex-start",
      textOverflow: "ellipsis",
    },
    "&.ct-vertical": {
      justifyContent: "flex-end",
      alignItems: "flex-end",
    },
  },
  legends: {
    display: "flex",
    justifyContent: "end",
    gap: 1,
    pt: 1,
    pb: 1.5,
  },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
  },
  legendText: {
    fontSize: "xs",
    fontWeight: "md",
  },
  legendBall: {
    width: 12,
    height: 12,
    borderRadius: 12,
    "&.ct-series-0": {
      backgroundColor: "primary-400",
    },
    "&.ct-series-1": {
      backgroundColor: "info-400",
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
    styles: opts.styles ? [styles.root, opts.styles] : styles.root,
    children: [
      element("h3", {
        styles: styles.header,
        children: stringLiteral(opts.header),
      }),
      element("div", {
        styles: styles.card,
        children: state({
          procedure:
            typeof opts.state === "string"
              ? [table(`result`, opts.state)]
              : opts.state,
          statusScalar: `status`,
          children: ifNode(
            `status = 'fallback_triggered'`,
            circularProgress({ size: "md" }),
            element("div", {
              children: [
                element("div", {
                  styles: styles.legends,
                  children: opts.series.map(({ name }, i) =>
                    element("div", {
                      styles: styles.legend,
                      children: [
                        element("span", {
                          styles: styles.legendBall,
                          classes: `ct-series-${i}`,
                        }),
                        element("span", {
                          styles: styles.legendText,
                          children: stringLiteral(name),
                        }),
                      ],
                    })
                  ),
                }),
                {
                  t: "BarChart",
                  series: opts.series.map(({ query }) => ({ query })),
                  styles: {
                    root: styles.chartRoot,
                    grid: styles.grid,
                    label: styles.label,
                    bar: styles.bar,
                  },
                  chartPadding: {
                    top: "0",
                    right: "0",
                    left: "0",
                    bottom: "0",
                  },
                  labels: opts.labels,
                  reverseData: opts.reverseData,
                  axisY: opts.axisY,
                },
              ],
            })
          ),
        }),
      }),
    ],
  });
}
