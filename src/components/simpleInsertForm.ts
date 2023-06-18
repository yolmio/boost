import {
  FormState,
  InsertFormField,
  withInsertFormState,
} from "../formState.js";
import { element, ifNode } from "../nodeHelpers.js";
import { model } from "../singleton.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { ClientProcStatement, ServiceProcStatement } from "../yom.js";
import { alert } from "./alert.js";
import { button } from "./button.js";
import { checkbox } from "./checkbox.js";
import { formControl } from "./formControl.js";
import { formLabel } from "./formLabel.js";
import { materialIcon } from "./materialIcon.js";
import { typography } from "./typography.js";
import { fieldFormControl } from "./internal/fieldFormControl.js";
import { getUniqueUiId } from "./utils.js";
import { Style } from "../styleTypes.js";

export interface InsertFormPart {
  styles?: Style;
  field?: string;
  initialValue?: string;
  comboboxInitialInputText?: string;
}

export interface InsertFormOpts {
  table: string;
  parts: InsertFormPart[];
  withValues?: Record<string, string>;
  afterSubmitService?: (state: FormState) => ServiceProcStatement[];
  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
}

export function simpleInsertForm(opts: InsertFormOpts) {
  const tableModel = model.database.tables[opts.table];
  const insertFormFields: InsertFormField[] = [];
  for (const part of opts.parts) {
    if (!part.field) {
      continue;
    }
    insertFormFields.push({
      field: part.field,
      initialValue: part.initialValue,
    });
  }
  return withInsertFormState({
    table: opts.table,
    fields: insertFormFields,
    withValues: opts.withValues,
    afterSubmitService: opts.afterSubmitService,
    afterSubmitClient: opts.afterSubmitClient,
    children: ({ formState, onSubmit }) =>
      element("form", {
        on: { submit: onSubmit },
        children: [
          element("div", {
            styles: {
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gap: 2,
              mb: 1.5,
            },
            children: opts.parts.map((p) => {
              if (!p.field) {
                return element("div", { styles: p.styles });
              }
              const field = tableModel.fields[p.field];

              const id = stringLiteral(getUniqueUiId());
              if (field.type === "Bool" && !field.enumLike) {
                return element("div", {
                  styles: p.styles,
                  children: checkbox({
                    label: stringLiteral(field.name.displayName),
                    variant: "outlined",
                    checked: formState.fields.get(p.field),
                    on: {
                      checkboxChange: [
                        formState.fields.set(
                          p.field,
                          `coalesce(not ` +
                            formState.fields.get(p.field) +
                            `, true)`
                        ),
                      ],
                    },
                  }),
                });
              }
              const control = fieldFormControl({
                field,
                id,
                fieldHelper: formState.fieldHelper(p.field),
                // comboboxInitialInputText: p.comboboxInitialInputText,
              });
              if (!control) {
                throw new Error(
                  "Edit dialog does not support field of type " + field.type
                );
              }
              return formControl({
                styles: p.styles,
                children: [
                  formLabel({
                    props: { htmlFor: id },
                    children: stringLiteral(field.name.displayName),
                  }),
                  control,
                ],
              });
            }),
          }),
          ifNode(
            formState.getFormError + " is not null",
            alert({
              styles: { alignItems: "flex-start", mb: 1.5 },
              variant: "soft",
              color: "danger",
              startDecorator: materialIcon("Warning"),
              children: typography({
                color: "danger",
                children: `'an error'`,
              }),
            })
          ),
          element("div", {
            styles: {
              display: "flex",
              gap: 1,
              justifyContent: "flex-end",
            },
            children: button({
              variant: "solid",
              color: "primary",
              children: `'Add ${tableModel.name.displayName}'`,
            }),
          }),
        ],
      }),
  });
}
