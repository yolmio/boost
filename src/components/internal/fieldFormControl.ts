import { FormStateFieldHelper } from "../../formState.js";
import { Field } from "../../modelTypes.js";
import { Node } from "../../nodeTypes.js";
import { ClientProcStatement } from "../../yom.js";
import { durationInput } from "../durationInput.js";
import { enumLikeSelect, enumSelect } from "../enumSelect.js";
import { input } from "../input.js";
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
    case "Decimal":
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

    case "Enum":
      return enumSelect({
        enum: field.enum,
        slots: { select: { props: { id, value: fieldHelper.value } } },
        on: {
          input: [
            fieldHelper.setValue(
              `try_cast(target_value as enums.${field.enum})`
            ),
          ],
        },
      });
    case "Duration":
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
        durationSize: field.size,
        onChange: (v) => [
          fieldHelper.setValue(v),
          fieldHelper.setTouched,
          ...(opts.onChange ?? []),
        ],
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
        return input({
          error: opts.fieldHelper.hasError,
          slots: {
            input: {
              props: {
                value: fieldHelper.value,
                id,
                maxLength: field.maxLength.toString(),
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
