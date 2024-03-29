import { App, system } from "../system";
import { nodes } from "../nodeHelpers";
import type { Node } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { Variant } from "../theme";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import {
  createSlotsFn,
  getComponentOverwrite,
  SlottedComponentWithSlotNames,
} from "./utils";
import { Color, ComponentOpts, Size } from "./types";
import { circularProgress } from "./circularProgress";
import * as yom from "../yom";
import { memoize } from "../utils/memoize";

export interface ButtonOpts
  extends SlottedComponentWithSlotNames<
      "startDecorator" | "endDecorator" | "loadingIndicatorCenter"
    >,
    ComponentOpts {
  fullWidth?: boolean;
  loadingPosition?: "start" | "center" | "end";

  /** expression for if the button is disabled */
  disabled?: yom.SqlExpression;
  /** expression for if the button shouhld be put into a loading state */
  loading?: yom.SqlExpression;
  /** expression for href, will make button into anchor tag and add this prop */
  href?: yom.SqlExpression;

  startDecorator?: Node;
  endDecorator?: Node;
  children: Node;
}

export const buttonSizeStyles = memoize((size: Size) => {
  switch (size) {
    case "sm":
      return {
        "--circular-progress-size": "20px",
        "--circular-progress-thickness": "2px",
        "--icon-font-size": "1.25rem",
        "--button-gap": "0.375rem",
        minHeight: "var(--button-minHeight, 2rem)",
        fontSize: cssVar("font-size-sm"),
        paddingY: "2px",
        paddingX: "0.75rem",
      };
    case "md":
      return {
        "--circular-progress-size": "24px",
        "--circular-progress-thickness": "3px",
        "--icon-font-size": "1.5rem", // control the SvgIcon font-size
        "--button-gap": "0.5rem",
        minHeight: "var(--button-minHeight, 2.5rem)", // use min-height instead of height to make the button resilient to its content
        fontSize: cssVar("font-size-sm"),
        paddingY: "0.25rem", // the padding-block act as a minimum spacing between content and root element
        paddingX: "1rem",
      };
    case "lg":
      return {
        "--circular-progress-size": "28px",
        "--circular-progress-thickness": "4px",
        "--icon-font-size": "1.75rem",
        "--button-gap": "0.75rem",
        minHeight: "var(--button-min-height, 3rem)",
        fontSize: cssVar("font-size-md"),
        paddingY: "0.375rem",
        paddingX: "1.5rem",
      };
  }
});

export const styles = createStyles({
  button: (
    app,
    variant: Variant,
    color: Color,
    size: Size,
    fullWidth: boolean,
  ) => {
    const styles: StyleObject = {
      appearance: "none",
      "--icon-margin": "initial", // reset the icon's margin.
      WebkitTapHighlightColor: "transparent",
      borderRadius: `var(--button-radius, ${cssVar("radius-sm")})`, // to be controlled by other components, eg. Input
      margin: `var(--button-margin)`, // to be controlled by other components, eg. Input
      border: "none",
      backgroundColor: "transparent",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      textDecoration: "none", // prevent user agent underline when used as anchor
      fontFamily: cssVar(`font-family-body`),
      fontWeight: cssVar(`font-weight-md`),
      lineHeight: 1,
      "&:focus-visible": app.theme.focus.default,
      "&:hover": getVariantStyle(variant, color, "hover"),
      "&:active": getVariantStyle(variant, color, "active"),
      ...getVariantStyle(variant, color),
      ...buttonSizeStyles(size),
    };
    if (fullWidth) {
      (styles as any).width = "100%";
    }
    (styles as any)["&.loading"] = {
      color: "transparent",
      "&:hover": { color: "transparent" },
      "&:active": { color: "transparent" },
    };
    return styles;
  },
  startDecorator: {
    "--icon-margin": "0 0 0 calc(var(--button-gap) / -2)",
    "--circular-progress-margin": "0 0 0 calc(var(--button-gap) / -2)",
    display: "inherit",
    marginRight: "var(--button-gap)",
  },
  endDecorator: {
    "--icon-margin": "0 calc(var(--button-gap) / -2) 0 0",
    "--circular-progress-margin": "0 calc(var(--button-gap) / -2) 0 0",
    display: "inherit",
    marginLeft: "var(--button-gap)",
  },
  loadingCenter: (_, variant: Variant, color: Color) => ({
    display: "inherit",
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    color: (getVariantStyle(variant, color) as any).color,
    // ...(ownerState.disabled && {
    //   color: theme.variants[`${ownerState.variant!}Disabled`]?.[ownerState.color!]?.color,
    // }),
  }),
});

export function button(opts: ButtonOpts) {
  const buttonOvewrite = getComponentOverwrite("button");
  if (buttonOvewrite) {
    return buttonOvewrite(opts);
  }
  const slot = createSlotsFn(opts);
  const size = opts.size ?? "md";
  const color = opts.color ?? "primary";
  const loadingPosition = opts.loadingPosition ?? "center";
  const rootStyles = styles.button(
    opts.variant ?? "solid",
    color,
    size,
    opts.fullWidth ?? false,
  );
  const children: Node[] = [opts.children];
  const dynamicClasses: yom.DynamicClass[] = [];
  const loadingIndicator = opts.loading
    ? circularProgress({ color: color === "harmonize" ? undefined : color })
    : null;
  if (opts.loading && loadingPosition === "center") {
    dynamicClasses.push({ classes: "loading", condition: opts.loading });
    children.push(
      nodes.if(
        opts.loading,
        slot("loadingIndicatorCenter", {
          tag: "span",
          styles: styles.loadingCenter(
            opts.variant ?? "solid",
            opts.color ?? "primary",
          ),
          children: loadingIndicator!,
        }),
      ),
    );
  }
  if (opts.startDecorator || (opts.loading && loadingPosition === "start")) {
    if (!opts.startDecorator) {
      children.unshift(
        nodes.if(
          opts.loading!,
          slot("startDecorator", {
            tag: "span",
            styles: styles.startDecorator,
            children: loadingIndicator!,
          }),
        ),
      );
    } else if (!opts.loading) {
      children.unshift(
        slot("startDecorator", {
          tag: "span",
          styles: styles.startDecorator,
          children: opts.startDecorator,
        }),
      );
    } else {
      children.unshift(
        slot("startDecorator", {
          tag: "span",
          styles: styles.startDecorator,
          children: nodes.if({
            condition: opts.loading,
            then: loadingIndicator!,
            else: opts.startDecorator,
          }),
        }),
      );
    }
  }
  if (opts.endDecorator || (opts.loading && loadingPosition === "end")) {
    if (!opts.endDecorator) {
      children.push(
        nodes.if(
          opts.loading!,
          slot("endDecorator", {
            tag: "span",
            styles: styles.endDecorator,
            children: loadingIndicator!,
          }),
        ),
      );
    } else if (!opts.loading) {
      children.push(
        slot("endDecorator", {
          tag: "span",
          styles: styles.endDecorator,
          children: opts.endDecorator,
        }),
      );
    } else {
      children.push(
        slot("endDecorator", {
          tag: "span",
          styles: styles.endDecorator,
          children: nodes.if({
            condition: opts.loading,
            then: loadingIndicator!,
            else: opts.endDecorator,
          }),
        }),
      );
    }
  }
  return slot("root", {
    tag: opts.href ? "a" : "button",
    styles: rootStyles,
    dynamicClasses,
    props: { href: opts.href, disabled: opts.disabled, ...opts.props },
    children,
  });
}
