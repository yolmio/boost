import { app } from "../app";
import { nodes } from "../nodeHelpers";
import { Variant } from "../theme";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { lazy } from "../utils/memoize";
import { StyleObject } from "../styleTypes";
import { svgIcon } from "./svgIcon";
import { Color, ComponentOpts, Size } from "./types";
import { createSlotsFn, SlottedComponentWithSlotNames } from "./utils";
import { DynamicClass } from "../yom";

export interface CheckedVariation {
  variant: Variant;
  color: Color;
}

export interface CheckboxOpts
  extends ComponentOpts,
    SlottedComponentWithSlotNames<"checkbox" | "action" | "input" | "label"> {
  fullWidth?: boolean;
  overlay?: boolean;
  disableIcon?: boolean;

  error?: string;

  checkedVariation?: CheckedVariation;

  checked: string;
  label?: string;
}

const styles = createStyles({
  root: (
    size: Size,
    variant: Variant,
    color: Color,
    overlay: boolean,
    disableIcon: boolean,
    checkedVariation?: CheckedVariation
  ) => {
    const styles: StyleObject = {
      "--icon-font-size": "var(--checkbox-size)",
      ...(size === "sm" && {
        "--checkbox-size": "1rem",
        "--checkbox-gap": "0.375rem",
        fontSize: cssVar(`font-size-sm`),
      }),
      ...(size === "md" && {
        "--checkbox-size": "1.25rem",
        "--checkbox-gap": "0.5rem",
        fontSize: cssVar(`font-size-md`),
      }),
      ...(size === "lg" && {
        "--checkbox-size": "1.5rem",
        "--checkbox-gap": "0.625rem",
        fontSize: cssVar(`font-size-lg`),
      }),
      position: overlay ? "initial" : "relative",
      display: "inline-flex",
      fontFamily: cssVar(`font-family-body`),
      lineHeight: "var(--checkbox-size)", // prevent label from having larger height than the checkbox
      color: disableIcon
        ? (getVariantStyle(variant, color) as any).color
        : cssVar("palette-text-primary"),
    };
    if (checkedVariation && !disableIcon) {
      styles["&.checked"] = {
        color: (
          getVariantStyle(
            checkedVariation.variant,
            checkedVariation.color
          ) as any
        ).color,
      };
      styles["&.error"] = {
        color: (getVariantStyle(checkedVariation.variant, "danger") as any)
          .color,
      };
    }
    return styles;
  },
  label: (disableIcon: boolean) => {
    const styles: StyleObject = {
      flex: 1,
      minWidth: 0,
    };
    if (disableIcon) {
      Object.assign(styles, {
        zIndex: 1, // label should stay on top of the action.
        pointerEvents: "none", // makes hover ineffect.
      });
    } else {
      styles.marginLeft = "var(--checkbox-gap)";
    }
    return styles;
  },
  input: {
    margin: 0,
    opacity: 0,
    position: "absolute",
    width: "100%",
    height: "100%",
    cursor: "pointer",
  },
  action: (
    variant: Variant,
    color: Color,
    overlay: boolean,
    disableIcon: boolean,
    checkedVariation?: CheckedVariation
  ) => {
    const styles: StyleObject = {
      borderRadius: `var(--checkbox-action-radius, ${
        overlay ? "var(--action-radius, inherit)" : "inherit"
      })`,
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      zIndex: 1, // The action element usually cover the area of nearest positioned parent
      "&:has(:focus-visible)": app.ui.theme.focus.default,
    };
    if (disableIcon) {
      Object.assign(styles, {
        ...getVariantStyle(variant, color),
        "&:hover": getVariantStyle(variant, color, "hover"),
        "&:active": getVariantStyle(variant, color, "active"),
      });
      styles[".error &"] = {
        ...getVariantStyle(variant, "danger"),
        "&:hover": getVariantStyle(variant, "danger", "hover"),
        "&:active": getVariantStyle(variant, "danger", "active"),
      };
      if (checkedVariation) {
        styles[".checked &"] = {
          ...getVariantStyle(checkedVariation.variant, checkedVariation.color),
          "&:hover": getVariantStyle(
            checkedVariation.variant,
            checkedVariation.color,
            "hover"
          ),
          "&:active": getVariantStyle(
            checkedVariation.variant,
            checkedVariation.color,
            "active"
          ),
        };
      }
    }
    return styles;
  },
  checkbox: (
    variant: Variant,
    color: Color,
    disableIcon: boolean,
    checkedVariation?: CheckedVariation
  ) => {
    const styles: StyleObject = {
      boxSizing: "border-box",
      borderRadius: cssVar(`radius-xs`),
      width: "var(--checkbox-size)",
      height: "var(--checkbox-size)",
      display: disableIcon ? "contents" : "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    };
    function variation(variant: Variant, color: Color): StyleObject {
      const variationStyles: StyleObject = {
        ...getVariantStyle(variant, color),
        "&:hover": getVariantStyle(variant, color, "hover"),
        "&:active": getVariantStyle(variant, color, "active"),
      };
      if (variant === "outlined" || variant === "plain") {
        (variationStyles as any).backgroundColor = cssVar(
          `palette-background-surface`
        );
      }
      return variationStyles;
    }
    if (!disableIcon) {
      Object.assign(styles, variation(variant, color));
      if (checkedVariation) {
        (styles as any)[".checked &"] = variation(
          checkedVariation.variant,
          checkedVariation.color
        );
      }
      (styles as any)[".error &"] = variation(variant, "danger");
    }
    return styles;
  },
});

const getIcon = lazy(() =>
  svgIcon({
    children: nodes.element("path", {
      props: {
        d: "'M9 16.17 5.53 12.7a.9959.9959 0 0 0-1.41 0c-.39.39-.39 1.02 0 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 7.71c.39-.39.39-1.02 0-1.41a.9959.9959 0 0 0-1.41 0L9 16.17z'",
      },
    }),
  })
);

export function checkbox(opts: CheckboxOpts) {
  const slot = createSlotsFn(opts);
  const size = opts.size ?? "md";
  const variant = opts.variant ?? "solid";
  const color = opts.color ?? "primary";
  const overlay = opts.overlay ?? false;
  const disableIcon = opts.disableIcon ?? false;
  const dynamicClasses: DynamicClass[] = [];
  if (opts.checkedVariation) {
    dynamicClasses.push({ classes: "checked", condition: opts.checked });
  }
  if (opts.error) {
    dynamicClasses.push({ classes: "error", condition: opts.error });
  }
  return slot("root", {
    tag: "span",
    styles: styles.root(
      size,
      variant,
      color,
      overlay,
      disableIcon,
      opts.checkedVariation
    ),
    dynamicClasses,
    children: [
      slot("checkbox", {
        tag: "span",
        styles: styles.checkbox(
          variant,
          color,
          disableIcon,
          opts.checkedVariation
        ),
        children: [
          slot("action", {
            tag: "span",
            styles: styles.action(
              variant,
              color,
              overlay,
              disableIcon,
              opts.checkedVariation
            ),
            children: slot("input", {
              tag: "input",
              props: {
                type: "'checkbox'",
                checked: opts.checked,
              },
              styles: styles.input,
            }),
          }),
          opts.disableIcon ? undefined : nodes.if(opts.checked, getIcon()),
        ],
      }),
      opts.label &&
        nodes.element("label", {
          styles: styles.label(disableIcon),
          children: opts.label,
        }),
    ],
  });
}
