import { DomStatementsOrFn } from "../statements";
import * as yom from "../yom";
import { input, InputOpts } from "./input";
import { mergeElEventHandlers } from "./utils";

export interface DurationInputOpts extends InputOpts {
  fullWidth?: boolean;

  durationSize: "seconds" | "minutes" | "hours";
  onChange: (value: yom.SqlExpression) => DomStatementsOrFn;
}

// todo this doesn't work well with cmd+enter on forms, fix it
export function durationInput(opts: DurationInputOpts) {
  return input({
    ...opts,
    slots: {
      ...opts.slots,
      input: {
        ...opts.slots?.input,
        props: {
          inputMode: `'numeric'`,
          placeholder: "'hh:mm'",
          ...opts.slots?.input?.props,
        },
        on: mergeElEventHandlers(
          {
            keydown: (s) =>
              s.if(
                `not event.ctrl_key and not event.meta_key and char_length(event.key) = 1 and event.key not in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ':')`,
                (s) => s.preventDefault(),
              ),
            change: opts.onChange(
              `fn.display_minutes_duration(fn.parse_minutes_duration(target_value))`,
            ),
          },
          opts.slots?.input?.on ?? {},
        ),
      },
    },
  });
}
