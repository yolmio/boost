import { nodes } from "../nodeHelpers";
import { button } from "./button";
import { DeleteExtensions, deleteRecordDialog } from "./deleteRecordDialog";
import { materialIcon } from "./materialIcon";
import { ComponentOpts } from "./types";

export interface RecordDeleteButtonOpts
  extends ComponentOpts,
    DeleteExtensions {
  table: string;
  recordId: string;
  dialogConfirmDescription?: string;
}

export function recordDeleteButton(opts: RecordDeleteButtonOpts) {
  return nodes.state({
    procedure: (s) => s.scalar(`deleting`, `false`),
    children: [
      button({
        variant: opts.variant ?? "soft",
        color: opts.color ?? "danger",
        children: `'Delete'`,
        size: opts.size,
        startDecorator: materialIcon(`Delete`),
        on: {
          click: (s) =>
            s
              .setScalar(`ui.deleting`, `true`)
              .triggerViewTransition("immediate", "'open-dialog'"),
        },
      }),
      deleteRecordDialog({
        ...opts,
        open: `deleting`,
        onClose: (s) => s.setScalar(`ui.deleting`, `false`),
        recordId: `ui.record_id`,
        table: opts.table,
        confirmDescription:
          opts.dialogConfirmDescription ??
          `'Are you sure you want to delete this record?'`,
      }),
    ],
  });
}
