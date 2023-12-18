import type { Node } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { Variant } from "../theme";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { Color, ComponentOpts, Size } from "./types";
import { createSlotsFn, SlottedComponentWithSlotNames } from "./utils";

export interface CircularProgressOpts
  extends ComponentOpts,
    SlottedComponentWithSlotNames<"svg" | "track" | "progress"> {
  determinate?: boolean;
  value?: string;

  children?: Node;
}

const styles = createStyles({
  root: (
    _,
    variant: Variant,
    propColor: Color,
    size: Size | undefined,
    hasChildren: boolean,
  ) => {
    const { color, backgroundColor, ...rest } = getVariantStyle(
      variant,
      propColor,
    ) as any;
    return {
      // integration with icon
      "--icon-font-size": "calc(0.4 * var(--_root-size))",
      // public variables
      "--circular-progress-percent": "25",
      "--circular-progress-track-color": backgroundColor,
      "--circular-progress-progress-color": color,
      "--circular-progress-linecap": "round",
      ...(size === "sm" && {
        "--circular-progress-track-thickness":
          "var(--circular-progress-thickness, 3px)",
        "--circular-progress-progress-thickness":
          "var(--circular-progress-thickness, 3px)",
        "--_root-size": "var(--circular-progress-size, 24px)", // use --_root-size to let other components overrides via --circular-progress-size
        "--circular-progress-size": "24px",
      }),
      ...((size === undefined || size === "md") && {
        "--circular-progress-track-thickness":
          "var(--circular-progress-thickness, 6px)",
        "--circular-progress-progress-thickness":
          "var(--circular-progress-thickness, 6px)",
        "--_root-size": "var(--circular-progress-size, 40px)",
      }),
      ...(size === "md" && {
        "--circular-progress-size": "40px",
      }),
      ...(size === "lg" && {
        "--circular-progress-track-thickness":
          "var(--circular-progress-thickness, 8px)",
        "--circular-progress-progress-thickness":
          "var(--circular-progress-thickness, 8px)",
        "--_root-size": "var(--circular-progress-size, 64px)",
        "--circular-progress-size": "64px",
      }),
      // internal variables
      "--_thickness-diff":
        "calc(var(--circular-progress-track-thickness) - var(--circular-progress-progress-thickness))",
      "--_inner-size":
        "calc(var(--_root-size) - 2 * var(--variant-border-width, 0px))",
      "--_outlined-inset":
        "max(var(--circular-progress-track-thickness), var(--circular-progress-progress-thickness))",
      width: "var(--_root-size)",
      height: "var(--_root-size)",
      borderRadius: "var(--_root-size)",
      margin: "var(--circular-progress-margin)",
      boxSizing: "border-box",
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0, // prevent from shrinking when CircularProgress is in a flex container.
      position: "relative",
      color,
      ...(hasChildren && {
        // only add font related properties when there is a child.
        // so that when there is no child, the size can be controlled by the parent font-size e.g. Link
        fontFamily: cssVar(`font-family-body`),
        fontWeight: cssVar(`font-weight-md`),
        fontSize: "calc(0.2 * var(--_root-size))",
      }),
      ...rest,
      ...(variant === "outlined" && {
        "&:before": {
          content: '""',
          display: "block",
          position: "absolute",
          borderRadius: "inherit",
          top: "var(--_outlined-inset)",
          left: "var(--_outlined-inset)",
          right: "var(--_outlined-inset)",
          bottom: "var(--_outlined-inset)",
          ...rest,
        },
      }),
    };
  },
  svg: {
    width: "inherit",
    height: "inherit",
    display: "inherit",
    boxSizing: "inherit",
    position: "absolute",
    top: "calc(-1 * var(--variant-border-width, 0px))", // centered align
    left: "calc(-1 * var(--variant-border-width, 0px))", // centered align
  },
  track: {
    cx: "50%",
    cy: "50%",
    r: "calc(var(--_inner-size) / 2 - var(--circular-progress-track-thickness) / 2 + min(0px, var(--_thickness-diff) / 2))",
    fill: "transparent",
    strokeWidth: "var(--circular-progress-track-thickness)",
    stroke: "var(--circular-progress-track-color)",
  },
  progress: (app, determinate: boolean) => {
    const styles: StyleObject = {
      "--_progress-radius":
        "calc(var(--_inner-size) / 2 - var(--circular-progress-progress-thickness) / 2 - max(0px, var(--_thickness-diff) / 2))",
      "--_progress-length": "calc(2 * 3.1415926535 * var(--_progress-radius))", // the circumference around the progress
      cx: "50%",
      cy: "50%",
      r: "var(--_progress-radius)",
      fill: "transparent",
      strokeWidth: "var(--circular-progress-progress-thickness)",
      stroke: "var(--circular-progress-progress-color)",
      strokeLinecap: "var(--circular-progress-linecap, round)" as "round", // can't use CSS variable directly, need to cast type.
      strokeDasharray: "var(--_progress-length)",
      strokeDashoffset:
        "calc(var(--_progress-length) - var(--circular-progress-percent) * var(--_progress-length) / 100)",
      transformOrigin: "center",
      transform: "rotate(-90deg)", // to initially appear at the top-center of the circle.
    };
    if (determinate) {
      styles.transition =
        "stroke-dashoffset 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms";
    } else {
      const circulate = app.registerKeyframes({
        "0%": {
          // let the progress start at the top of the ring
          transform: "rotate(-90deg)",
        },
        "100%": {
          transform: "rotate(270deg)",
        },
      });
      styles.animation = `var(
        --circular-progress-circulation,
        0.8s linear 0s infinite normal none running
    ) ${circulate}`;
    }
    return styles;
  },
});

export function circularProgress(opts: CircularProgressOpts = {}) {
  const slot = createSlotsFn(opts);
  return slot("root", {
    tag: "span",
    props: {
      role: "'progressbar'",
      "aria-valuenow": opts.value ? `round(${opts.value})` : undefined,
    },
    style:
      opts.determinate && opts.value
        ? { "--circular-progress-percent": opts.value }
        : undefined,
    styles: styles.root(
      opts.variant ?? "soft",
      opts.color ?? "primary",
      opts.size,
      Boolean(opts.children),
    ),
    children: [
      slot("svg", {
        tag: "svg",
        styles: styles.svg,
        children: [
          slot("track", {
            tag: "circle",
            styles: styles.track,
          }),
          slot("progress", {
            tag: "circle",
            styles: styles.progress(opts.determinate ?? false),
          }),
        ],
      }),
      opts.children,
    ],
  });
}
