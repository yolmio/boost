import { element } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { Style } from "../styleTypes.js";
import { cssVar, getVariantStyle } from "../styleUtils.js";
import { ColorPaletteProp, Variant } from "../theme.js";
import { memoize } from "../utils/memoize.js";

type Color = ColorPaletteProp | "harmonize";
type Size = "sm" | "md" | "lg";

export interface AlertOpts {
  variant?: Variant;
  color?: Color;
  size?: Size;
  startDecorator?: Node;
  endDecorator?: Node;
  styles?: Style;
  children: Node;
}

const getAlertStyles = memoize((variant: Variant, color: Color, size: Size) => {
  return {
    "--alert-radius": cssVar("radius-sm"),
    "--alert-decorator-child-radius":
      "max((var(--alert-radius) - var(--variant-border-width, 0px)) - var(--alert-padding), min(var(--alert-padding) + var(--variant-border-width, 0px), var(--alert-radius) / 2))",
    "--button-min-height": "var(--alert-decorator-child-height)",
    "--icon-button-size": "var(--alert-decorator-child-height)",
    "--button-radius": "var(--alert-decorator-child-radius)",
    "--icon-button-radius": "var(--alert-decorator-child-radius)",
    ...(size === "sm" && {
      "--alert-padding": "0.5rem",
      "--alert-gap": "0.375rem",
      "--alert-decorator-child-height": "1.5rem",
      "--icon-font-size": "1.125rem",
      fontSize: cssVar(`font-size-sm`),
    }),
    ...(size === "md" && {
      "--alert-padding": "0.75rem",
      "--alert-gap": "0.5rem",
      "--alert-decorator-child-height": "2rem",
      "--icon-font-size": "1.25rem",
      fontSize: cssVar(`font-size-sm`),
      fontWeight: cssVar(`font-weight-md`),
    }),
    ...(size === "lg" && {
      "--alert-padding": "1rem",
      "--alert-gap": "0.75rem",
      "--alert-decorator-child-height": "2.375rem",
      "--icon-font-size": "1.5rem",
      fontSize: cssVar(`font-size-md`),
      fontWeight: cssVar(`font-weight-md`),
    }),
    fontFamily: cssVar(`font-family-body`),
    lineHeight: cssVar(`line-height-md`),
    backgroundColor: "transparent",
    display: "flex",
    alignItems: "center",
    padding: `var(--alert-padding)`,
    borderRadius: "var(--alert-radius)",
    ...getVariantStyle(variant, color),
  };
});

const getStartDecoratorStyles = memoize((color: Color, variant: Variant) => ({
  display: "inherit",
  flex: "none",
  marginRight: "var(--alert-gap)",
  ...(color !== "harmonize" && {
    color: cssVar(`palette-${color}-${variant}-color`),
  }),
}));

const getEndDecoratorStyles = memoize((color: Color, variant: Variant) => ({
  display: "inherit",
  flex: "none",
  marginLeft: "var(--alert-gap)",
  ...(color !== "harmonize" && {
    color: cssVar(`palette-${color}-${variant}-color`),
  }),
}));

export function alert(opts: AlertOpts) {
  const color = opts.color ?? "primary";
  const variant = opts.variant ?? "soft";
  let children = opts.children;
  if (opts.startDecorator) {
    children = [
      element("span", {
        styles: getStartDecoratorStyles(color, variant),
        children: opts.startDecorator,
      }),
      children,
    ];
  }
  if (opts.endDecorator) {
    children = [
      children,
      element("span", {
        styles: getEndDecoratorStyles(color, variant),
        children: opts.endDecorator,
      }),
    ];
  }
  const styles = getAlertStyles(variant, color, opts.size ?? "md");
  return element("div", {
    styles: opts.styles ? [styles, opts.styles] : styles,
    children,
  });
}
