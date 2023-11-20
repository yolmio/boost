import { button } from "../../components/button";
import { materialIcon } from "../../components/materialIcon";
import { recordDeleteButton } from "../../components/recordDeleteButton";
import { typography } from "../../components/typography";
import { nodes } from "../../nodeHelpers";
import { Style } from "../../styleTypes";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { RecordGridBuilder } from "../recordGrid";

export interface Opts {
  styles?: Style;
  header: string;
}

const styles = createStyles({
  root: {
    gridColumn: `span 12 / span 12`,
    display: "flex",
    gap: 1,
    alignItems: "baseline",
  },
});

export function content(opts: Opts, ctx: RecordGridBuilder) {
  return nodes.element("div", {
    styles: styles.root,
    children: [
      typography({
        level: "h4",
        children: stringLiteral(opts.header),
      }),
      nodes.element("div", {
        styles: flexGrowStyles,
      }),
      button({
        color: "primary",
        size: "sm",
        variant: "soft",
        startDecorator: materialIcon("Edit"),
        children: `'Edit'`,
        href: `${stringLiteral(ctx.pathBase)} || '/' || ${
          ctx.recordId
        } || '/edit'`,
      }),
      recordDeleteButton({
        table: ctx.table.name,
        recordId: ctx.recordId,
        size: "sm",
        afterTransactionCommit: (s) => s.navigate(stringLiteral(ctx.pathBase)),
      }),
    ],
  });
}
