import { nodes } from "../../nodeHelpers";
import { createStyles } from "../../styleUtils";
import { ident } from "../../utils/sqlHelpers";
import { divider } from "../../components/divider";
import { materialIcon } from "../../components/materialIcon";
import { typography } from "../../components/typography";
import { displayAddressText } from "./displayAddressText";
import { card } from "../../components/card";
import { Style } from "../../styleTypes";
import { RecordGridBuilder } from "../recordGrid";

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

export function content(opts: Opts, ctx: RecordGridBuilder) {
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
      nodes.element("div", {
        styles: styles.header,
        children: [
          typography({
            level: "body-lg",
            startDecorator: materialIcon("Business"),
            children: opts.header ?? `'Address'`,
          }),
        ],
      }),
      divider({ styles: styles.divider }),
      nodes.state({
        watch: [ctx.refreshKey],
        procedure: (s) =>
          s.record(
            "record",
            `select ${selectFields} from db.${ctx.table.identName} where ${ctx.table.primaryKeyIdent} = ${ctx.recordId}`,
          ),
        children: displayAddressText(fieldGroup, "record"),
      }),
    ],
  });
}
