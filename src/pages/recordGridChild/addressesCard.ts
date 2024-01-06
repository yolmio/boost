import { AddressFieldGroup } from "../../system";
import { nodes } from "../../nodeHelpers";
import { createStyles } from "../../styleUtils";
import { ident } from "../../utils/sqlHelpers";
import { displayAddressText } from "./displayAddressText";
import { divider } from "../../components/divider";
import { materialIcon } from "../../components/materialIcon";
import { typography } from "../../components/typography";
import { card } from "../../components/card";
import { Style } from "../../styleTypes";
import { RecordGridBuilder } from "../recordGrid";

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

export function content(opts: Opts, ctx: RecordGridBuilder) {
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
      nodes.element("div", {
        styles: styles.header,
        children: [
          typography({
            level: "body-lg",
            tag: "h5",
            startDecorator: materialIcon("Business"),
            children: opts.header ?? `'Addresses'`,
          }),
        ],
      }),
      divider({ styles: styles.divider }),
      nodes.state({
        watch: [ctx.refreshKey],
        procedure: (s) =>
          s.record(
            "record",
            `select ${allSelectFields} from db.${ident(
              ctx.table.name,
            )} where id = ${ctx.recordId}`,
          ),
        children: groups.map(({ header, fieldGroup }) => [
          nodes.element("h6", {
            styles: styles.groupHeader,
            children: header,
          }),
          displayAddressText(fieldGroup, "record"),
        ]),
      }),
    ],
  });
}
