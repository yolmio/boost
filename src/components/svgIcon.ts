import { memoize } from "../utils/memoize.js";
import { element } from "../nodeHelpers.js";
import type { Node } from "../nodeTypes.js";
import { StyleObject } from "../styleTypes.js";
import type { ColorPaletteProp, FontSize } from "../theme.js";
import { cssVar } from "../styleUtils.js";

export type SvgIconColor = ColorPaletteProp | "harmonize" | "inherit";
export type SvgIconFontSize = keyof FontSize | "inherit";

export interface SvgIconOpts {
  color?: SvgIconColor;
  fontSize?: SvgIconFontSize;
  title?: string;
  children: Node;
}

const svgStyles = memoize((color: SvgIconColor, fontSize: SvgIconFontSize) => {
  const styles: StyleObject = {
    userSelect: "none",
    margin: "var(--icon-margin)",
    width: "1em",
    height: "1em",
    display: "inline-block",
    flexShrink: 0,
    transition: "fill 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
    fontSize: `var(--icon-font-size)`,
    color: "var(--icon-color)",
    fill: "currentcolor",
  };
  if (fontSize !== "inherit") {
    (styles as any)["--icon-font-size"] = cssVar(`font-size-${fontSize}`);
  }
  if (color === "harmonize") {
    styles.color = `var(--harmonize-plain-color)`;
  } else if (color !== "inherit") {
    styles.color = cssVar(`palette-${color}-plain-color`);
  }
  return styles;
});

export function svgIcon(opts: SvgIconOpts): Node {
  const styles = svgStyles(opts.color ?? "inherit", opts.fontSize ?? "inherit");
  let children = opts.children;
  if (opts.title) {
    children = [children, element("title", { children: opts.title })];
  }
  return element("svg", {
    props: {
      xmlns: "'http://www.w3.org/2000/svg'",
      viewBox: "'0 0 24 24'",
      role: opts.title ? "'img'" : undefined,
      "aria-hidden": "true",
      focusable: "false",
    },
    styles,
    children,
  });
}
