import { AddressFieldGroup } from "../modelTypes.js";
import { element, ifNode, state } from "../nodeHelpers.js";
import { record, scalar } from "../procHelpers.js";
import { model } from "../singleton.js";
import { createStyles } from "../styleUtils.js";
import { ident } from "../utils/sqlHelpers.js";
import { divider } from "./divider.js";
import { materialIcon } from "./materialIcon.js";
import { typography } from "./typography.js";

export function displayAddressText(
  group: AddressFieldGroup,
  recordName: string
) {
  return ifNode(
    Object.values(group.fields)
      .filter(Boolean)
      .map((field) => `${recordName}.${ident(field)} is null`)
      .join(" and "),
    typography({
      level: "body1",
      styles: styles.addressLine,
      children: `'No address'`,
    }),
    [
      group.fields.name
        ? typography({
            level: "body1",
            styles: styles.addressName,
            children: `record.${ident(group.fields.name)}`,
          })
        : undefined,
      typography({
        level: "body1",
        styles: styles.addressLine,
        children: `record.${ident(group.fields.street1)}`,
      }),
      group.fields.street2
        ? typography({
            level: "body1",
            styles: styles.addressLine,
            children: `record.${ident(group.fields.street2)}`,
          })
        : undefined,
      typography({
        level: "body1",
        styles: styles.addressLine,
        children: `record.${ident(
          group.fields.city!
        )} || ', ' || coalesce(record.${ident(
          group.fields.region!
        )} || ' ', '') || record.${ident(
          group.fields.country!
        )} || ' ' ||  record.${ident(group.fields.zip!)}`,
      }),
    ]
  );
}

export interface AddressCardOpts {
  table: string;
  recordId: string;
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
  addressName: {
    fontWeight: "lg",
  },
  addressLine: {
    color: "text-secondary",
  },
});

export function addressCard(opts: AddressCardOpts) {
  const tableModel = model.database.tables[opts.table];
  const fieldGroup = tableModel.fieldGroups[opts.group ?? "address"];
  if (fieldGroup.type !== "Address") {
    throw new Error("addressCard expects a field group of type address");
  }
  const selectFields = Object.values(fieldGroup.fields)
    .filter(Boolean)
    .map((f) => `${ident(f)} as ${f}`)
    .join(", ");
  return [
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
      procedure: [
        record(
          "record",
          `select ${selectFields} from db.${ident(opts.table)} where id = ${
            opts.recordId
          }`
        ),
      ],
      children: displayAddressText(fieldGroup, "record"),
    }),
  ];
}
