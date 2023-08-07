import {
  commitTransaction,
  commitUiChanges,
  modify,
  serviceProc,
  setScalar,
  startTransaction,
} from "../procHelpers";
import { app } from "../app";
import { ClientProcStatement, ServiceProcStatement } from "../yom";
import { confirmDangerDialog } from "./confirmDangerDialog";

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
  const table = app.db.tables[opts.table];
  return confirmDangerDialog({
    open: opts.open,
    onClose: opts.onClose,
    description:
      opts.confirmDescription ??
      `'Are you sure you want to delete this ${table.displayName.toLowerCase()}?'`,
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
