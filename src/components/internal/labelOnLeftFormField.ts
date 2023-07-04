import { element } from "../../nodeHelpers.js";
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
      control,
    ],
  });
}
