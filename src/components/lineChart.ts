import { LineChartNode } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { cssVar, getVariantStyle } from "../styleUtils";
import { ColorPaletteProp, Variant } from "../theme";

type Color = ColorPaletteProp;
type Size = "sm" | "md" | "lg";

export interface LineChartOpts {
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

export function lineChart(opts: LineChartOpts): LineChartNode {
  const variant = opts.variant ?? "plain";
  const color = opts.color ?? "neutral";
  const colorStyles = getVariantStyle(variant, color);
  const lineStyles: StyleObject = {
    strokeWidth: 2,
    fill: "none",
  };
  opts.series.forEach((s, i) => {
    (lineStyles as any)[".series-" + i + ">&"] = {
      stroke: cssVar(`palette-${s.color}-400`),
    };
  });
  const padding = opts.size === "sm" ? "8" : opts.size === "lg" ? "16" : "12";
  return {
    t: "LineChart",
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
      line: lineStyles,
      downLine: {
        stroke: cssVar(`palette-danger-400`),
        strokeWidth: 2,
        fill: "none",
      },
      upLine: {
        stroke: cssVar("palette-common-black"),
        strokeWidth: 2,
        fill: "none",
        dark: {
          stroke: cssVar(`palette-common-white`),
        },
      },
      equalLine: {
        stroke: cssVar("palette-common-black"),
        strokeWidth: 2,
        fill: "none",
        dark: {
          stroke: cssVar(`palette-common-white`),
        },
      },
      point: {
        strokeWidth: 8,
        strokeLinecap: "round",
        stroke: "currentcolor",
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
      pointLabel: {
        fontSize: ".75rem",
        userSelect: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        height: "36px",
        dark: {
          color: cssVar(`palette-common-white`),
        },
      },
    },
    chartPadding: {
      top: "16",
      right: "16",
      left: "12",
      bottom: "4",
    },
    lineSmooth: { kind: "'noneDistinct'" },
    axisX: {
      type: "'fixed'",
      divisor: "7",
      labelInterpolation: `format.date(date.from_epoch(try_cast(label as bigint) / 1000), '%e %b')`,
    },
    showPointLabel: `true`,
  };
}
