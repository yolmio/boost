import { chip } from "../../components/chip";
import { materialIcon } from "../../components/materialIcon";
import { element, ifNode, state, switchNode } from "../../nodeHelpers";
import { scalar } from "../../procHelpers";
import { createStyles } from "../../styleUtils";
import { SqlExpression, StateStatement } from "../../yom";

export const name = "threeStats";

interface StatOptions {
  title: string;
  procedure?: StateStatement[];
  value: SqlExpression;
  previous?: SqlExpression;
  trend?: SqlExpression;
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
  const value = element("p", {
    styles: styles.statValue,
    children: "value",
  });
  const valueAndPrevious = opts.previous
    ? element("div", {
        styles: { display: "flex", alignItems: "baseline" },
        children: [
          value,
          element("span", {
            styles: styles.prevValue,
            children: "'from ' || previous",
          }),
        ],
      })
    : value;
  return element("div", {
    styles: styles.stat,
    children: [
      element("p", {
        styles: styles.statTitle,
        children: opts.title,
      }),
      state({
        procedure: [
          ...(opts.procedure ?? []),
          scalar(`value`, opts.value),
          opts.previous ? scalar(`previous`, opts.previous) : null,
          opts.trend ? scalar(`trend`, opts.trend) : null,
        ],
        children: opts.trend
          ? element("div", {
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
                  startDecorator: switchNode(
                    [`trend > 0.0`, materialIcon("TrendingUp")],
                    [`trend = 0.0`, materialIcon("TrendingFlat")],
                    [`trend < 0.0`, materialIcon("TrendingDown")]
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
    return element("div", {
      styles: styles.root,
      children: [
        element("h3", {
          styles: styles.header,
          children: opts.header,
        }),
        element("div", {
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
