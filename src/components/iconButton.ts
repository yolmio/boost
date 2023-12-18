import { hub } from "../hub";
import type { ElementNode, Node } from "../nodeTypes";
import type { Style, StyleObject } from "../styleTypes";
import { Variant } from "../theme";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { Color, ComponentOpts, Size } from "./types";
import { mergeEls, SingleElementComponentOpts } from "./utils";

export interface IconButtonOpts
  extends ComponentOpts,
    SingleElementComponentOpts {
  /** expression for if the button is disabled */
  disabled?: string;
  /** expression for href, will make button into an anchor tag and add this prop */
  href?: string;
  ariaLabel: string;

  children: Node;
}

/** This is internal, don't touch! */
export const styles = createStyles({
  root: (app, size: Size, variant: Variant, color: Color): Style => {
    const styles: StyleObject = {
      "--icon-margin": "initial", // reset the icon's margin.
      "--circular-progress-size": "var(--icon-font-size)",
      WebkitTapHighlightColor: "transparent",
      paddingY: 0,
      fontFamily: cssVar(`font-family-body`),
      fontWeight: cssVar(`font-weight-md`),
      margin: `var(--icon-button-margin)`, // to be controlled by other components, eg. Input
      borderRadius: `var(--icon-button-radius, ${cssVar(`radius-sm`)})`, // to be controlled by other components, eg. Input
      border: "none",
      boxSizing: "border-box",
      backgroundColor: "transparent",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      transition:
        "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
      "&:focus-visible": app.theme.focus.default,
    };
    switch (size) {
      case "sm":
        styles["--icon-font-size"] =
          "calc(var(--icon-button-size, 2rem) / 1.6)";
        styles.minWidth = "var(--icon-button-size, 2rem)";
        styles.minHeight = "var(--icon-button-size, 2rem)";
        styles.fontSize = cssVar(`font-size-sm`);
        styles.paddingX = "2px";
        break;
      case "md":
        styles["--icon-font-size"] =
          "calc(var(--icon-button-size, 2.5rem) / 1.667)";
        styles.minWidth = "var(--icon-button-size, 2.5rem)";
        styles.minHeight = "var(--icon-button-size, 2.5rem)";
        styles.fontSize = cssVar(`font-size-md`);
        styles.paddingX = "0.25rem";
        break;
      case "lg":
        styles["--icon-font-size"] =
          "calc(var(--icon-button-size, 3rem) / 1.714)";
        styles.minWidth = "var(--icon-button-size, 3rem)";
        styles.minHeight = "var(--icon-button-size, 3rem)";
        styles.fontSize = cssVar(`font-size-lg`);
        styles.paddingX = "0.375rem";
        break;
    }
    return [
      styles,
      getVariantStyle(variant, color),
      { "&:hover": getVariantStyle(variant, color, "hover") },
      { "&:active": getVariantStyle(variant, color, "active") },
    ];
  },
});

export function iconButton(opts: IconButtonOpts): ElementNode {
  const rootStyles = styles.root(
    opts.size ?? "md",
    opts.variant ?? "solid",
    opts.color ?? "primary",
  );
  return mergeEls(
    {
      tag: opts.href ? "a" : "button",
      props: {
        href: opts.href,
        disabled: opts.disabled,
        "aria-label": opts.ariaLabel,
      },
      children: opts.children,
      styles: rootStyles,
    },
    opts,
  );
}
