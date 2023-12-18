import { Node } from "../nodeTypes";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { Variant } from "../theme";
import { Color, ComponentOpts, Size } from "./types";
import { SlottedComponentWithSlotNames, createSlotsFn } from "./utils";

export interface AlertOpts
  extends ComponentOpts,
    SlottedComponentWithSlotNames<"startDecorator" | "endDecorator" | "root"> {
  startDecorator?: Node;
  endDecorator?: Node;
  children: Node;
}

const styles = createStyles({
  root: (_, variant: Variant, color: Color, size: Size) => {
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
  },
  startDecorator: (_, color: Color, variant: Variant) => ({
    display: "inherit",
    flex: "none",
    marginRight: "var(--alert-gap)",
    ...(color !== "harmonize" && {
      color: cssVar(`palette-${color}-${variant}-color`),
    }),
  }),
  endDecorator: (_, color: Color, variant: Variant) => ({
    display: "inherit",
    flex: "none",
    marginLeft: "var(--alert-gap)",
    ...(color !== "harmonize" && {
      color: cssVar(`palette-${color}-${variant}-color`),
    }),
  }),
});

export function alert(opts: AlertOpts) {
  const slot = createSlotsFn(opts);
  const color = opts.color ?? "primary";
  const variant = opts.variant ?? "soft";
  const children = [opts.children];
  if (opts.startDecorator) {
    children.unshift(
      slot("startDecorator", {
        tag: "span",
        styles: styles.startDecorator(color, variant),
        children: opts.startDecorator,
      }),
    );
  }
  if (opts.endDecorator) {
    children.unshift(
      slot("endDecorator", {
        tag: "span",
        styles: styles.endDecorator(color, variant),
        children: opts.endDecorator,
      }),
    );
  }
  return slot("root", {
    tag: "div",
    styles: styles.root(variant, color, opts.size ?? "md"),
    children,
  });
}
