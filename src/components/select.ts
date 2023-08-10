import { lazy, memoize } from "../utils/memoize";
import * as yom from "../yom";
import { nodes } from "../nodeHelpers";
import type { Node } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { Variant } from "../theme";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { svgIcon } from "./svgIcon";
import { createSlotsFn, SlottedComponentWithSlotNames } from "./utils";
import { Color, ComponentOpts, Size } from "./types";

export interface SelectOpts
  extends ComponentOpts,
    SlottedComponentWithSlotNames<
      "startDecorator" | "endDecorator" | "select" | "icon"
    > {
  fullWidth?: boolean;

  children: Node;

  error?: string;

  startDecorator?: Node;
  endDecorator?: Node;
}

const styles = createStyles({
  root: (variant: Variant, color: Color, size: Size, fullWidth: boolean) => {
    const styles: StyleObject = {
      "--select-radius": cssVar(`radius-sm`),
      "--select-gap": "0.5rem",
      "--select-placeholder-opacity": 0.5,
      "--select-focused-thickness": cssVar(`focus-thickness`),
      // variables for controlling child components
      "--select-decorator-child-offset":
        "min(calc(var(--select-padding-x) - (var(--select-min-height) - 2 * var(--variant-border-width) - var(--select-decorator-child-height)) / 2), var(--select-padding-x))",
      "--select-padding-y":
        "max((var(--select-min-height) - 2 * var(--variant-border-width) - var(--select-decorator-child-height)) / 2, 0px)",
      "--select-decorator-child-radius":
        "max(var(--select-radius) - var(--select-padding-y), min(var(--select-padding-y) / 2, var(--select-radius) / 2))",
      "--button-min-height": "var(--select-decorator-child-height)",
      "--icon-button-size": "var(--select-decorator-child-height)",
      "--button-radius": "var(--select-decorator-child-radius)",
      "--icon-button-radius": "var(--select-decorator-child-radius)",
      boxSizing: "border-box",
      minWidth: 0,
      minHeight: "var(--select-min-height)",
      position: "relative",
      display: "flex",
      alignItems: "center",
      borderRadius: "var(--select-radius)",
      fontFamily: cssVar(`font-family-body`),
      fontSize: cssVar(`font-size-md`),
      // TODO: discuss the transition approach in a separate PR.
      transition:
        "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
      "&:before": {
        boxSizing: "border-box",
        content: '""',
        display: "block",
        position: "absolute",
        pointerEvents: "none",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
        borderRadius: "inherit",
        margin: "calc(var(--variant-border-width) * -1)", // for outlined variant
      },
      [`&:focus-within`]: {
        "--select-indicator-color": "var(--select-focused-highlight)",
      },
    };
    if (variant !== "solid") {
      styles["&:focus-within"] = {
        "&:before": {
          boxShadow: `inset 0 0 0 var(--select-focused-thickness) var(--select-focused-highlight)`,
        },
      };
    }
    if (fullWidth) {
      styles.width = "100%";
    }
    if (color === "harmonize") {
      styles["--select-focused-highlight"] = cssVar(`palette-focus-visible`);
    } else {
      const paletteColor = color === "neutral" ? "primary" : color;
      styles["--select-focused-highlight"] = cssVar(
        `palette-${paletteColor}-500`
      );
    }
    switch (size) {
      case "sm":
        styles["--select-min-height"] = "2rem";
        styles["--select-padding-x"] = "0.5rem";
        styles["--select-decorator-child-height"] =
          "min(1.5rem, var(--select-min-height))";
        styles["--icon-font-size"] = "1.25rem";
        styles["--select-padding-y"] = "2px";
        styles.fontSize = cssVar(`font-size-sm`);
        break;
      case "md":
        styles["--select-min-height"] = "2.5rem";
        styles["--select-padding-x"] = "0.75rem";
        styles["--select-decorator-child-height"] =
          "min(2rem, var(--select-min-height))";
        styles["--icon-font-size"] = "1.5rem";
        styles["--select-padding-y"] = "3px";
        break;
      case "lg":
        styles["--select-min-height"] = "3rem";
        styles["--select-padding-x"] = "1rem";
        styles["--select-decorator-child-height"] =
          "min(2.375rem, var(--select-min-height))";
        styles["--icon-font-size"] = "1.75rem";
        styles["--select-padding-y"] = "4px";
        break;
    }
    Object.assign(styles, getVariantStyle(variant, color));
    if (variant === "outlined" || variant === "plain") {
      styles["--select-indicator-color"] = cssVar("palette-text-tertiary");
      styles.backgroundColor = cssVar(`palette-background-surface`);
    } else {
      styles["--select-indicator-color"] = styles.color;
    }
    styles["&:hover"] = getVariantStyle(variant, color, "hover");
    styles["&.error"] = {
      ...getVariantStyle(variant, "danger"),
      "--select-focused-highlight": cssVar(`palette-danger-500`),
      "&:hover": getVariantStyle(variant, "danger", "hover"),
    };
    return styles;
  },
  select: (size: Size) => ({
    // reset user-agent button style
    border: 0,
    outline: "none",
    background: "none",
    fontSize: "inherit",
    color: "inherit",
    alignSelf: "stretch",
    paddingLeft: `var(--select-padding-x)`,
    paddingRight: `calc(var(--select-padding-x) + ${
      size === "sm" ? "1.125rem" : size === "md" ? "1.25rem" : "1.5rem"
    })`,
    paddingY: `var(--select-padding-y)`,
    // make children horizontally aligned
    display: "flex",
    alignItems: "center",
    flex: 1,
    fontFamily: "inherit",
    cursor: "pointer",
    appearance: "none",
  }),
  iconSpan: (size: Size) => ({
    "--icon-font-size":
      size === "sm" ? "1.125rem" : size === "md" ? "1.25rem" : "1.5rem",
    color: "var(--select-indicator-color)",
    position: "absolute",
    userSelect: "none",
    pointerEvents: "none",
    right: "calc(var(--select-padding-x) - var(--select-padding-x)/2)",
    display: "flex",
    alignItems: "center",
    height: "100%",
    //   [`.${selectClasses.endDecorator} + &`]: {
    //     marginInlineStart: 'calc(var(--Select-gap) / 2)',
    //   },
  }),
  startDecorator: (color: Color, variant: Variant) => ({
    "--button-margin": "0 0 0 calc(var(--input-decorator-child-offset) * -1)",
    "--icon-button-margin":
      "0 0 0 calc(var(--input-decorator-child-offset) * -1)",
    "--icon-margin": "0 0 0 calc(var(--input-padding-x) / -4)",
    display: "inherit",
    alignItems: "center",
    paddingY: "var(--input-padding-y)", // for wrapping Autocomplete's tags
    flexWrap: "wrap", // for wrapping Autocomplete's tags
    marginRight: "var(--input-gap)",
    color: cssVar(`palette-text-tertiary`),
    cursor: "initial",
    "div:focus-within > &": {
      color:
        color === "harmonize"
          ? `var(--harmonize-${variant}-color)`
          : cssVar(`palette-${color}-${variant}-color`),
    },
  }),
  endDecorator: (color: Color, variant: Variant) => ({
    "--button-margin": "0 calc(var(--input-decorator-child-offset) * -1) 0 0",
    "--icon-button-margin":
      "0 calc(var(--input-decorator-child-offset) * -1) 0 0",
    "--icon-margin": "0 calc(var(--input-padding-x) / -4) 0 0",
    display: "inherit",
    alignItems: "center",
    marginLeft: "var(--input-gap)",
    color:
      color === "harmonize"
        ? `var(--harmonize-${variant}-color)`
        : cssVar(`palette-${color}-${variant}-color`),
    cursor: "initial",
  }),
});

