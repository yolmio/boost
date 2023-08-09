import { chip } from "../../components/chip";
import { materialIcon } from "../../components/materialIcon";
import { nodes } from "../../nodeHelpers";
import { StateStatementsOrFn } from "../../statements";
import { createStyles } from "../../styleUtils";
import * as yom from "../../yom";

interface StatOptions {
  title: string;
  procedure?: StateStatementsOrFn;
  value: yom.SqlExpression;
  previous?: yom.SqlExpression;
  trend?: yom.SqlExpression;
}

export interface Opts {
  header?: string;
  left: StatOptions;
  middle: StatOptions;
  right: StatOptions;
}

const styles = createStyles({
  root: {
    gridColumnSpan: "full",
  },
  card: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "md",
    boxShadow: "sm",
    lg: {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  header: {
    fontWeight: "lg",
    fontSize: "lg",
    mt: 0,
    mb: 2,
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    p: 3,
    "&:not(:last-child)": {
      borderBottom: "1px solid",
      borderColor: "divider",
      lg: {
        borderBottom: "none",
        borderRight: "1px solid",
        borderColor: "divider",
      },
    },
  },
  statTitle: {
    my: 0,
    fontWeight: "md",
  },
  statValue: {
    my: 0,
    fontSize: "xl2",
    fontWeight: "lg",
    color: "primary-500",
  },
  prevValue: {
    ml: 1,
    fontSize: "sm",
  },
});

function createStat(opts: StatOptions) {
  const value = nodes.element("p", {
    styles: styles.statValue,
    children: "value",
  });
  const valueAndPrevious = opts.previous
    ? nodes.element("div", {
        styles: { display: "flex", alignItems: "baseline" },
        children: [
          value,
          nodes.element("span", {
            styles: styles.prevValue,
            children: "'from ' || previous",
          }),
        ],
      })
    : value;
  return nodes.element("div", {
    styles: styles.stat,
    children: [
      nodes.element("p", {
        styles: styles.statTitle,
        children: opts.title,
      }),
      nodes.state({
        procedure: (s) =>
          s
            .statements(opts.procedure)
            .scalar("value", opts.value)
            .conditionalStatements(Boolean(opts.previous), (s) =>
              s.scalar("previous", opts.previous!)
            )
            .conditionalStatements(Boolean(opts.trend), (s) =>
              s.scalar("trend", opts.trend!)
            ),
        children: opts.trend
          ? nodes.element("div", {
              styles: { display: "flex", justifyContent: "space-between" },
              children: [
                valueAndPrevious,
                chip({
                  variant: "soft",
                  selected: {
                    color: "danger",
                    variant: "soft",
                    isSelected: `trend < 0.0`,
                  },
                  startDecorator: nodes.switch(
                    {
                      condition: `trend > 0.0`,
                      node: materialIcon("TrendingUp"),
                    },
                    {
                      condition: `trend = 0.0`,
                      node: materialIcon("TrendingFlat"),
                    },
                    {
                      condition: `trend < 0.0`,
                      node: materialIcon("TrendingDown"),
                    }
                  ),
                  color: "success",
                  children: `format.percent(trend)`,
                }),
              ],
            })
          : valueAndPrevious,
      }),
    ],
  });
}

export function content(opts: Opts) {
  if (opts.header) {
    return nodes.element("div", {
      styles: styles.root,
      children: [
        nodes.element("h3", {
          styles: styles.header,
          children: opts.header,
        }),
        nodes.element("div", {
          styles: styles.card,
          children: [
            createStat(opts.left),
            createStat(opts.middle),
            createStat(opts.right),
          ],
        }),
      ],
    });
  }
  throw new Error("todo");
}
