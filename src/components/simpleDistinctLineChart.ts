import { LineChartNode } from "../nodeTypes.js";
import { StyleObject } from "../styleTypes.js";
import { cssVar, getVariantStyle } from "../styleUtils.js";
import { ColorPaletteProp } from "../theme.js";
import { memoize } from "../utils/memoize.js";
import { Size } from "./types.js";

export interface SimpleDistinctLineChartOpts {
  size?: Size;
  query: string;
  labels?: string;
}

const lineStyles: StyleObject = {
  strokeWidth: 2,
  fill: "none",
};

const rootStyles = memoize((size: Size) => ({
  color: cssVar(`palette-neutral-plain-color`),
  p: size === "sm" ? "8px" : size === "lg" ? "16px" : "12px",
  height: "100%",
  width: "100%",
}));

const gridStyles: StyleObject = {
  stroke: cssVar(`palette-neutral-200`),
  strokeWidth: 1,
  strokeDasharray: "2px",
};

const downLineStyles: StyleObject = {
  stroke: cssVar(`palette-danger-400`),
  strokeWidth: 2,
  fill: "none",
};

const upLineStyles: StyleObject = {
  stroke: cssVar("palette-common-black"),
  strokeWidth: 2,
  fill: "none",
  dark: {
    stroke: cssVar(`palette-common-white`),
  },
};

const equalLineStyles: StyleObject = {
  stroke: cssVar("palette-common-black"),
  strokeWidth: 2,
  fill: "none",
  dark: {
    stroke: cssVar(`palette-common-white`),
  },
};

const pointStyles: StyleObject = {
  strokeWidth: 8,
  strokeLinecap: "round",
  stroke: "currentcolor",
};

const labelStyles: StyleObject = {
  fontSize: ".75rem",
  lineHeight: 1,
  display: "flex",
  userSelect: "none",
  "&.ct-horizontal": {
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  "&.ct-vertical": {
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
};

const pointLabelStyles: StyleObject = {
  fontSize: ".75rem",
  userSelect: "none",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  height: "36px",
  dark: {
    color: cssVar(`palette-common-white`),
  },
};

export function simpleDistinctLineChart(
  opts: SimpleDistinctLineChartOpts
): LineChartNode {
  const size = opts.size ?? "md";
  return {
    t: "LineChart",
    labels: opts.labels,
    series: [{ query: opts.query }],
    styles: {
      root: rootStyles(size),
      grid: gridStyles,
      line: lineStyles,
      downLine: downLineStyles,
      upLine: upLineStyles,
      equalLine: equalLineStyles,
      point: pointStyles,
      label: labelStyles,
      pointLabel: pointLabelStyles,
    },
    chartPadding: {
      top: "16",
      right: "0",
      left: "4",
      bottom: "0",
    },
    lineSmooth: { kind: "'noneDistinct'" },
    showPointLabel: `true`,
  };
}
