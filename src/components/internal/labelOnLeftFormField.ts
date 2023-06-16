import { element } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { createStyles } from "../../styleUtils.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { checkbox } from "../checkbox.js";
import { fieldFormControl, FieldFormControlOpts } from "./fieldFormControl.js";

export interface LabelOnLeftFormFieldOpts extends FieldFormControlOpts {
  label?: string;
}

const styles = createStyles({
  cardFieldWrapper: {
    display: "flex",
    alignItems: "flex-end",
  },
  cardFieldLabel: {
    mb: 1,
    mr: 1.5,
    fontWeight: "lg",
    fontSize: "md",
    color: "text-secondary",
    width: "35%",
    flexShrink: 0,
  },
});

export function labelOnLeftFormField(opts: LabelOnLeftFormFieldOpts): Node {
  if (opts.field.type === "Bool" && !opts.field.enumLike) {
    return element("div", {
      styles: styles.cardFieldWrapper,
      children: [
        element("label", {
          styles: styles.cardFieldLabel,
          props: { htmlFor: opts.id },
          children: opts.label ?? stringLiteral(opts.field.name.displayName),
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
    styles: styles.cardFieldWrapper,
    children: [
      element("label", {
        styles: styles.cardFieldLabel,
        props: { htmlFor: opts.id },
        children: opts.label ?? stringLiteral(opts.field.name.displayName),
      }),
      control,
    ],
  });
}
