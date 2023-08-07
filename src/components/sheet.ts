import { memoize } from "../utils/memoize";
import { ElementEventHandlers, ElementProps } from "../yom";
import { element } from "../nodeHelpers";
import type { ElementNode, Node } from "../nodeTypes";
import { Variant } from "../theme";
import { cssVar, getVariantStyle } from "../styleUtils";
import { Color, ComponentOpts } from "./types";

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
