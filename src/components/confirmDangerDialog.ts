import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { DomStatementsOrFn } from "../statements";
import { createStyles, flexGrowStyles } from "../styleUtils";
import { lazyPerApp } from "../utils/memoize";
import { alert } from "./alert";
import { button } from "./button";
import { divider } from "./divider";
import { materialIcon } from "./materialIcon";
import { modal, modalDialog } from "./modal";
import { typography } from "./typography";

export interface ConfirmDangerDialogOpts {
  open: string;
  onClose: DomStatementsOrFn;
  onConfirm: (close: DomStatementsOrFn) => DomStatementsOrFn;
  description?: Node;
  confirmButtonText?: string;
}

const styles = createStyles({
  title: {
    fontSize: "1.25em",
    mb: "0.25em",
  },
  description: {
    color: "text-tertiary",
    mb: 3,
  },
  divider: { my: 2 },
  footer: {
    display: "flex",
    gap: 1,
  },
});

const titleId = "'confirm-dialog-title'";
const descriptionId = "'confirm-dialog-description'";

const header = lazyPerApp(() => [
  typography({
    tag: "h2",
    level: "inherit",
    styles: styles.title,
    props: {
      id: titleId,
    },
    startDecorator: materialIcon("WarningRounded"),
    children: "'Confirmation'",
  }),
  divider({ styles: styles.divider }),
]);

export function confirmDangerDialog(opts: ConfirmDangerDialogOpts) {
  return modal({
    onClose: opts.onClose,
    open: opts.open,
    children: (closeModal) =>
      modalDialog({
        props: {
          role: "'alertdialog'",
          "aria-labelledby": titleId,
          "aria-describedby": descriptionId,
        },
        layout: "center",
        children: [
          header(),
          typography({
            props: {
              id: descriptionId,
            },
            styles: styles.description,
            children: opts.description ?? "'Are you sure you about that?'",
          }),
          nodes.state({
            procedure: (s) =>
              s
                .scalar(`dialog_waiting`, `false`)
                .scalar(`dialog_error`, { type: "String", maxLength: 2000 }),
            children: nodes.element("div", {
              styles: styles.footer,
              children: [
                nodes.if({
                  condition: `dialog_error is not null`,
                  then: [
                    alert({
                      size: "sm",
                      color: "danger",
                      startDecorator: materialIcon("ErrorRounded"),
                      children: `dialog_error`,
                    }),
                    nodes.element("div", {
                      styles: flexGrowStyles,
                    }),
                  ],
                  else: nodes.element("div", {
                    styles: flexGrowStyles,
                  }),
                }),
                button({
                  variant: "plain",
                  color: "neutral",
                  on: {
                    click: closeModal,
                  },
                  children: "'Cancel'",
                }),
                button({
                  variant: "solid",
                  color: "danger",
                  loading: `dialog_waiting`,
                  on: {
                    click: {
                      detachedFromNode: true,
                      procedure: opts.onConfirm(closeModal),
                    },
                  },
                  children: opts.confirmButtonText ?? "'Confirm'",
                }),
              ],
            }),
          }),
        ],
      }),
  });
}
