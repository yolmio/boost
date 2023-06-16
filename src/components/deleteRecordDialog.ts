import {
  commitTransaction,
  commitUiChanges,
  modify,
  serviceProc,
  setScalar,
  startTransaction,
} from "../procHelpers.js";
import { model } from "../singleton.js";
import { ClientProcStatement, ServiceProcStatement } from "../yom.js";
import { confirmDangerDialog } from "./confirmDangerDialog.js";

export interface DeleteRecordDialog {
  open: string;
  onClose: ClientProcStatement[];
  confirmDescription?: string;
  table: string;
  recordId: string;
  afterDeleteService?: ServiceProcStatement[];
  afterDeleteClient?: ClientProcStatement[];
}

export function deleteRecordDialog(opts: DeleteRecordDialog) {
  const table = model.database.tables[opts.table];
  return confirmDangerDialog({
    open: opts.open,
    onClose: opts.onClose,
    description:
      opts.confirmDescription ??
      `'Are you sure you want to delete this ${table.name.displayName.toLowerCase()}?'`,
    onConfirm: (closeModal) => [
      setScalar(`dialog_waiting`, `true`),
      commitUiChanges(),
      serviceProc([
        modify(`delete from db.${opts.table} where id = ${opts.recordId}`),
        ...(opts.afterDeleteService ?? []),
      ]),
      setScalar(`dialog_waiting`, `false`),
      ...closeModal,
      ...(opts.afterDeleteClient ?? []),
    ],
  });
}
