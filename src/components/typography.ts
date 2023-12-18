import { Node } from "../nodeTypes";
import { hub } from "../hub";
import { StyleObject } from "../styleTypes";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { TypographyKeys, Variant } from "../theme";
import { AllHtmlTags } from "../yom";
import { Color } from "./types";
import { createSlotsFn, SlottedComponentWithSlotNames } from "./utils";

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
    { theme },
    hasEndDecorator: boolean,
    hasStartDecorator: boolean,
    inline: boolean,
    noWrap: boolean,
    gutterBottom: boolean,
    level: Level,
    color: Color | undefined,
    variant: Variant | undefined,
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
    marginLeft: "clamp(4px, var(--typography-gap, 0.375em), 0.75rem)",
  },
});

const tagMapping: Record<Level, AllHtmlTags> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  "title-lg": "p",
  "title-md": "p",
  "title-sm": "p",
  "body-lg": "p",
  "body-md": "p",
  "body-sm": "p",
  "body-xs": "span",
  inherit: "p",
};

export function typography(opts: TypographyOpts) {
  const slot = createSlotsFn(opts);
  const level = opts.level ?? "body-md";
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
    opts.variant,
  );
  return slot("root", {
    tag,
    styles: rootStyles,
    children,
  });
}
