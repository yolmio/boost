import { circularProgress } from "../../components/circularProgress";
import { nodes } from "../../nodeHelpers";
import { StateStatementsOrFn } from "../../statements";
import { Styles, createStyles, cssVar } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import * as yom from "../../yom";

export interface Opts {
  styles?: Styles;
  /**
   * Adds a state node wrapper around the bar chart where you can query the database.
   *
   * If as string is passed, a table `result` is created with the result of the query
   */
  state: yom.SqlQuery | StateStatementsOrFn;
  series: { query: yom.SqlQuery; name: string }[];
  labels: yom.SqlQuery;
  header: string;
  reverseData?: string;
  axisY?: {
    labelInterpolation?: yom.SqlExpression;
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
      stroke: cssVar("palette-neutral-400"),
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
  return nodes.element("div", {
    styles: opts.styles ? [styles.root, opts.styles] : styles.root,
    children: [
      nodes.element("h3", {
        styles: styles.header,
        children: stringLiteral(opts.header),
      }),
      nodes.element("div", {
        styles: styles.card,
        children: nodes.state({
          watch: [`global_refresh_key`],
          procedure:
            typeof opts.state === "string"
              ? (s) => s.table(`result`, opts.state as string)
              : opts.state,
          statusScalar: `status`,
          children: nodes.if({
            condition: `status = 'fallback_triggered'`,
            then: circularProgress({ size: "md" }),
            else: nodes.element("div", {
              children: [
                nodes.element("div", {
                  styles: styles.legends,
                  children: opts.series.map(({ name }, i) =>
                    nodes.element("div", {
                      styles: styles.legend,
                      children: [
                        nodes.element("span", {
                          styles: styles.legendBall,
                          classes: `ct-series-${i}`,
                        }),
                        nodes.element("span", {
                          styles: styles.legendText,
                          children: stringLiteral(name),
                        }),
                      ],
                    }),
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
            }),
          }),
        }),
      }),
    ],
  });
}
