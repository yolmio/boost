import type { ElementNode, Node } from "../nodeTypes.js";
import { StyleObject } from "../styleTypes.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { Color, Size } from "./types.js";
import { mergeEls, SingleElementComponentOpts } from "./utils.js";

type Orientation = "horizontal" | "vertical";

export interface FormControlOpts extends SingleElementComponentOpts {
  size?: Size;
  color?: Color;
  orientation?: Orientation;

  error?: string;

  children: Node;
}

const styles = createStyles({
  root: (size: Size, orientation: Orientation, color?: Color) => {
    const styles: StyleObject = {
      "--form-label-align-self":
        orientation === "horizontal" ? "align-items" : "flex-start",
      "--form-helper-text-margin-top": "0.375rem",
      "--form-label-asterisk-color": cssVar(`palette-danger-500`),
      //   [`&.${formControlClasses.error}`]: {
      //   },
      //   [`&.${formControlClasses.disabled}`]: {
      //     "--form-label-color": theme.vars.palette[ownerState.color || "neutral"]
      //       ?.plainDisabledColor,
      //     "--form-helper-text-color": theme.vars
      //       .palette[ownerState.color || "neutral"]?.plainDisabledColor,
      //   },
      display: "flex",
      position: "relative", // for keeping the control action area, e.g. Switch
      flexDirection: orientation === "horizontal" ? "row" : "column",
    };
    if (color && color !== "harmonize") {
      styles["--form-helper-text-color"] = cssVar(`palette-${color}-500`);
    }
    switch (size) {
      case "sm":
        Object.assign(styles, {
          "--form-label-font-size": cssVar(`font-size-xs`),
          "--form-helper-text-font-size": cssVar(`font-size-xs`),
          "--form-label-margin-bottom":
            orientation === "horizontal" ? "0" : "0.25rem",
          "--form-label-margin-right":
            orientation === "horizontal" ? "0.5rem" : "0",
        });
        break;
      case "md":
        Object.assign(styles, {
          "--form-label-font-size": cssVar(`font-size-sm`),
          "--form-helper-text-font-size": cssVar(`font-size-sm`),
          "--form-label-margin-bottom":
            orientation === "horizontal" ? "0" : "0.25rem",
          "--form-label-margin-right":
            orientation === "horizontal" ? "0.75rem" : "0",
        });
        break;
      case "lg":
        Object.assign(styles, {
          "--form-label-font-size": cssVar(`font-size-md`),
          "--form-helper-text-font-size": cssVar(`font-size-sm`),
          "--form-label-margin-bottom":
            orientation === "horizontal" ? "0" : "0.25rem",
          "--form-label-margin-right":
            orientation === "horizontal" ? "1rem" : "0",
        });
        break;
    }
    styles["&.error"] = {
      "--form-helper-text-color": cssVar(`palette-danger-500`),
    };
    return styles;
  },
});

export function formControl(opts: FormControlOpts): ElementNode {
  const rootStyles = styles.root(
    opts.size ?? "md",
    opts.orientation ?? "vertical",
    opts.color
  );
  return mergeEls(
    {
      tag: "div",
      styles: rootStyles,
      dynamicClasses: opts.error
        ? [{ condition: opts.error, classes: "error" }]
        : undefined,
      children: opts.children,
    },
    opts
  );
}
