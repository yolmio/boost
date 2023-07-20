import { FormStateFieldHelper } from "../../formState.js";
import { Field } from "../../modelTypes.js";
import { Node } from "../../nodeTypes.js";
import { debugExpr } from "../../procHelpers.js";
import { ClientProcStatement } from "../../yom.js";
import { durationInput } from "../durationInput.js";
import { enumLikeSelect, enumSelect } from "../enumSelect.js";
import { input } from "../input.js";
import { materialIcon } from "../materialIcon.js";
import { getTableRecordSelect } from "../tableRecordSelect.js";
import { textarea } from "../textarea.js";

export interface FieldFormControlOpts {
  field: Field;
  fieldHelper: FormStateFieldHelper;
  id: string;

  /** For combobox */
  comboboxEmptyQuery?: string;

  onChange?: ClientProcStatement[];
}

export function fieldFormControl(opts: FieldFormControlOpts): Node | undefined {
  const { field, id, fieldHelper } = opts;
  switch (field.type) {
    case "ForeignKey":
      return getTableRecordSelect(field.table, {
        onSelectValue: (value) => [
          fieldHelper.setValue(value),
          ...(opts.onChange ?? []),
        ],
        id,
        value: fieldHelper.value,
        emptyQuery: opts.comboboxEmptyQuery,
        error: fieldHelper.hasError,
      });
    case "Tx":
      return input({
        error: opts.fieldHelper.hasError,
        slots: {
          input: {
            props: {
              type: "'number'",
              value: fieldHelper.value,
              id,
            },
            on: {
              input: [fieldHelper.setValue("target_value")],
              blur: [fieldHelper.setTouched],
            },
          },
        },
      });
    case "Timestamp":
      return input({
        error: opts.fieldHelper.error,
        slots: {
          input: {
            props: {
              type: "'datetime-local'",
              value: `case when ${fieldHelper.value} is not null then format.date(${fieldHelper.value}, '%Y-%m-%dT%H:%M') else '' end`,
              id,
            },
            on: {
              input: [
                fieldHelper.setValue("try_cast(target_value as timestamp)"),
              ],
              blur: [fieldHelper.setTouched],
            },
          },
        },
      });
    case "Date":
      return input({
        error: opts.fieldHelper.error,
        slots: {
          input: {
            props: {
              type: "'date'",
              value: fieldHelper.value,
              id,
            },
            on: {
              input: [fieldHelper.setValue("try_cast(target_value as date)")],
              blur: [fieldHelper.setTouched],
            },
          },
        },
      });
    case "TinyUint":
    case "SmallUint":
    case "Uint":
    case "BigUint":
    case "TinyInt":
    case "SmallInt":
    case "Int":
    case "BigInt":
    case "Decimal": {
      let startDecorator;
      if ("usage" in field && field.usage) {
        if (field.usage.type === "Money") {
          startDecorator = materialIcon("AttachMoney");
        }
        if (field.usage.type === "Duration") {
          return durationInput({
            error: opts.fieldHelper.hasError,
            slots: {
              input: {
                props: {
                  id,
                  value: fieldHelper.value,
                },
                on: {
                  blur: [fieldHelper.setTouched],
                },
              },
            },
            durationSize: field.usage.size,
            onChange: (v) => [
              fieldHelper.setValue(v),
              fieldHelper.setTouched,
              ...(opts.onChange ?? []),
            ],
          });
        }
      }
      return input({
        error: opts.fieldHelper.hasError,
        startDecorator,
        slots: {
          input: {
            props: {
              type: "'number'",
              value: fieldHelper.value,
              id,
            },
            on: {
              input: [fieldHelper.setValue("target_value")],
              blur: [fieldHelper.setTouched],
            },
          },
        },
      });
    }

    case "Enum":
      return enumSelect({
        enum: field.enum,
        emptyOption: field.notNull ? undefined : "'No value'",
        slots: { select: { props: { id, value: fieldHelper.value } } },
        on: {
          input: [
            fieldHelper.setValue(
              `try_cast(target_value as enums.${field.enum})`
            ),
          ],
        },
      });
    case "Uuid":
      return input({
        error: opts.fieldHelper.hasError,
        slots: {
          input: {
            props: {
              value: fieldHelper.value,
              id,
              maxLength: "36",
            },
            on: {
              input: [fieldHelper.setValue("target_value")],
              blur: [fieldHelper.setTouched],
            },
          },
        },
      });
    case "String":
      if (field.multiline) {
        return textarea({
          slots: {
            textarea: {
              props: {
                value: fieldHelper.value,
                id,
              },
              on: {
                input: [fieldHelper.setValue("target_value")],
                blur: [fieldHelper.setTouched],
              },
            },
          },
        });
      } else {
        let inputMode: string | undefined;
        let startDecorator: Node | undefined;
        switch (field.usage?.type) {
          case "Email":
            inputMode = "'email'";
            startDecorator = materialIcon("Mail");
            break;
          case "PhoneNumber":
            inputMode = "'tel'";
            startDecorator = materialIcon("Phone");
            break;
        }
        return input({
          error: opts.fieldHelper.hasError,
          startDecorator,
          slots: {
            input: {
              props: {
                value: fieldHelper.value,
                id,
                maxLength: field.maxLength.toString(),
                inputMode,
              },
              on: {
                input: [fieldHelper.setValue("target_value")],
                blur: [fieldHelper.setTouched],
              },
            },
          },
        });
      }
    case "Bool":
      const enumLike = field.enumLike;
      if (!enumLike) {
        return;
      }
      return enumLikeSelect({
        enumLike,
        notNull: field.notNull ?? false,
        slots: {
          select: {
            props: {
              value: `coalesce(cast(${fieldHelper.value} as string), '')`,
            },
          },
        },
        on: {
          input: [
            fieldHelper.setValue(
              `case when target_value = '' then null else target_value = 'true' end`
            ),
          ],
        },
      });
  }
}
