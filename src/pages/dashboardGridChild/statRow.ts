import { alert, skeleton, typography } from "../../components";
import { chip } from "../../components/chip";
import { materialIcon } from "../../components/materialIcon";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { StateStatementsOrFn } from "../../statements";
import { StyleObject } from "../../styleTypes";
import { createStyles, getVariantStyle } from "../../styleUtils";
import * as yom from "../../yom";

interface StatOptions {
  title: string;
  procedure?: StateStatementsOrFn;
  value: yom.SqlExpression;
  previous?: yom.SqlExpression;
  trend?: yom.SqlExpression;
}

export interface Opts {
  header?: Node;
  stats: StatOptions[];
}

const styles = createStyles({
  root: {
    gridColumnSpan: "full",
    display: "flex",
    flexDirection: "column",
    gap: 1.5,
  },
  card: (_, statCount: number) => {
    let mediaQuery: StyleObject = {};
    switch (statCount) {
      case 2:
        mediaQuery = {
          md: {
            gridTemplateColumns: `repeat(2, minmax(0, 1fr))`,
          },
        };
        break;
      case 3:
        mediaQuery = {
          lg: {
            gridTemplateColumns: `repeat(3, minmax(0, 1fr))`,
          },
        };
        break;
      case 4:
        mediaQuery = {
          md: {
            gridTemplateColumns: `repeat(2, minmax(0, 1fr))`,
          },
          xl: {
            gridTemplateColumns: `repeat(4, minmax(0, 1fr))`,
          },
        };
        break;
    }
    return {
      display: "grid",
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
      border: "1px solid",
      borderColor: "divider",
      borderRadius: "md",
      boxShadow: "sm",
      ...getVariantStyle("outlined", "neutral"),
      ...mediaQuery,
    };
  },
  stat: (_, statCount: number) => {
    let mediaQuery: StyleObject = {};
    switch (statCount) {
      case 2:
        mediaQuery = {
          "&:not(:last-child)": {
            borderBottom: "1px solid",
            borderColor: "divider",
            md: {
              borderBottom: "none",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          },
        };
        break;
      case 3:
        mediaQuery = {
          "&:not(:last-child)": {
            borderBottom: "1px solid",
            borderColor: "divider",
            lg: {
              borderBottom: "none",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          },
        };
        break;
      case 4:
        mediaQuery = {
          borderBottom: "1px solid",
          borderColor: "divider",
          xl: {
            borderRight: "1px solid",
            borderColor: "divider",
            borderBottom: "none",
          },
          "&:nth-child(odd)": {
            md: {
              borderRight: "1px solid",
              borderColor: "divider",
            },
          },
          // last two elements
          "&:nth-child(n+3)": {
            md: {
              borderBottom: "none",
            },
          },
        };
        break;
    }
    return {
      display: "flex",
      flexDirection: "column",
      p: 3,
      ...mediaQuery,
    };
  },
  statAndPreviousWrapper: {
    display: "flex",
    alignItems: "baseline",
    gap: 1,
  },
  skeletonStyles: {
    width: "75%",
    height: "100%",
  },
});

function createStat(opts: StatOptions, statCount: number) {
  const value = typography({
    level: "h4",
    color: "primary",
    children: "value",
  });
  const valueAndPrevious = opts.previous
    ? nodes.element("div", {
        styles: styles.statAndPreviousWrapper,
        children: [
          value,
          typography({
            level: "body-sm",
            children: "'from ' || previous",
          }),
        ],
      })
    : value;
  return nodes.element("div", {
    styles: styles.stat(statCount),
    children: [
      typography({
        level: "title-md",
        children: opts.title,
      }),
      nodes.state({
        procedure: (s) =>
          s
            .statements(opts.procedure)
            .scalar("value", opts.value)
            .conditionalStatements(Boolean(opts.previous), (s) =>
              s.scalar("previous", opts.previous!),
            )
            .conditionalStatements(Boolean(opts.trend), (s) =>
              s.scalar("trend", opts.trend!),
            ),
        statusScalar: `status`,
        children: nodes.switch(
          {
            condition: `status in ('requested', 'fallback_triggered')`,
            node: skeleton({
              variant: "text",
              level: "h4",
              styles: styles.skeletonStyles,
            }),
          },
          {
            condition: `status = 'failed'`,
            // not perfect, but good enough for now
            node: alert({
              variant: "soft",
              color: "danger",
              size: "sm",
              children: `'Error'`,
              startDecorator: materialIcon("Error"),
            }),
          },
          {
            condition: `true`,
            node: opts.trend
              ? nodes.element("div", {
                  styles: { display: "flex", justifyContent: "space-between" },
                  children: [
                    valueAndPrevious,
                    chip({
                      variant: "soft",
                      selected: {
                        color: "danger",
                        variant: "soft",
                        isSelected: `trend < 0`,
                      },
                      startDecorator: nodes.switch(
                        {
                          condition: `trend > 0`,
                          node: materialIcon("TrendingUp"),
                        },
                        {
                          condition: `trend = 0`,
                          node: materialIcon("TrendingFlat"),
                        },
                        {
                          condition: `trend < 0`,
                          node: materialIcon("TrendingDown"),
                        },
                      ),
                      color: "success",
                      children: `format.percent(trend)`,
                    }),
                  ],
                })
              : valueAndPrevious,
          },
        ),
      }),
    ],
  });
}

export function content(opts: Opts) {
  if (opts.stats.length > 4 || opts.stats.length < 2) {
    throw new Error("Only 2-4 stats are supported in statRow");
  }
  const card = nodes.element("div", {
    styles: styles.card(opts.stats.length),
    children: opts.stats.map((stat) => createStat(stat, opts.stats.length)),
  });
  if (opts.header) {
    return nodes.element("div", {
      styles: styles.root,
      children: [
        typography({
          children: opts.header,
          level: "h4",
        }),
        card,
      ],
    });
  }
  return card;
}
