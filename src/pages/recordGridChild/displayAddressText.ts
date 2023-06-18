import { typography } from "../../components/typography.js";
import { AddressFieldGroup } from "../../modelTypes.js";
import { ifNode } from "../../nodeHelpers.js";
import { createStyles } from "../../styleUtils.js";
import { ident } from "../../utils/sqlHelpers.js";

const styles = createStyles({
  addressName: {
    fontWeight: "lg",
  },
  addressLine: {
    color: "text-secondary",
  },
});

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
