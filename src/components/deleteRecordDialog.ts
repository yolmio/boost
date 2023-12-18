import { hub } from "../hub";
import { DomStatementsOrFn, ServiceStatementsOrFn } from "../statements";
import { confirmDangerDialog } from "./confirmDangerDialog";

export interface DeleteRecordDialog extends DeleteExtensions {
  open: string;
  onClose: DomStatementsOrFn;
  confirmDescription?: string;
  table: string;
  recordId: string;
}

export interface DeleteExtensions {
  beforeDeleteClient?: DomStatementsOrFn;
  beforeTransactionStart?: ServiceStatementsOrFn;
  afterTransactionStart?: ServiceStatementsOrFn;
  beforeTransactionCommit?: ServiceStatementsOrFn;
  afterTransactionCommit?: ServiceStatementsOrFn;
  afterDeleteClient?: DomStatementsOrFn;
}

export function deleteRecordDialog(opts: DeleteRecordDialog) {
  const table = hub.db.tables[opts.table];
  return confirmDangerDialog({
    open: opts.open,
    onClose: opts.onClose,
    description:
      opts.confirmDescription ??
      `'Are you sure you want to delete this ${table.displayName.toLowerCase()}?'`,
    onConfirm: (closeModal) => (s) =>
      s
        .if(`dialog_waiting`, (s) => s.return())
        .setScalar(`dialog_waiting`, `true`)
        .setScalar(`dialog_error`, `null`)
        .statements(opts.beforeDeleteClient)
        .commitUiTreeChanges()
        .try({
          body: (s) =>
            s.serviceProc((s) =>
              s
                .statements(opts.beforeTransactionStart)
                .startTransaction()
                .statements(opts.afterTransactionStart)
                .modify(
                  `delete from db.${opts.table} where id = ${opts.recordId}`,
                )
                .statements(opts.beforeTransactionCommit)
                .commitTransaction()
                .statements(opts.afterTransactionCommit),
            ),
          errorName: `err`,
          catch: (err) => err.setScalar(`dialog_error`, `'Unable to delete'`),
        })
        .setScalar(`dialog_waiting`, `false`)
        .if(`dialog_error is null`, (s) =>
          s.statements(closeModal, opts.afterDeleteClient),
        ),
  });
}
