import { button } from "../../components/button.js";
import { materialIcon } from "../../components/materialIcon.js";
import { recordDeleteButton } from "../../components/recordDeleteButton.js";
import { typography } from "../../components/typography.js";
import { element } from "../../nodeHelpers.js";
import { navigate } from "../../procHelpers.js";
import { Style } from "../../styleTypes.js";
import { createStyles, flexGrowStyles } from "../../styleUtils.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { RecordGridContext } from "./shared.js";

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
