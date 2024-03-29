import { circularProgress } from "../../components/circularProgress";
import { nodes } from "../../nodeHelpers";
import { PieChartNode } from "../../nodeTypes";
import { Style } from "../../styleTypes";
import { createStyles, cssVar, getVariantStyle } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { StateStatementsOrFn } from "../../statements";
import * as yom from "../../yom";
import { alert, materialIcon, skeleton, typography } from "../../components";

export interface Opts {
  styles?: Style;
  cardStyles?: Style;
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
    gap: 1.5,
    lg: { gridColumnSpan: 6 },
  },
  card: () => ({
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "md",
    boxShadow: "sm",
    height: "100%",
    ...getVariantStyle("outlined", "neutral"),
  }),
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
      stroke: cssVar("palette-neutral-400"),
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
      stroke: cssVar("palette-neutral-300"),
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
      stroke: cssVar("palette-neutral-200"),
    },
    ".ct-series-k &": {
      stroke: cssVar("palette-danger-200"),
    },
    ".ct-series-l &": {
      stroke: cssVar("palette-success-200"),
    },
  },
  slicePie: {
    stroke: "transparent",
    ".ct-series-a &": {
      fill: cssVar("palette-primary-400"),
    },
    ".ct-series-b &": {
      fill: cssVar("palette-neutral-400"),
    },
    ".ct-series-c &": {
      fill: cssVar("palette-danger-400"),
    },
    ".ct-series-d &": {
      fill: cssVar("palette-success-400"),
    },
    ".ct-series-e &": {
      fill: cssVar("palette-primary-300"),
    },
    ".ct-series-f &": {
      fill: cssVar("palette-neutral-300"),
    },
    ".ct-series-g &": {
      fill: cssVar("palette-danger-300"),
    },
    ".ct-series-h &": {
      fill: cssVar("palette-success-300"),
    },
    ".ct-series-i &": {
      fill: cssVar("palette-primary-200"),
    },
    ".ct-series-j &": {
      fill: cssVar("palette-neutral-200"),
    },
    ".ct-series-k &": {
      fill: cssVar("palette-danger-200"),
    },
    ".ct-series-l &": {
      fill: cssVar("palette-success-200"),
    },
  },
  alert: {
    m: 2,
  },
  skeletonWrapperWrapper: {
    height: "100%",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonWrapper: {
    height: "80%",
    aspectRatio: "1/1",
  },
});

export function content(opts: Opts) {
  return nodes.element("div", {
    styles: opts.styles ? [styles.root, opts.styles] : styles.root,
    children: [
      typography({
        level: "h4",
        children: stringLiteral(opts.header),
      }),
      nodes.element("div", {
        styles: opts.cardStyles
          ? [styles.card(), opts.cardStyles]
          : styles.card(),
        children: nodes.state({
          watch: [`global_refresh_key`],
          procedure:
            typeof opts.state === "string"
              ? (s) => s.table(`result`, opts.state as string)
              : opts.state,
          statusScalar: `status`,
          children: nodes.switch(
            {
              condition: `status in ('requested', 'fallback_triggered')`,
              node: nodes.element("div", {
                styles: styles.skeletonWrapperWrapper,
                children: nodes.element("div", {
                  styles: styles.skeletonWrapper,
                  children: skeleton({
                    variant: "circular",
                    level: "h4",
                  }),
                }),
              }),
            },
            {
              condition: `status = 'failed'`,
              // not perfect, but good enough for now
              node: alert({
                variant: "soft",
                color: "danger",
                children: `'Error'`,
                size: "lg",
                styles: styles.alert,
                startDecorator: materialIcon("Error"),
              }),
            },
            {
              condition: `true`,
              node: nodes.pieChart({
                styles: {
                  root: styles.chartRoot,
                  sliceDonut: styles.slice,
                  label: styles.label,
                  slicePie: styles.slicePie,
                },
                donutWidth: "30",
                labelDirection: "'explode'",
                labelOffset: "32",
                chartPadding: "56",
                ...opts.pieChartOpts,
              }),
            },
          ),
        }),
      }),
    ],
  });
}
