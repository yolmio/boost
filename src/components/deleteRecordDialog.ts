import { app } from "../app";
import { DomStatementsOrFn, ServiceStatementsOrFn } from "../statements";
import { confirmDangerDialog } from "./confirmDangerDialog";

export interface DeleteRecordDialog {
  open: string;
  onClose: DomStatementsOrFn;
  confirmDescription?: string;
  table: string;
  recordId: string;
  afterDeleteService?: ServiceStatementsOrFn;
  afterDeleteClient?: DomStatementsOrFn;
}

export function deleteRecordDialog(opts: DeleteRecordDialog) {
  const table = app.db.tables[opts.table];
  return confirmDangerDialog({
    open: opts.open,
    onClose: opts.onClose,
    description:
      opts.confirmDescription ??
      `'Are you sure you want to delete this ${table.displayName.toLowerCase()}?'`,
    onConfirm: (closeModal) => (s) =>
      s
        .setScalar(`dialog_waiting`, `true`)
        .commitUiTreeChanges()
        .serviceProc((s) =>
          s
            .startTransaction()
            .modify(`delete from db.${opts.table} where id = ${opts.recordId}`)
            .commitTransaction()
            .statements(opts.afterDeleteService)
        )
        .setScalar(`dialog_waiting`, `false`)
        .statements(closeModal, opts.afterDeleteClient),
  });
}
