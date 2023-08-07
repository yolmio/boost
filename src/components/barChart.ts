import { BarChartNode, LineChartNode } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { cssVar, getVariantStyle } from "../styleUtils";
import { ColorPaletteProp, Variant } from "../theme";

type Color = ColorPaletteProp;
type Size = "sm" | "md" | "lg";

export interface BarChartOpts {
  color?: Color;
  variant?: Variant;
  size?: Size;
  series: Series[];
  labels?: string;
}

export interface Series {
  color: ColorPaletteProp;
  query: string;
}

export function barChart(opts: BarChartOpts): BarChartNode {
  const variant = opts.variant ?? "plain";
  const color = opts.color ?? "neutral";
  const colorStyles = getVariantStyle(variant, color);
  const barStyles: StyleObject = {
    strokeWidth: 10,
    fill: "none",
  };
  opts.series.forEach((s, i) => {
    (barStyles as any)[".series-" + i + ">&"] = {
      stroke: cssVar(`palette-${s.color}-400`),
    };
  });
  const padding = opts.size === "sm" ? "8" : opts.size === "lg" ? "16" : "12";
  return {
    t: "BarChart",
    labels: opts.labels,
    series: opts.series.map((s, i) => ({
      query: s.query,
      className: "series-" + i,
    })),
    styles: {
      root: {
        backgroundColor: (colorStyles as any).backgroundColor,
        color: (colorStyles as any).color,
        p: padding + "px",
        height: "100%",
        width: "100%",
      },
      grid: {
        stroke: cssVar(`palette-${color}-200`),
        strokeWidth: 1,
        strokeDasharray: "2px",
      },
      bar: barStyles,
      label: {
        fontSize: ".75rem",
        lineHeight: 1,
        display: "flex",
        userSelect: "none",
        "&.ct-horizontal": {
          justifyContent: "center",
          alignItems: "flex-start",
        },
        "&.ct-vertical": {
          justifyContent: "flex-end",
          alignItems: "flex-end",
        },
      },
    },
    chartPadding: {
      top: "16",
      right: "16",
      left: "12",
      bottom: "4",
    },
  };
}
