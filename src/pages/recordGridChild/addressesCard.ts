import { AddressFieldGroup } from "../../modelTypes.js";
import { element, state } from "../../nodeHelpers.js";
import { record } from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";
import { ident } from "../../utils/sqlHelpers.js";
import { displayAddressText } from "./displayAddressText.js";
import { divider } from "../../components/divider.js";
import { materialIcon } from "../../components/materialIcon.js";
import { typography } from "../../components/typography.js";
import { RecordGridContext } from "./shared.js";
import { card } from "../../components/card.js";
import { Style } from "../../styleTypes.js";

export const name = "addressesCard";

export interface Opts {
  styles?: Style;
  header?: string;
  groups: { name: string; header: string }[];
}

const styles = createStyles({
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    pb: 1.5,
  },
  divider: {
    mb: 0.5,
  },
  groupHeader: {
    my: 1,
    fontSize: "lg",
    fontWeight: "md",
  },
});

export function content(opts: Opts, ctx: RecordGridContext) {
  const groups: { header: string; fieldGroup: AddressFieldGroup }[] = [];
  let allSelectFields = "";
  for (const group of opts.groups) {
    const fieldGroup = ctx.table.fieldGroups[group.name];
    if (fieldGroup.type !== "Address") {
      throw new Error("addressesCard expects groups of type address");
    }
    if (allSelectFields) {
      allSelectFields += ", ";
    }
    allSelectFields += Object.values(fieldGroup.fields)
      .filter(Boolean)
      .map((f) => `${ident(f)} as ${f}`)
      .join(", ");
    groups.push({ header: group.header, fieldGroup });
  }
  return card({
    variant: "outlined",
    styles: opts.styles,
    children: [
      element("div", {
        styles: styles.header,
        children: [
          typography({
            level: "h6",
            tag: "h5",
            startDecorator: materialIcon("Business"),
            children: opts.header ?? `'Addresses'`,
          }),
        ],
      }),
      divider({ styles: styles.divider }),
      state({
        watch: [ctx.refreshKey],
        procedure: [
          record(
            "record",
            `select ${allSelectFields} from db.${ident(
              ctx.table.name
            )} where id = ${ctx.recordId}`
          ),
        ],
        children: groups.map(({ header, fieldGroup }) => [
          element("h6", {
            styles: styles.groupHeader,
            children: header,
          }),
          displayAddressText(fieldGroup, "record"),
        ]),
      }),
    ],
  });
}
