import type { Node } from "../nodeTypes.js";
import { Style, StyleObject } from "../styleTypes.js";
import { Variant } from "../theme.js";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils.js";
import { createSlotsFn, SlottedComponentWithSlotNames } from "./utils.js";
import { Color, ComponentOpts, Size } from "./types.js";
import { DynamicClass } from "../yom.js";

export interface InputOpts
  extends ComponentOpts,
    SlottedComponentWithSlotNames<"input" | "startDecorator" | "endDecorator"> {
  fullWidth?: boolean;

  error?: string;

  startDecorator?: Node;
  endDecorator?: Node;
}

export const styles = createStyles({
  root: (size: Size, variant: Variant, color: Color, fullWidth: boolean) => {
    const styles: StyleObject = {
      "--input-radius": cssVar(`radius-sm`),
      "--input-gap": "0.5rem",
      "--input-placeholder-color": "inherit",
      "--input-placeholder-opacity": 0.5,
      "--input-focused-thickness": cssVar(`focus-thickness`),
      // variables for controlling child components
      "--input-decorator-child-offset":
        "min(calc(var(--input-padding-x) - (var(--input-min-height) - 2 * var(--variant-border-width) - var(--input-decorator-child-height)) / 2), var(--input-padding-x))",
      "--input-padding-y":
        "max((var(--input-min-height) - 2 * var(--variant-border-width) - var(--input-decorator-child-height)) / 2, 0px)",
      "--input-decorator-child-radius":
        "max(var(--input-radius) - var(--input-padding-y), min(var(--input-padding-y) / 2, var(--input-radius) / 2))",
      "--button-min-height": "var(--input-decorator-child-height)",
      "--icon-button-size": "var(--input-decorator-child-height)",
      "--button-radius": "var(--input-decorator-child-radius)",
      "--icon-button-radius": "var(--input-decorator-child-radius)",
      boxSizing: "border-box",
      minWidth: 0,
      minHeight: "var(--input-min-height)",
      cursor: "text",
      position: "relative",
      display: "flex",
      alignItems: "center",
      paddingX: `var(--input-padding-x)`,
      borderRadius: "var(--input-radius)",
      fontFamily: cssVar(`font-family-body`),
      fontSize: cssVar(`font-size-md`),
      // TODO: discuss the transition approach in a separate PR. This value is copied from mui-material Button.
      transition:
        "border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
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
    };
    if (fullWidth) {
      styles.width = "100%";
    }
    if (color === "harmonize") {
      styles["--input-focused-highlight"] = cssVar(`palette-focus-visible`);
    } else {
      const paletteColor = color === "neutral" ? "primary" : color;
      styles["--input-focused-highlight"] = cssVar(
        `palette-${paletteColor}-500`
      );
    }
    switch (size) {
      case "sm":
        styles["--input-min-height"] = "2rem";
        styles["--input-padding-x"] = "0.5rem";
        styles["--input-decorator-child-height"] =
          "min(1.5rem, var(--input-min-height))";
        styles["--icon-font-size"] = "1.25rem";
        break;
      case "md":
        styles["--input-min-height"] = "2.5rem";
        styles["--input-padding-x"] = "0.75rem";
        styles["--input-decorator-child-height"] =
          "min(2rem, var(--input-min-height))";
        styles["--icon-font-size"] = "1.5rem";
        break;
      case "lg":
        styles["--input-min-height"] = "3rem";
        styles["--input-padding-x"] = "1rem";
        styles["--input-gap"] = "0.75rem";
        styles["--input-decorator-child-height"] =
          "min(2.375rem, var(--input-min-height))";
        styles["--icon-font-size"] = "1.75rem";
        break;
    }
    Object.assign(styles, getVariantStyle(variant, color));
    if (variant === "outlined" || variant === "plain") {
      styles.backgroundColor = cssVar(`palette-background-surface`);
    }
    styles["&:hover:not(:focus-within)"] = {
      ...getVariantStyle(variant, color, "hover"),
      backgroundColor: null, // it is not common to change background on hover for Input
      cursor: "text",
    };
    styles["&:focus-within"] = {
      "&:before": {
        boxShadow: `inset 0 0 0 var(--input-focused-thickness) var(--input-focused-highlight)`,
      },
    };
    const getErrorStyles = (variant: Variant) => {
      const styles = getVariantStyle(variant, "danger") as any;
      const hoverStyles: any = {
        ...getVariantStyle(variant, "danger", "hover"),
        backgroundColor: null,
      };
      delete styles.color;
      delete hoverStyles.color;
      return {
        ...styles,
        "--input-focused-highlight": cssVar(`palette-danger-500`),
        "&:hover:not(:focus-within)": hoverStyles,
      };
    };
    styles["&.error"] = getErrorStyles(variant);
    return styles;
  },
  input: {
    border: "none", // remove the native input width
    minWidth: 0, // remove the native input width
    outline: 0, // remove the native input outline
    padding: 0, // remove the native input padding
    flex: 1,
    alignSelf: "stretch",
    color: "inherit",
    backgroundColor: "transparent",
    fontFamily: "inherit",
    fontSize: "inherit",
    fontStyle: "inherit",
    fontWeight: "inherit",
    lineHeight: "inherit",
    textOverflow: "ellipsis",
    "&:-webkit-autofill": {
      WebkitBackgroundClip: "text", // remove autofill background
      WebkitTextFillColor: "currentColor",
    },
    "&::-webkit-input-placeholder": {
      color: "var(--input-placeholder-color)",
      opacity: "var(--input-placeholder-opacity)",
    },
    "&::-moz-placeholder": {
      // Firefox 19+
      color: "var(--input-placeholder-color)",
      opacity: "var(--input-placeholder-opacity)",
    },
    "&::-ms-input-placeholder": {
      // Edge
      color: "var(--input-placeholder-color)",
      opacity: "var(--input-placeholder-opacity)",
    },
  },
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
    marginStart: "var(--input-gap)",
    color:
      color === "harmonize"
        ? `var(--harmonize-${variant}-color)`
        : cssVar(`palette-${color}-${variant}-color`),
    cursor: "initial",
  }),
});

export function input(opts: InputOpts) {
  const slot = createSlotsFn(opts);
  const size = opts.size ?? "md";
  const variant = opts.variant ?? "outlined";
  const color = opts.color ?? "neutral";
  const dynamicClasses: DynamicClass[] = [];
  if (opts.error) {
    dynamicClasses.push({ classes: "error", condition: opts.error });
  }
  const children = [
    slot("input", {
      tag: "input",
      styles: styles.input,
    }),
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
    styles: styles.root(size, variant, color, opts.fullWidth ?? false),
    dynamicClasses,
    children,
    props: { "aria-invalid": opts.error },
  });
}
