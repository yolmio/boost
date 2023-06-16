import { element, ifNode, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { scalar } from "../procHelpers.js";
import { createStyles, flexGrowStyles } from "../styleUtils.js";
import { lazy } from "../utils/memoize.js";
import { ClientProcStatement, EventHandler } from "../yom.js";
import { alert } from "./alert.js";
import { button } from "./button.js";
import { divider } from "./divider.js";
import { materialIcon } from "./materialIcon.js";
import { modal, modalDialog } from "./modal.js";
import { typography } from "./typography.js";

export interface ConfirmDangerDialogOpts {
  open: string;
  onClose: ClientProcStatement[];
  onConfirm: (close: ClientProcStatement[]) => EventHandler;
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

const header = lazy(() => [
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
          state({
            procedure: [
              scalar(`dialog_waiting`, `false`),
              scalar(`dialog_error`, { type: "String", maxLength: 2000 }),
            ],
            children: element("div", {
              styles: styles.footer,
              children: [
                ifNode(
                  `dialog_error is not null`,
                  [
                    alert({
                      size: "sm",
                      color: "danger",
                      startDecorator: materialIcon("ErrorRounded"),
                      children: `dialog_error`,
                    }),
                    element("div", {
                      styles: flexGrowStyles,
                    }),
                  ],
                  element("div", {
                    styles: flexGrowStyles,
                  })
                ),
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
                    click: opts.onConfirm(closeModal),
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
