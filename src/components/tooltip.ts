import { ifNode, portal, state } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { debugExpr, delay, if_, scalar, setScalar } from "../procHelpers";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { SequentialIDGenerator } from "../utils/SequentialIdGenerator";
import { stringLiteral } from "../utils/sqlHelpers";
import { ElementEventHandlers, ElementProps } from "../yom";
import { Color, ComponentOpts, Size, Variant } from "./types";
import {
  createSlotsFn,
  getUniqueUiId,
  SlottedComponentWithSlotNames,
} from "./utils";

export interface TooltipOpts
  extends ComponentOpts,
    SlottedComponentWithSlotNames<"arrow"> {
  anchorEl: string;
  placement?: string;

  open: string;
  children: Node;
}

const styles = createStyles({
  root: (color: Color, variant: Variant, size: Size) => {
    const variantStyle = getVariantStyle(variant, color);
    return {
      ...(size === "sm" && {
        "--icon-font-size": "1rem",
        "--tooltip-arrow-size": "8px",
        py: 0.5,
        px: 0.625,
        fontSize: cssVar(`font-size-xs`),
      }),
      ...(size === "md" && {
        "--icon-font-size": "1.125rem",
        "--tooltip-arrow-size": "10px",
        py: 0.625,
        px: 0.75,
        fontSize: cssVar(`font-size-sm`),
      }),
      ...(size === "lg" && {
        "--icon-font-size": "1.25rem",
        "--tooltip-arrow-size": "12px",
        py: 0.75,
        px: 1,
        fontSize: cssVar(`font-size-md`),
      }),
      zIndex: 100,
      // pointerEvents: "none",
      borderRadius: cssVar(`radius-xs`),
      boxShadow: cssVar(`shadow-sm`),
      fontFamily: cssVar(`font-family-body`),
      fontWeight: cssVar(`font-weight-md`),
      lineHeight: cssVar(`line-height-sm`),
      wordWrap: "break-word",
      position: "relative",
      //   ...(!ownerState.disableInteractive && {
      //     pointerEvents: "auto",
      //   }),
      //   ...(!ownerState.open && {
      //     pointerEvents: "none",
      //   }),
      ...variantStyle,
      ...((variant === "plain" || variant == "outlined") && {
        backgroundColor: cssVar(`palette-background-surface`),
      }),
      "&::before": {
        // acts as a invisible connector between the element and the tooltip
        // so that the cursor can move to the tooltip without losing focus.
        content: '""',
        display: "block",
        position: "absolute",
      },
      '&[data-floating-placement*="bottom"]::before': {
        top: 0,
        left: 0,
        transform: "translateY(-100%)",
        height: "calc(11px + var(--variant-border-width, 0px))",
        width: "100%",
      },
      '&[data-floating-placement*="left"]::before': {
        top: 0,
        right: 0,
        transform: "translateX(100%)",
        width: "calc(11px + var(--variant-border-width, 0px))",
        height: "100%",
      },
      '&[data-floating-placement*="right"]::before': {
        top: 0,
        left: 0,
        transform: "translateX(-100%)",
        width: "calc(11px + var(--variant-border-width, 0px))",
        height: "100%",
      },
      '&[data-floating-placement*="top"]::before': {
        bottom: 0,
        left: 0,
        transform: "translateY(100%)",
        height: "calc(11px + var(--variant-border-width, 0px))",
        width: "100%",
      },
    };
  },
  arrow: (color: Color, variant: Variant) => {
    const variantStyle = getVariantStyle(variant, color);
    return {
      "--tooltip-arrow-rotation": 0,
      width: "var(--tooltip-arrow-size)",
      height: "var(--tooltip-arrow-size)",
      boxSizing: "border-box",
      position: "absolute",
      // use psuedo element because Popper controls the `transform` property of the arrow.
      "&:before": {
        content: '""',
        display: "block",
        position: "absolute",
        width: 0,
        height: 0,
        border: "calc(var(--tooltip-arrow-size) / 2) solid",
        borderLeftColor: "transparent",
        borderBottomColor: "transparent",
        borderTopColor:
          variant === "outlined" || variant === "plain"
            ? cssVar(`palette-background-surface`)
            : (variantStyle as any).backgroundColor,
        borderRightColor:
          variant === "outlined" || variant === "plain"
            ? cssVar(`palette-background-surface`)
            : (variantStyle as any).backgroundColor,
        borderRadius: `0px 2px 0px 0px`,
        boxShadow:
          variant === "outlined"
            ? `var(--variant-border-width, 0px) calc(-1 * var(--variant-border-width, 0px)) 0px 0px ${
                (variantStyle as any).borderColor
              }`
            : undefined,
        transformOrigin: "center center",
        transform:
          "rotate(calc(-45deg + 90deg * var(--tooltip-arrow-rotation)))",
      },
      '[data-floating-placement*="bottom"] &': {
        top: "calc(0.5px + var(--tooltip-arrow-size) * -1 / 2)", // 0.5px is for perfect overlap with the Tooltip
      },
      '[data-floating-placement*="top"] &': {
        "--tooltip-arrow-rotation": 2,
        bottom: "calc(0.5px + var(--tooltip-arrow-size) * -1 / 2)",
      },
      '[data-floating-placement*="left"] &': {
        "--tooltip-arrow-rotation": 1,
        right: "calc(0.5px + var(--tooltip-arrow-size) * -1 / 2)",
      },
      '[data-floating-placement*="right"] &': {
        "--tooltip-arrow-rotation": 3,
        left: "calc(0.5px + var(--tooltip-arrow-size) * -1 / 2)",
      },
    };
  },
});