export const selectIcon = lazy(() =>
  svgIcon({
    children: nodes.element("path", {
      props: {
        d: "'m12 5.83 2.46 2.46c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L12.7 3.7a.9959.9959 0 0 0-1.41 0L8.12 6.88c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0L12 5.83zm0 12.34-2.46-2.46a.9959.9959 0 0 0-1.41 0c-.39.39-.39 1.02 0 1.41l3.17 3.18c.39.39 1.02.39 1.41 0l3.17-3.17c.39-.39.39-1.02 0-1.41a.9959.9959 0 0 0-1.41 0L12 18.17z'",
      },
    }),
  })
);

export const getIconSpan = memoize((size: Size) => {
  return nodes.element("span", {
    styles: styles.iconSpan(size),
    children: selectIcon(),
  });
});

export function select(opts: SelectOpts) {
  const slot = createSlotsFn(opts);
  const size = opts.size ?? "md";
  const variant = opts.variant ?? "outlined";
  const color = opts.color ?? "neutral";
  const rootStyles = styles.root(variant, color, size, opts.fullWidth ?? false);
  const dynamicClasses: yom.DynamicClass[] = [];
  if (opts.error) {
    dynamicClasses.push({ classes: "error", condition: opts.error });
  }
  const children = [
    slot("select", {
      tag: "select",
      styles: styles.select(size),
      children: opts.children,
    }),
    getIconSpan(size),
  ];
  if (opts.startDecorator) {
    children.unshift(
      slot("startDecorator", {
        tag: "span",
        styles: styles.startDecorator(color, variant),
        children: opts.startDecorator,
      })
    );
  }
  if (opts.endDecorator) {
    children.push(
      slot("endDecorator", {
        tag: "span",
        styles: styles.endDecorator(color, variant),
        children: opts.endDecorator,
      })
    );
  }
  return slot("root", {
    tag: "div",
    styles: rootStyles,
    dynamicClasses,
    children,
  });
}
