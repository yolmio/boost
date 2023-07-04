import { lazy } from "../utils/memoize.js";
import { model } from "../singleton.js";
import { element } from "../nodeHelpers.js";
import type { Node } from "../nodeTypes.js";
import { StyleObject } from "../styleTypes.js";
import { Variant } from "../theme.js";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils.js";
import { Color, ComponentOpts, Size } from "./types.js";
import {
  createSlotsFn,
  SingleElementComponentOpts,
  SlottedComponentWithSlotNames,
} from "./utils.js";
import { mergeEls } from "./utils.js";
import { svgIcon } from "./svgIcon.js";
import { SqlExpression } from "../yom.js";

export interface SelectedVariation extends SelectedVariationBase {
  isSelected: SqlExpression;
}

export interface SelectedVariationBase {
  variant: Variant;
  color: Color;
}

export interface ChipOpts
  extends ComponentOpts,
    SlottedComponentWithSlotNames<
      "startDecorator" | "endDecorator" | "action" | "label"
    > {
  clickable?: boolean;

  selected?: SelectedVariation;

  startDecorator?: Node;
  endDecorator?: Node;

  children?: Node;
}

const styles = createStyles({
  root: (
    variant: Variant,
    color: Color,
    size: Size,
    clickable: boolean,
    selectedVariant: SelectedVariationBase | undefined
  ) => {
    const styles: StyleObject = {
      // for controlling chip delete margin offset
      "--chip-decorator-child-offset":
        "min(calc(var(--chip-padding-x) - (var(--_chip-min-height) - 2 * var(--variant-border-width, 0px) - var(--chip-decorator-child-height)) / 2), var(--chip-padding-x))",
      "--chip-decorator-child-radius":
        "max(var(--_chip-radius) - var(--variant-border-width, 0px) - var(--_chip-padding-y), min(var(--_chip-padding-y) + var(--variant-border-width, 0px), var(--_chip-radius) / 2))",
      "--chip-delete-radius": "var(--chip-decorator-child-radius)",
      "--chip-delete-size": "var(--chip-decorator-child-height)",
      "--avatar-radius": "var(--chip-decorator-child-radius)",
      "--avatar-size": "var(--chip-decorator-child-height)",
      "--icon-margin": "initial", // reset the icon's margin.
      "--action-radius": "var(--_chip-radius)", // to be used with Radio or Checkbox
      "--_chip-radius": "var(--chip-radius, 1.5rem)",
      "--_chip-padding-y":
        "max((var(--_chip-min-height) - 2 * var(--variant-border-width, 0px) - var(--chip-decorator-child-height)) / 2, 0px)",
      minHeight: "var(--_chip-min-height)",
      paddingX: "var(--chip-padding-x)",
      borderRadius: "var(--_chip-radius)",
      position: "relative",
      fontWeight: cssVar(`font-weight-md`),
      fontFamily: cssVar(`font-family-body`),
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      whiteSpace: "nowrap",
      textDecoration: "none",
      verticalAlign: "middle",
      boxSizing: "border-box",
      //   [`&.${chipClasses.disabled}`]: {
      //     color: theme.variants[`${ownerState.variant!}Disabled`]?.[ownerState.color!]?.color,
      //   },
    };
    switch (size) {
      case "sm":
        Object.assign(styles, {
          "--chip-gap": "0.25rem",
          "--chip-padding-x": "0.5rem",
          "--chip-decorator-child-height":
            "calc(min(1.125rem, var(--_chip-min-height)) - 2 * var(--variant-border-width, 0px))",
          "--icon-font-size": "calc(var(--_chip-min-height) / 1.714)", // 0.875rem by default
          "--_chip-min-height": "var(--chip-min-height, 1.5rem)",
          fontSize: cssVar(`font-size-xs`),
        });
        break;
      case "md":
        Object.assign(styles, {
          "--chip-gap": "0.375rem",
          "--chip-padding-x": "0.75rem",
          "--chip-decorator-child-height":
            "min(1.375rem, var(--_chip-min-height))",
          "--icon-font-size": "calc(var(--_chip-min-height) / 1.778)", // 1.125rem by default
          "--_chip-min-height": "var(--chip-min-height, 2rem)",
          fontSize: cssVar(`font-size-sm`),
        });
        break;
      case "lg":
        Object.assign(styles, {
          "--chip-gap": "0.5rem",
          "--chip-padding-x": "1rem",
          "--chip-decorator-child-height":
            "min(1.75rem, var(--_chip-min-height))",
          "--icon-font-size": "calc(var(--_chip-min-height) / 2)", // 1.25rem by default
          "--_chip-min-height": "var(--chip-min-height, 2.5rem)",
          fontSize: cssVar(`font-size-md`),
        });
        break;
    }
    if (clickable) {
      Object.assign(styles, {
        "--variant-border-width": "0px",
        color: (getVariantStyle(variant, color) as any).color,
      });
      if (selectedVariant) {
        styles["&.selected"] = {
          color: (
            getVariantStyle(
              selectedVariant.variant,
              selectedVariant.color
            ) as any
          ).color,
        };
      }
    } else {
      Object.assign(styles, getVariantStyle(variant, color));
      if (selectedVariant) {
        styles["&.selected"] = getVariantStyle(
          selectedVariant.variant,
          selectedVariant.color
        );
      }
      // todo disabled
    }
    return styles;
  },
  label: (clickable: boolean) => {
    const styles: StyleObject = {
      display: "inline-block",
      overflow: "hidden",
      textOverflow: "ellipsis",
      order: 1,
      minInlineSize: 0,
      flexGrow: 1,
    };
    if (clickable) {
      Object.assign(styles, { zIndex: 1, pointerEvents: "none" });
    }
    return styles;
  },
  action: (
    variant: Variant,
    color: Color,
    selectedVariant: SelectedVariationBase | undefined
  ) => {
    const styles: StyleObject = {
      position: "absolute",
      zIndex: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      border: "none",
      cursor: "pointer",
      padding: "initial",
      margin: "initial",
      backgroundColor: "initial",
      textDecoration: "none",
      borderRadius: "inherit",
      "&:focus": model.theme.focus.default,
      ...getVariantStyle(variant, color),
      "&:hover": getVariantStyle(variant, color, "hover"),
      "&:active": getVariantStyle(variant, color, "active"),
      // todo disabled
    };
    if (selectedVariant) {
      Object.assign(styles, {
        ".selected &": {
          ...getVariantStyle(selectedVariant.variant, selectedVariant.color),
          "&:hover": getVariantStyle(
            selectedVariant.variant,
            selectedVariant.color,
            "hover"
          ),
          "&:active": getVariantStyle(
            selectedVariant.variant,
            selectedVariant.color,
            "active"
          ),
        },
      });
    }
    return styles;
  },
  startDecorator: {
    "--avatar-margin-left": "calc(var(--chip-decorator-child-offset) * -1)",
    "--chip-delete-margin":
      "0 0 0 calc(var(--chip-decorator-child-offset) * -1)",
    "--icon-margin": "0 0 0 calc(var(--chip-padding-x) / -4)",
    display: "inherit",
    marginRight: "var(--chip-gap)",
    // set zIndex to 1 with order to stay on top of other controls, eg. Checkbox, Radio
    order: 0,
    zIndex: 1,
    pointerEvents: "none",
  },
  endDecorator: {
    "--chip-delete-margin":
      "0 calc(var(--chip-decorator-child-offset) * -1) 0 0",
    "--icon-margin": "0 calc(var(--chip-padding-x) / -4) 0 0",
    display: "inherit",
    marginLeft: "var(--chip-gap)",
    // set zIndex to 1 with order to stay on top of other controls, eg. Checkbox, Radio
    order: 2,
    zIndex: 1,
    pointerEvents: "none",
  },
  delete: (
    variant: Variant,
    color: Color,
    selectedVariant: SelectedVariationBase | undefined
  ) => {
    const styles: StyleObject = {
      "--icon-margin": "initial", // prevent overrides from parent
      pointerEvents: "visible", // force the ChipDelete to be hoverable because the decorator can have pointerEvents 'none'
      cursor: "pointer",
      width: "var(--chip-delete-size, 2rem)",
      height: "var(--chip-delete-size, 2rem)",
      borderRadius: "var(--chip-delete-radius, 50%)",
      margin: "var(--chip-delete-margin)",
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1, // overflow above sibling button or anchor
      border: "none", // reset user agent stylesheet
      background: "none", // reset user agent stylesheet
      padding: "0px", // reset user agent stylesheet
      "&:focus-visible": model.theme.focus.default,
      ...getVariantStyle(variant, color),
      "&:hover": getVariantStyle(variant, color, "hover"),
      "&:active": getVariantStyle(variant, color, "active"),
    };
    if (selectedVariant) {
      Object.assign(styles, {
        ".selected &": {
          ...getVariantStyle(selectedVariant.variant, selectedVariant.color),
          "&:hover": getVariantStyle(
            selectedVariant.variant,
            selectedVariant.color,
            "hover"
          ),
          "&:active": getVariantStyle(
            selectedVariant.variant,
            selectedVariant.color,
            "active"
          ),
        },
      });
    }
    return styles;
  },
});