export function tooltip(opts: TooltipOpts) {
  const slot = createSlotsFn(opts);
  const variant = opts.variant ?? "solid";
  const color = opts.color ?? "neutral";
  const size = opts.size ?? "md";
  const arrowId = stringLiteral(getUniqueUiId());
  return state({
    procedure: [scalar(`tooltip_hover`, `false`)],
    children: ifNode(
      opts.open + ` or tooltip_hover`,
      portal(
        slot("root", {
          tag: "div",
          styles: styles.root(color, variant, size),
          floating: {
            anchorEl: opts.anchorEl,
            placement: opts.placement ?? `'bottom'`,
            strategy: "'absolute'",
            offset: {
              mainAxis: `10`,
              crossAxis: `0`,
            },
            arrow: {
              elementId: arrowId,
            },
          },
          on: {
            mouseEnter: [setScalar(`tooltip_hover`, `true`)],
            mouseLeave: [setScalar(`tooltip_hover`, `false`)],
          },
          children: [
            opts.children,
            slot("arrow", {
              tag: "span",
              styles: styles.arrow(color, variant),
              props: { id: arrowId },
            }),
          ],
        })
      )
    ),
  });
}

export interface WrapInTooltipChildrenOpts {
  eventHandlers: ElementEventHandlers;
  props: ElementProps;
}

export interface WrapInTooltipOpts {
  title: Node;
  idBase?: string;
  children: (opts: WrapInTooltipChildrenOpts) => Node;
}

export function wrapInTooltip(opts: WrapInTooltipOpts) {
  const anchorEl = opts.idBase
    ? opts.idBase + " || " + stringLiteral(getUniqueUiId())
    : stringLiteral(getUniqueUiId());
  return state({
    procedure: [scalar(`open_tooltip`, `false`), scalar(`enter_count`, `0`)],
    children: [
      opts.children({
        eventHandlers: {
          mouseEnter: [
            setScalar(`open_tooltip`, `true`),
            setScalar(`enter_count`, `enter_count + 1`),
          ],
          mouseLeave: [
            scalar(`prev_enter_count`, `enter_count`),
            delay(`50`),
            if_(
              `prev_enter_count = enter_count`,
              setScalar(`open_tooltip`, `false`)
            ),
          ],
        },
        props: { id: anchorEl },
      }),
      tooltip({ anchorEl, open: `open_tooltip`, children: opts.title }),
    ],
  });
}
