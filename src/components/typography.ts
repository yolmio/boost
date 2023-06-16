import { Node } from "../nodeTypes.js";
import { theme } from "../singleton.js";
import { StyleObject } from "../styleTypes.js";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils.js";
import { TypographyKeys, Variant } from "../theme.js";
import { AllHtmlTags } from "../yom.js";
import { Color } from "./types.js";
import { createSlotsFn, SlottedComponentWithSlotNames } from "./utils.js";

type Level = TypographyKeys | "inherit";

export interface TypographyOpts
  extends SlottedComponentWithSlotNames<"startDecorator" | "endDecorator"> {
  level?: Level;
  endDecorator?: Node;
  startDecorator?: Node;
  gutterBottom?: boolean;
  inline?: boolean;
  noWrap?: boolean;
  variant?: Variant;
  color?: Color;
  children: Node;
}

export const styles = createStyles({
  root: (
    hasEndDecorator: boolean,
    hasStartDecorator: boolean,
    inline: boolean,
    noWrap: boolean,
    gutterBottom: boolean,
    level: Level,
    color: Color | undefined,
    variant: Variant | undefined
  ): StyleObject => {
    return {
      "--icon-font-size": "1.25em",
      margin: 0,
      ...(inline
        ? {
            display: "inline",
          }
        : {
            fontFamily: cssVar(`font-family-body`), // for nested typography, the font family will be inherited.
            display: "block",
          }),
      ...((hasEndDecorator || hasStartDecorator) && {
        display: "flex",
        alignItems: "center",
        ...(inline && {
          display: "inline-flex",
          ...(hasStartDecorator && {
            verticalAlign: "bottom", // to make the text align with the parent's content
          }),
        }),
      }),
      ...(level && level !== "inherit" && theme.typography[level]),
      ...(noWrap && {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }),
      ...(gutterBottom && {
        marginBottom: "0.35em",
      }),
      ...(color &&
        color !== "harmonize" && {
          color: `rgba(${cssVar(`palette-${color}-main-channel`)} / 1)`,
        }),
      ...(variant &&
        color && {
          borderRadius: cssVar(`radius-xs`),
          paddingY: "min(0.15em, 4px)",
          paddingX: "0.375em", // better than left, right because it also works with writing mode.
          ...(!inline && {
            marginX: "-0.375em",
          }),
          ...getVariantStyle(variant, color),
        }),
    };
  },
  startDecorator: {
    display: "inline-flex",
    marginRight: "clamp(4px, var(--typography-gap, 0.375em), 0.75rem)",
  },
  endDecorator: {
    display: "inline-flex",
    marginLeft: "clamp(4px, var(--Typography-gap, 0.375em), 0.75rem)",
  },
});

const tagMapping: Record<Level, AllHtmlTags> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  display1: "h1",
  display2: "h2",
  body1: "p",
  body2: "p",
  body3: "span",
  body4: "span",
  body5: "span",
  inherit: "p",
};

export function typography(opts: TypographyOpts) {
  const slot = createSlotsFn(opts);
  const level = opts.level ?? "body1";
  const tag = opts.inline ? "span" : tagMapping[level];
  let children = opts.children;
  if (opts.startDecorator) {
    children = [
      slot("startDecorator", {
        tag: "span",
        styles: styles.startDecorator,
        children: opts.startDecorator,
      }),
      children,
    ];
  }
  if (opts.endDecorator) {
    children = [
      children,
      slot("endDecorator", {
        tag: "span",
        styles: styles.endDecorator,
        children: opts.endDecorator,
      }),
    ];
  }
  const rootStyles = styles.root(
    Boolean(opts.endDecorator),
    Boolean(opts.startDecorator),
    opts.inline ?? false,
    opts.noWrap ?? false,
    opts.gutterBottom ?? false,
    level,
    opts.color,
    opts.variant
  );
  return slot("root", {
    tag,
    styles: rootStyles,
    children,
  });
}
