import { memoize } from "../utils/memoize.js";
import { ElementEventHandlers, ElementProps } from "../yom.js";
import { element } from "../nodeHelpers.js";
import type { ElementNode, Node } from "../nodeTypes.js";
import { Variant } from "../theme.js";
import { cssVar, getVariantStyle } from "../styleUtils.js";
import { Color, ComponentOpts } from "./types.js";

export interface SheetOpts extends Omit<ComponentOpts, "size"> {
  props?: ElementProps;
  on?: ElementEventHandlers;

  children: Node;
}

const sheetStyles = memoize((variant: Variant, color: Color) => {
  return {
    backgroundColor: cssVar(`palette-background-surface`),
    ...getVariantStyle(variant, color),
  };
});

export function sheet(opts: SheetOpts): ElementNode {
  const styles = sheetStyles(opts.variant ?? "plain", opts.color ?? "neutral");
  return element("div", {
    props: opts.props,
    styles,
    children: opts.children,
    on: opts.on,
  });
}
