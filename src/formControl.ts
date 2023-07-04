import { checkbox } from "./components/checkbox.js";
import { enumSelect } from "./components/enumSelect.js";
import { input } from "./components/input.js";
import { getTableRecordSelect } from "./components/tableRecordSelect.js";
import { textarea } from "./components/textarea.js";
import { ComponentOpts } from "./components/types.js";
import { getUniqueUiId } from "./components/utils.js";
import { Field } from "./modelTypes.js";
import { if_, preventDefault } from "./procHelpers.js";
import { stringLiteral } from "./utils/sqlHelpers.js";
import { BaseStatement } from "./yom.js";

export interface BaseFormControlOpts extends ComponentOpts {
  id: string;
  setValue: (value: string) => BaseStatement;
  value: string;
  errorState?: {
    error: string;
    setError: (error: string) => BaseStatement;
  };
  touchedState?: {
    touched: string;
    setTouched: BaseStatement;
  };
}

interface FormControlOpts {
  setValue: (value: string) => BaseStatement;
  value: string;
  error: string;
  setError: (error: string) => BaseStatement;
  touched: string;
  setTouched: BaseStatement;
}

export function getFormControl(field: Field, opts: FormControlOpts) {
  switch (field.type) {
    case "ForeignKey":
      return getTableRecordSelect(field.table, {
        onSelectValue: (value) => [opts.setValue(value)],
        id: stringLiteral(getUniqueUiId()),
        value: opts.value,
      });
    case "Date":
      return input({
        slots: {
          input: {
            props: { type: "'date'", value: opts.value },
            on: {
              input: [opts.setValue("try_cast(target_value as date)")],
              blur: [opts.setTouched],
            },
          },
        },
      });
    case "Enum":
      return enumSelect({
        enum: field.enum,
        slots: { select: { props: { value: opts.value } } },
        on: {
          input: [
            opts.setValue(`try_cast(target_value as enums.${field.enum})`),
          ],
        },
      });
    case "Duration":
      return input({
        slots: {
          input: {
            props: {
              inputMode: `'numeric'`,
              value: opts.value,
            },
            on: {
              keydown: [
                if_(
                  `not event.ctrl_key and not event.meta_key and char_length(event.key) = 1 and event.key not in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ':')`,
                  [preventDefault()]
                ),
              ],
              input: [opts.setValue(`target_value`)],
              change: [
                opts.setValue(
                  `sfn.display_minutes_duration(sfn.parse_minutes_duration(${opts.value}))`
                ),
              ],
              blur: [opts.setTouched],
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
                value: opts.value,
              },
              on: {
                input: [opts.setValue("target_value")],
                blur: [opts.setTouched],
              },
            },
          },
        });
      } else {
        return `'not implemented'`;
      }
    case "Bool":
      return checkbox({
        variant: "outlined",
        checked: opts.value,
        on: { checkboxChange: [opts.setValue(`not ${opts.value}`)] },
        label: stringLiteral(field.displayName),
      });
    default:
      // throw new Error(
      //   "Haven't implemented form control for field of type: " + field.type,
      // );
      return `'not implemented'`;
  }
}
