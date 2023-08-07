import type { Node } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { Variant } from "../theme";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { Color, ComponentOpts, Size } from "./types";
import { createSlotsFn, SlottedComponentWithSlotNames } from "./utils";

export interface TextareaOpts
  extends ComponentOpts,
    SlottedComponentWithSlotNames<
      "startDecorator" | "textarea" | "endDecorator"
    > {
  startDecorator?: Node;
  endDecorator?: Node;
}

const styles = createStyles({
  root: (size: Size, variant: Variant, color: Color) => {
    const variantStyle = getVariantStyle(variant, color);
    const styles: StyleObject = {
      "--textarea-radius": cssVar(`radius-sm`),
      "--textarea-gap": "0.5rem",
      "--textarea-placeholder-color": "inherit",
      "--textarea-placeholder-oacity": "0.5",
      "--textarea-focused-thickness": cssVar(`focus-thickness`),
      ...(color === "harmonize"
        ? {
            "--textarea-focused-highlight": cssVar(`palette-focus-visible`),
          }
        : {
            "--textarea-focused-highlight": cssVar(
              color === "neutral"
                ? "palette-primary-500"
                : `palette-${color}-500`
            ),
          }),
      // variables for controlling child components
      "--_textarea-padding-y":
        "max((var(--textarea-min-height) - 2 * var(--variant-border-width, 0px) - var(--textarea-decorator-child-height)) / 2, 0px)",
      "--textarea-decorator-child-radius":
        "max(var(--textarea-radius) - var(--variant-border-width, 0px) - var(--_textarea-padding-y), min(var(--_textarea-padding-y) + var(--variant-border-width, 0px), var(--textarea-radius) / 2))",
      "--button-min-height": "var(--textarea-decorator-child-height)",
      "--icon-button-size": "var(--textarea-decorator-child-height)",
      "--button-radius": "var(--textarea-decorator-child-radius)",
      "--icon-button-radius": "var(--textarea-decorator-child-radius)",
      boxSizing: "border-box",
      minWidth: 0,
      minHeight: "var(--textarea-min-height)",
      cursor: "text",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      paddingLeft: `var(--textarea-padding-x)`, // the paddingInlineEnd is added to the textarea. It looks better when the scrollbar appears.
      paddingY: "var(--textarea-padding-y)",
      borderRadius: "var(--textarea-radius)",
      fontFamily: cssVar(`font-family-body`),
      fontSize: cssVar(`font-size-md`),
      lineHeight: cssVar(`line-height-md`),
      // TODO: discuss the transition approach in a separate PR. This value is copied from mui-material Button.
      transition:
        "border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
      "&:before": {
        boxSizing: "border-box",
        content: '""',
        display: "block",
        position: "absolute",
        pointerEvents: "none",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
        borderRadius: "inherit",
        margin: "calc(var(--variant-border-width, 0px) * -1)", // for outlined variant
      },
      // variant styles
      ...variantStyle,
      backgroundColor:
        variant === "plain" || variant === "outlined"
          ? cssVar(`palette-background-surface`)
          : (variantStyle as any).backgroundColor,
      [`&:hover:not(&:has(input:focus))`]: {
        ...getVariantStyle(variant, color),
        backgroundColor: null, // it is not common to change background on hover for Input
        cursor: "text",
      },
      // [`&.${textareaClasses.disabled}`]: theme
      //   .variants[`${ownerState.variant!}Disabled`]?.[ownerState.color!],
      [`&:has(textarea:focus)`]: {
        "&:before": {
          boxShadow: `inset 0 0 0 var(--textarea-focused-thickness) var(--textarea-focused-highlight)`,
        },
      },
    };
    switch (size) {
      case "sm":
        Object.assign(styles, {
          "--textarea-min-height": "2rem",
          "--textarea-padding-y":
            "calc(0.5rem - var(--variant-border-width, 0px))", // to match Input because <textarea> does not center the text at the middle like <input>
          "--textarea-padding-x": "0.5rem",
          "--textarea-decorator-child-height":
            "min(1.5rem, var(--textarea-min-height))",
          "--icon-font-size": "1.25rem",
          fontSize: cssVar(`font-size-sm`),
          lineHeight: cssVar(`line-height-sm`),
        });
        break;
      case "md":
        Object.assign(styles, {
          "--textarea-min-height": "2.5rem",
          "--textarea-padding-y":
            "calc(0.5rem - var(--variant-border-width, 0px))",
          "--textarea-padding-x": "0.75rem",
          "--textarea-decorator-child-height":
            "min(2rem, var(--textarea-min-height))",
          "--icon-font-size": "1.5rem",
        });
        break;
      case "lg":
        Object.assign(styles, {
          "--textarea-min-height": "3rem",
          "--textarea-padding-y":
            "calc(0.75rem - var(--variant-border-width, 0px))",
          "--textarea-padding-x": "1rem",
          "--textarea-gap": "0.75rem",
          "--textarea-decorator-child-height":
            "min(2.375rem, var(--textarea-min-height))",
          "--icon-font-size": "1.75rem",
        });
        break;
    }
    return styles;
  },
  textarea: {
    //   resize: "none",
    border: "none", // remove the native textarea width
    minWidth: 0, // remove the native textarea width
    outline: 0, // remove the native textarea outline
    padding: 0, // remove the native textarea padding
    paddingRight: `var(--textarea-padding-x)`,
    flex: "auto",
    alignSelf: "stretch",
    color: "inherit",
    backgroundColor: "transparent",
    fontFamily: "inherit",
    fontSize: "inherit",
    fontStyle: "inherit",
    fontWeight: "inherit",
    lineHeight: "inherit",
    "&:-webkit-autofill": {
      WebkitBackgroundClip: "text", // remove autofill background
      WebkitTextFillColor: "currentColor",
    },
    "&::-webkit-input-placeholder": {
      color: "var(--textarea-placeholder-color)",
      opacity: "var(--textarea-placeholder-oacity)",
    },
    "&::-moz-placeholder": {
      // Firefox 19+
      color: "var(--textarea-placeholder-color)",
      opacity: "var(--textarea-placeholder-oacity)",
    },
    "&:-ms-input-placeholder": {
      // IE11
      color: "var(--textarea-placeholder-color)",
      opacity: "var(--textarea-placeholder-oacity)",
    },
    "&::-ms-input-placeholder": {
      // Edge
      color: "var(--textarea-placeholder-color)",
      opacity: "var(--textarea-placeholder-oacity)",
    },
  },
  startDecorator: {
    display: "flex",
    marginLeft: "calc(var(--textarea-padding-y) - var(--textarea-padding-x))",
    marginRight: "var(--textarea-padding-y)",
    marginBottom: "var(--textarea-gap)",
    color: cssVar(`palette-text-tertiary`),
    cursor: "initial",
  },
  endDecorator: {
    display: "flex",
    marginLeft: "calc(var(--textarea-padding-y) - var(--textarea-padding-x))",
    marginRight: "var(--textarea-padding-y)",
    marginTop: "var(--textarea-gap)",
    color: cssVar(`palette-text-tertiary`),
    cursor: "initial",
  },
});

export function textarea(opts: TextareaOpts) {
  const slot = createSlotsFn(opts);
  const rootStyles = styles.root(
    opts.size ?? "md",
    opts.variant ?? "outlined",
    opts.color ?? "neutral"
  );
  return slot("root", {
    tag: "div",
    styles: rootStyles,
    children: [
      opts.startDecorator &&
        slot("startDecorator", {
          tag: "div",
          styles: styles.startDecorator,
          children: opts.startDecorator,
        }),
      slot("textarea", {
        tag: "textarea",
        styles: styles.textarea,
      }),
      opts.endDecorator &&
        slot("endDecorator", {
          tag: "div",
          styles: styles.endDecorator,
          children: opts.endDecorator,
        }),
    ],
  });
}
