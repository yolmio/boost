import { element, state } from "../../nodeHelpers.js";
import { record } from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { createStyles } from "../../styleUtils.js";
import { ident } from "../../utils/sqlHelpers.js";
import { divider } from "../../components/divider.js";
import { materialIcon } from "../../components/materialIcon.js";
import { typography } from "../../components/typography.js";
import { displayAddressText } from "./displayAddressText.js";
import { card } from "../../components/card.js";
import { Style } from "../../styleTypes.js";
import { RecordGridContext } from "./shared.js";

export const name = "addressCard";

export interface Opts {
  styles?: Style;
  header?: string;
  group?: string;
}

const styles = createStyles({
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    pb: 1.5,
  },
  divider: {
    mb: 1.5,
  },
});

export function content(opts: Opts, ctx: RecordGridContext) {
  const fieldGroup = ctx.table.fieldGroups[opts.group ?? "address"];
  if (fieldGroup.type !== "Address") {
    throw new Error("addressCard expects a field group of type address");
  }
  const selectFields = Object.values(fieldGroup.fields)
    .filter(Boolean)
    .map((f) => `${ident(f)} as ${f}`)
    .join(", ");
  return card({
    variant: "outlined",
    styles: opts.styles,
    children: [
      element("div", {
        styles: styles.header,
        children: [
          typography({
            level: "h6",
            startDecorator: materialIcon("Business"),
            children: opts.header ?? `'Address'`,
          }),
        ],
      }),
      divider({ styles: styles.divider }),
      state({
        watch: [ctx.refreshKey],
        procedure: [
          record(
            "record",
            `select ${selectFields} from db.${ident(
              ctx.table.name
            )} where id = ${ctx.recordId}`
          ),
        ],
        children: displayAddressText(fieldGroup, "record"),
      }),
    ],
  });
}
