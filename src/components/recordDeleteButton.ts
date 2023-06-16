import { state } from "../nodeHelpers.js";
import { navigate, scalar, setScalar } from "../procHelpers.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { ServiceProcStatement } from "../yom.js";
import { button } from "./button.js";
import { deleteRecordDialog } from "./deleteRecordDialog.js";
import { materialIcon } from "./materialIcon.js";
import { ComponentOpts } from "./types.js";

export interface RecordDeleteButtonOpts extends ComponentOpts {
  table: string;
  recordId: string;
  afterDeleteService?: ServiceProcStatement[];
  dialogConfirmDescription?: string;
}

export function recordDeleteButton(opts: RecordDeleteButtonOpts) {
  return state({
    procedure: [scalar(`deleting`, `false`)],
    children: [
      button({
        variant: opts.variant ?? "soft",
        color: opts.color ?? "danger",
        children: `'Delete'`,
        size: opts.size,
        startDecorator: materialIcon(`Delete`),
        on: { click: [setScalar(`ui.deleting`, `true`)] },
      }),
      deleteRecordDialog({
        open: `deleting`,
        onClose: [setScalar(`ui.deleting`, `false`)],
        recordId: `ui.record_id`,
        table: opts.table,
        confirmDescription:
          opts.dialogConfirmDescription ??
          `'Are you sure you want to delete this record?'`,
        afterDeleteService: opts.afterDeleteService,
      }),
    ],
  });
}
