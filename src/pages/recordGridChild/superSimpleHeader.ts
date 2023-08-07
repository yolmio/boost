import { button } from "../../components/button";
import { materialIcon } from "../../components/materialIcon";
import { recordDeleteButton } from "../../components/recordDeleteButton";
import { typography } from "../../components/typography";
import { element } from "../../nodeHelpers";
import { navigate } from "../../procHelpers";
import { Style } from "../../styleTypes";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { RecordGridContext } from "./shared";

export const name = "superSimpleHeader";

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

export function content(opts: Opts, ctx: RecordGridContext) {
  return element("div", {
    styles: styles.root,
    children: [
      typography({
        level: "h5",
        children: stringLiteral(opts.header),
      }),
      element("div", {
        styles: flexGrowStyles,
      }),
      button({
        color: "primary",
        size: "sm",
        variant: "soft",
        startDecorator: materialIcon("Edit"),
        children: `'Edit'`,
        href: `${stringLiteral(
          ctx.pathBase
        )} || '/' || ui.record_id || '/edit'`,
      }),
      recordDeleteButton({
        table: ctx.table.name,
        recordId: ctx.recordId,
        size: "sm",
        afterDeleteService: [navigate(stringLiteral(ctx.pathBase))],
      }),
    ],
  });
}
