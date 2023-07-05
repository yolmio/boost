import { element, ifNode } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { createStyles, cssVar } from "../../styleUtils.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { checkbox } from "../checkbox.js";
import { formLabel } from "../formLabel.js";
import { fieldFormControl, FieldFormControlOpts } from "./fieldFormControl.js";

export interface LabelOnLeftFormFieldOpts extends FieldFormControlOpts {
  label?: string;
}

const styles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    "--form-label-font-size": cssVar(`font-size-sm`),
    "--form-label-margin-bottom": "0.25rem",
    sm: {
      "--form-label-margin-bottom": "0",
      "--form-label-font-size": cssVar(`font-size-md`),
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
      gap: 1,
    },
  },
  controlWrapper: {
    display: "flex",
    flexDirection: "column",
  },
  errorText: {
    display: "flex",
    alignItems: "center",
    fontSize: "sm",
    lineHeight: "sm",
    color: "danger-500",
    marginTop: 0.375,
  },
});

export function labelOnLeftFormField(opts: LabelOnLeftFormFieldOpts): Node {
  if (opts.field.type === "Bool" && !opts.field.enumLike) {
    return element("div", {
      styles: styles.root,
      children: [
        formLabel({
          props: { htmlFor: opts.id },
          children: opts.label ?? stringLiteral(opts.field.displayName),
        }),
        element("div", {
          styles: styles.controlWrapper,
          children: [
            checkbox({
              variant: "outlined",
              checked: opts.fieldHelper.value,
              slots: { input: { props: { id: opts.id } } },
              on: {
                checkboxChange: [
                  opts.fieldHelper.setValue(
                    `coalesce(not ` + opts.fieldHelper.value + `, true)`
                  ),
                ],
              },
            }),
            ifNode(
              opts.fieldHelper.hasError,
              element("div", {
                styles: styles.errorText,
                children: opts.fieldHelper.error,
              })
            ),
          ],
        }),
      ],
    });
  }
  const control = fieldFormControl(opts);
  if (!control) {
    throw new Error(
      "labelOnLeftFormField does not handle field of type " +
        opts.field.type +
        "for card fields"
    );
  }
  return element("div", {
    styles: styles.root,
    children: [
      formLabel({
        props: { htmlFor: opts.id },
        children: opts.label ?? stringLiteral(opts.field.displayName),
      }),
      element("div", {
        styles: styles.controlWrapper,
        children: [
          control,
          ifNode(
            opts.fieldHelper.hasError,
            element("div", {
              styles: styles.errorText,
              children: opts.fieldHelper.error,
            })
          ),
        ],
      }),
    ],
  });
}
