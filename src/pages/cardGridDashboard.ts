import { card, cardOverflow } from "../components/card.js";
import { circularProgress } from "../components/circularProgress.js";
import { simpleDistinctLineChart } from "../components/simpleDistinctLineChart.js";
import { Color } from "../components/types.js";
import { typography } from "../components/typography.js";
import { addPage } from "../modelHelpers.js";
import { element, ifNode, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { table } from "../procHelpers.js";
import { createStyles } from "../styleUtils.js";
import {
  containerStyles,
  getGridItemStyles,
  getGridStyles,
  GridDescription,
  GridItemDescription,
} from "../styleUtils.js";
import { Variant } from "../theme.js";
import { deepmerge } from "../utils/deepmerge.js";

export interface SimpleDistinctLineChartCardOpts {
  header: string;
  lineChart: {
    stateQuery: string;
    lineChartQuery: string;
    lineChartLabels?: string;
  };
}

const styles = createStyles({
  header: {
    ml: 1.5,
    my: 1,
  },
  loadingWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 156,
  },
});

export function simpleDistinctLineChartCard(
  opts: SimpleDistinctLineChartCardOpts
) {
  return state({
    procedure: [table(`Result`, opts.lineChart.stateQuery)],
    statusScalar: `status`,
    children: [
      typography({
        level: "h5",
        styles: styles.header,
        children: opts.header,
      }),
      ifNode(
        `status = 'fallback_triggered'`,
        element("div", {
          styles: styles.loadingWrapper,
          children: circularProgress({ size: "md" }),
        }),
        cardOverflow({
          children: simpleDistinctLineChart({
            query: opts.lineChart.lineChartQuery,
            labels: opts.lineChart.lineChartLabels,
          }),
        })
      ),
    ],
  });
}

export interface Card extends GridItemDescription {
  variant?: Variant;
  color?: Color;
  node: Node;
}

export interface CardGridDashboardPageOpts extends GridDescription {
  path?: string;
  cards: Card[];
}

export function cardGridDashboardPage(opts: CardGridDashboardPageOpts) {
  const content = element("div", {
    styles: [
      { py: 2 },
      containerStyles(),
      getGridStyles(
        deepmerge(
          {
            gridGap: 2,
            md: {
              gridGap: 4,
            },
          },
          opts
        )
      ),
    ],
    children: opts.cards.map((c) =>
      card({
        variant: c.variant ?? "outlined",
        color: c.color ?? "neutral",
        styles: getGridItemStyles(c),
        children: c.node,
      })
    ),
  });
  addPage({
    path: opts.path ?? "/",
    content,
  });
}
