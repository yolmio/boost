import { element, ifNode, state } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { scalar } from "../procHelpers";
import { createStyles, flexGrowStyles } from "../styleUtils";
import { lazy } from "../utils/memoize";
import { ClientProcStatement, EventHandler } from "../yom";
import { alert } from "./alert";
import { button } from "./button";
import { divider } from "./divider";
import { materialIcon } from "./materialIcon";
import { modal, modalDialog } from "./modal";
import { typography } from "./typography";

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
