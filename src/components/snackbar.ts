import { app } from "../app";
import type { Node } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { Variant } from "../theme";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import {
  createSlotsFn,
  getComponentOverwrite,
  SlottedComponentWithSlotNames,
} from "./utils";
import { Color, ComponentOpts, Size } from "./types";

export interface AnchorOrigin {
  vertical: "top" | "bottom";
  horizontal: "left" | "center" | "right";
}

export interface SnackbarOpts
  extends SlottedComponentWithSlotNames<"startDecorator" | "endDecorator">,
    ComponentOpts {
  anchorOrigin?: AnchorOrigin;
  startDecorator?: Node;
  endDecorator?: Node;
  children: Node;
}

export const styles = createStyles({
  snackbar: (
    variant: Variant,
    color: Color,
    size: Size,
    anchorOrigin: AnchorOrigin
  ) => {
    const theme = app.ui.theme;
    const styles: StyleObject = {
      "--snackbar-radius": cssVar(`radius-sm`),
      "--snackbar-decorator-child-radius":
        "max((var(--snackbar-radius) - var(--variant-border-width, 0px)) - var(--snackbar-padding), min(var(--snackbar-padding) + var(--variant-border-width, 0px), var(--snackbar-radius) / 2))",
      "--button-min-height": "var(--snackbar-decorator-child-height)",
      "--icon-button-size": "var(--snackbar-decorator-child-height)",
      "--button-radius": "var(--snackbar-decorator-child-radius)",
      "--icon-button-radius": "var(--snackbar-decorator-child-radius)",
      "--icon-color": "currentColor",
      ...(size === "sm" && {
        "--snackbar-padding": "0.75rem",
        "--snackbar-inset": "0.5rem",
        "--snackbar-decorator-child-height": "1.5rem",
        "--icon-font-size": cssVar(`font-size-xl`),
        gap: "0.5rem",
      }),
      ...(size === "md" && {
        "--snackbar-padding": "1rem",
        "--snackbar-inset": "0.75rem",
        "--snackbar-decorator-child-height": "2rem",
        "--icon-font-size": cssVar(`font-size-xl`),
        gap: "0.625rem",
      }),
      ...(size === "lg" && {
        "--snackbar-padding": "1.25rem",
        "--snackbar-inset": "1rem",
        "--snackbar-decorator-child-height": "2.375rem",
        "--icon-font-size": cssVar(`font-size-xl2`),
        gap: "0.875rem",
      }),
      zIndex: theme.zIndex.snackbar,
      position: "fixed",
      display: "flex",
      alignItems: "center",
      minWidth: 300,
      top:
        anchorOrigin.vertical === "top" ? "var(--snackbar-inset)" : undefined,
      left:
        anchorOrigin.horizontal === "left"
          ? "var(--snackbar-inset)"
          : undefined,
      bottom:
        anchorOrigin.vertical === "bottom"
          ? "var(--snackbar-inset)"
          : undefined,
      right:
        anchorOrigin.horizontal === "right"
          ? "var(--snackbar-inset)"
          : undefined,
      ...(anchorOrigin.horizontal === "center" && {
        "--snackbar-translate-x": "-50%",
        left: "50%",
        transform: "translateX(var(--snackbar-translate-x))",
      }),
      ...(anchorOrigin.vertical === "top" && {
        "--_snackbar-anchor-bottom": "-1",
      }),
      //   animation: `${enterAnimation} ${ownerState.animationDuration}ms forwards`,
      //   ...(!ownerState.open && {
      //     animationName: exitAnimation,
      //   }),
      boxShadow: cssVar(`shadow-lg`),
      backgroundColor: cssVar(`palette-background-surface`),
      padding: "var(--snackbar-padding)",
      borderRadius: "var(--snackbar-radius)",
      ...theme.typography[
        `body-${({ sm: "xs", md: "sm", lg: "md" } as const)[size]}`
      ],
      ...getVariantStyle(variant, color),
    };
    return styles;
  },
  startDecorator: {
    display: "inherit",
    flex: "none",
  },
  endDecorator: {
    display: "inherit",
    flex: "none",
    marginLeft: "auto",
  },
});

export function snackbar(opts: SnackbarOpts) {
  const snackbarOvewrite = getComponentOverwrite("snackbar");
  if (snackbarOvewrite) {
    return snackbarOvewrite(opts);
  }
  const slot = createSlotsFn(opts);
  const size = opts.size ?? "md";
  const color = opts.color ?? "primary";
  const variant = opts.variant ?? "outlined";
  const children: Node[] = [opts.children];
  if (opts.startDecorator) {
    children.unshift(
      slot("startDecorator", {
        tag: "span",
        styles: styles.startDecorator,
        children: opts.startDecorator,
      })
    );
  }
  if (opts.endDecorator) {
    children.push(
      slot("endDecorator", {
        tag: "span",
        styles: styles.endDecorator,
        children: opts.endDecorator,
      })
    );
  }
  return slot("root", {
    tag: "div",
    styles: styles.snackbar(
      variant,
      color,
      size,
      opts.anchorOrigin ?? { vertical: "bottom", horizontal: "left" }
    ),
    children,
  });
}
