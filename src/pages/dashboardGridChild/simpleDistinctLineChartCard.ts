import { card, cardOverflow } from "../../components/card.js";
import { circularProgress } from "../../components/circularProgress.js";
import { simpleDistinctLineChart } from "../../components/simpleDistinctLineChart.js";
import { typography } from "../../components/typography.js";
import { element, ifNode, state } from "../../nodeHelpers.js";
import { table } from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";

export const name = "simpleDistinctLineChartCard";

export interface Opts {
  header: string;
  stateQuery: string;
  lineChartQuery: string;
  lineChartLabels?: string;
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

export function content(opts: Opts) {
  return card({
    variant: "outlined",
    children: state({
      procedure: [table(`result`, opts.stateQuery)],
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
              query: opts.lineChartQuery,
              labels: opts.lineChartLabels,
            }),
          })
        ),
      ],
    }),
  });
}
