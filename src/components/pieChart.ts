import { PieChartNode } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { cssVar, getVariantStyle } from "../styleUtils";
import { ColorPaletteProp, Variant } from "../theme";

type Color = ColorPaletteProp;
type Size = "sm" | "md" | "lg";

export interface PieChartOpts {
  color?: Color;
  variant?: Variant;
  size?: Size;
  series: string;
  labels?: string;
}

export function pieChart(opts: PieChartOpts): PieChartNode {
  const variant = opts.variant ?? "plain";
  const color = opts.color ?? "neutral";
  const colorStyles = getVariantStyle(variant, color);
  const padding = opts.size === "sm" ? "8" : opts.size === "lg" ? "16" : "12";
  return {
    t: "PieChart",
    labels: opts.labels,
    series: opts.series,
    styles: {
      root: {
        backgroundColor: (colorStyles as any).backgroundColor,
        color: (colorStyles as any).color,
        p: padding + "px",
        height: "100%",
        width: "100%",
      },
      label: {
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
      },
      slicePie: {
        ".ct-series-a &": {
          fill: cssVar(`palette-primary-200`),
        },
        ".ct-series-b &": {
          fill: cssVar(`palette-neutral-200`),
        },
        ".ct-series-c &": {
          fill: cssVar(`palette-success-200`),
        },
        ".ct-series-d &": {
          fill: cssVar(`palette-danger-200`),
        },
        ".ct-series-e &": {
          fill: cssVar(`palette-warning-200`),
        },
      },
      sliceDonut: {
        fill: "none",
        ".ct-series-a &": {
          stroke: cssVar(`palette-primary-200`),
        },
        ".ct-series-b &": {
          stroke: cssVar(`palette-neutral-200`),
        },
        ".ct-series-c &": {
          stroke: cssVar(`palette-success-200`),
        },
        ".ct-series-d &": {
          stroke: cssVar(`palette-danger-200`),
        },
        ".ct-series-e &": {
          stroke: cssVar(`palette-warning-200`),
        },
      },
    },
    donut: `true`,
    donutWidth: `60`,
    // chartPadding: {
    //   top: "16",
    //   right: "16",
    //   left: "12",
    //   bottom: "4",
    // },
  };
}
