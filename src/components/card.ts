import type { ElementNode, Node } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { Variant } from "../theme";
import {
  createHarmonizeVars,
  createStyles,
  cssVar,
  getVariantStyle,
} from "../styleUtils";
import { Color, ComponentOpts, Size } from "./types";
import { mergeEls, SingleElementComponentOpts } from "./utils";

type Orientation = "vertical" | "horizontal";

export interface CardOpts extends ComponentOpts, SingleElementComponentOpts {
  orientation?: Orientation;
  createHarmonizeVars?: boolean;
  children: Node;
}

const styles = createStyles({
  card: (
    size: Size,
    variant: Variant,
    color: Color,
    orientation: Orientation,
    createHarmonizeVarsOpt: boolean
  ) => {
    const styles: StyleObject = {
      // a context variable for any child component
      "--card-childRadius":
        "max((var(--card-radius) - var(--variant-border-width, 0px)) - var(--card-padding), min(var(--card-padding) / 2, (var(--card-radius) - var(--variant-border-width, 0px)) / 2))",
      // AspectRatio integration
      "--aspect-ratio-radius": "var(--card-childRadius)",
      // Link integration
      "--internal-action-margin": "calc(-1 * var(--variant-border-width, 0px))",
      // Link, Radio, Checkbox integration
      "--internal-action-radius": "var(--card-radius)",
      // CardCover integration
      "--card-cover-radius":
        "calc(var(--card-radius) - var(--variant-border-width, 0px))",
      // CardOverflow integration
      "--card-overflow-offset": `calc(-1 * var(--card-padding))`,
      "--card-overflow-radius":
        "calc(var(--card-radius) - var(--variant-border-width, 0px))",
      // Divider integration
      "--divider-inset": "calc(-1 * var(--card-padding))",
      padding: "var(--card-padding)",
      borderRadius: "var(--card-radius)",
      boxShadow: cssVar(`shadow-sm`),
      backgroundColor: cssVar(`palette-background-surface`),
      fontFamily: cssVar(`font-family-body`),
      position: "relative",
      display: "flex",
      flexDirection: orientation === "horizontal" ? "row" : "column",
      ...getVariantStyle(variant, color),
    };
    if (createHarmonizeVarsOpt) {
      Object.assign(styles, createHarmonizeVars(variant as any, color as any));
    }
    switch (size) {
      case "sm":
        Object.assign(styles, {
          "--card-radius": cssVar(`radius-sm`),
          "--card-padding": "0.5rem",
        });
        break;
      case "md":
        Object.assign(styles, {
          "--card-radius": cssVar(`radius-md`),
          "--card-padding": "1rem",
          fontSize: cssVar(`font-size-md`),
        });
        break;
      case "lg":
        Object.assign(styles, {
          "--card-radius": cssVar(`radius-lg`),
          "--card-padding": "1.5rem",
        });
        break;
    }
    return styles;
  },
  cardOverflow: (variant: Variant, color: Color, row: boolean) => {
    const childRadius =
      "calc(var(--card-overflow-radius) - var(--variant-border-width, 0px))";
    const styles: StyleObject = row
      ? {
          "--aspect-ratio-margin": "calc(-1 * var(--card-padding)) 0px",
          marginTop: "var(--card-overflow-offset)",
          marginBottom: "var(--card-overflow-offset)",
          padding: "var(--card-padding) 0px",
          borderRadius: "var(--card-overflow-radius)",
          position: "relative",
          "&:first-child": {
            "--aspect-ratio-radius": `${childRadius} 0 0 ${childRadius}`,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            marginLeft: "var(--card-overflow-offset)",
          },
          "&:last-child": {
            "--aspect-ratio-radius": `0 ${childRadius} ${childRadius} 0`,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            marginRight: "var(--card-overflow-offset)",
          },
        }
      : {
          "--aspect-ratio-margin": "0px calc(-1 * var(--card-padding))",
          marginLeft: "var(--card-overflow-offset)",
          marginRight: "var(--card-overflow-offset)",
          padding: "0px var(--card-padding)",
          borderRadius: "var(--card-overflow-radius)",
          position: "relative",
          "&:first-child": {
            "--aspect-ratio-radius": `${childRadius} ${childRadius} 0 0`,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            marginTop: "var(--card-overflow-offset)",
          },
          "&:last-child": {
            "--aspect-ratio-radius": `0 0 ${childRadius} ${childRadius}`,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            marginBottom: "var(--card-overflow-offset)",
          },
        };
    Object.assign(styles, getVariantStyle(variant, color));
    return styles;
  },
});

export function card(opts: CardOpts): ElementNode {
  const rootStyles = styles.card(
    opts.size ?? "md",
    opts.variant ?? "plain",
    opts.color ?? "neutral",
    opts.orientation ?? "vertical",
    opts.createHarmonizeVars ?? false
  );
  return mergeEls(
    {
      tag: "div",
      styles: rootStyles,
      children: opts.children,
    },
    opts
  );
}

export interface CardOverflowOpts
  extends ComponentOpts,
    SingleElementComponentOpts {
  row?: boolean;
  children: Node;
}

export function cardOverflow(opts: CardOverflowOpts): ElementNode {
  const rootStyles = styles.cardOverflow(
    opts.variant ?? "plain",
    opts.color ?? "neutral",
    opts.row ?? false
  );
  return mergeEls({
    tag: "div",
    styles: rootStyles,
    children: opts.children,
  });
}
