import { AddressFieldGroup } from "../modelTypes.js";
import { element, state } from "../nodeHelpers.js";
import { record } from "../procHelpers.js";
import { model } from "../singleton.js";
import { createStyles } from "../styleUtils.js";
import { ident } from "../utils/sqlHelpers.js";
import { displayAddressText } from "./addressCard.js";
import { divider } from "./divider.js";
import { materialIcon } from "./materialIcon.js";
import { typography } from "./typography.js";

export interface AddressesCardOpts {
  table: string;
  recordId: string;
  header?: string;
  groups: { name: string; header: string }[];
  refreshKey: string;
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

export function addressesCard(opts: AddressesCardOpts) {
  const tableModel = model.database.tables[opts.table];
  const groups: { header: string; fieldGroup: AddressFieldGroup }[] = [];
  let allSelectFields = "";
  for (const group of opts.groups) {
    const fieldGroup = tableModel.fieldGroups[group.name];
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
  return [
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
      watch: [opts.refreshKey],
      procedure: [
        record(
          "record",
          `select ${allSelectFields} from db.${ident(opts.table)} where id = ${
            opts.recordId
          }`
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
  ];
}
