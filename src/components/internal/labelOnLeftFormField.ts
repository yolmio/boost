import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles, cssVar } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { checkbox } from "../checkbox";
import { formLabel } from "../formLabel";
import { fieldFormControl, FieldFormControlOpts } from "./fieldFormControl";

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
    return nodes.element("div", {
      styles: styles.root,
      children: [
        formLabel({
          props: { htmlFor: opts.id },
          children: opts.label ?? stringLiteral(opts.field.displayName),
        }),
        nodes.element("div", {
          styles: styles.controlWrapper,
          children: [
            checkbox({
              variant: "outlined",
              checked: opts.fieldHelper.value,
              slots: { input: { props: { id: opts.id } } },
              on: {
                checkboxChange: opts.fieldHelper.setValue(
                  `coalesce(not ` + opts.fieldHelper.value + `, true)`
                ),
              },
            }),
            nodes.if(
              opts.fieldHelper.hasError,
              nodes.element("div", {
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
  return nodes.element("div", {
    styles: styles.root,
    children: [
      formLabel({
        props: { htmlFor: opts.id },
        children: opts.label ?? stringLiteral(opts.field.displayName),
      }),
      nodes.element("div", {
        styles: styles.controlWrapper,
        children: [
          control,
          nodes.if(
            opts.fieldHelper.hasError,
            nodes.element("div", {
              styles: styles.errorText,
              children: opts.fieldHelper.error,
            })
          ),
        ],
      }),
    ],
  });
}