export function chip(opts: ChipOpts) {
  const variant = opts.variant ?? "solid";
  const color = opts.color ?? "primary";
  const size = opts.size ?? "md";
  const clickable = opts.clickable ?? false;
  const slot = createSlotsFn(opts);
  const selectedVariant = opts.selected
    ? { variant: opts.selected.variant, color: opts.selected.color }
    : undefined;
  const children: Node[] = [
    slot("label", {
      tag: "span",
      styles: styles.label(clickable),
      children: opts.children,
    }),
  ];
  if (clickable) {
    children.unshift(
      slot("action", {
        tag: "button",
        styles: styles.action(variant, color, selectedVariant),
      })
    );
  }
  if (opts.startDecorator) {
    children.push(
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
    styles: styles.root(variant, color, size, clickable, selectedVariant),
    dynamicClasses: opts.selected
      ? [{ classes: "selected", condition: opts.selected.isSelected }]
      : undefined,
    children,
  });
}

export interface ChipDeleteOpts
  extends ComponentOpts,
    SingleElementComponentOpts {
  selected?: SelectedVariationBase;
}

export const deleteIcon = lazy(() =>
  svgIcon({
    children: element("path", {
      props: {
        d: "'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'",
      },
    }),
  })
);

export function chipDelete(opts: ChipDeleteOpts) {
  const selectedVariant = opts.selected
    ? { variant: opts.selected.variant, color: opts.selected.color }
    : undefined;
  return mergeEls(
    {
      tag: "button",
      styles: styles.delete(
        opts.variant ?? "solid",
        opts.color ?? "primary",
        selectedVariant
      ),
      children: deleteIcon(),
    },
    opts
  );
}
