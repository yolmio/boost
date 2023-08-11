import {
  FormStateProcedureExtensions,
  withInsertFormState,
} from "../formState";
import { nodes } from "../nodeHelpers";
import { app } from "../app";
import { createStyles } from "../styleUtils";
import { stringLiteral } from "../utils/sqlHelpers";
import { divider } from "./divider";
import { modal, modalDialog } from "./modal";
import { typography } from "./typography";
import { getUniqueUiId } from "./utils";
import {
  getFieldsAndRelationsFromInsertFormContent,
  InsertFormContent,
  insertFormContent,
} from "./internal/insertFormShared";
import { DomStatementsOrFn } from "../statements";

export interface InsertDialogOpts extends FormStateProcedureExtensions {
  open: string;
  onClose: DomStatementsOrFn;
  table: string;
  content: InsertFormContent;
  withValues?: Record<string, string>;
  title?: string;
}

const styles = createStyles({
  header: {
    fontSize: "1.25em",
    mb: "0.25em",
  },
  divider: {
    my: 2,
  },
  modalDialog: {
    backgroundColor: "background-body",
    "--modal-dialog-min-width": "600px",
  },
});

const titleId = stringLiteral(getUniqueUiId());

export function insertDialog(opts: InsertDialogOpts) {
  const tableModel = app.db.tables[opts.table];
  const { fields, relations } = getFieldsAndRelationsFromInsertFormContent(
    opts.content,
    tableModel
  );
  return nodes.sourceMap(
    `insertDialog(table: "${opts.table}")`,
    modal({
      onClose: opts.onClose,
      open: opts.open,
      children: (closeModal) =>
        modalDialog({
          size: "lg",
          styles: styles.modalDialog,
          props: {
            role: "'dialog'",
            "aria-labelledby": titleId,
          },
          children: [
            typography({
              tag: "h2",
              level: "inherit",
              styles: styles.header,
              props: {
                id: titleId,
              },
              children: opts.title ?? `'Add a new ${tableModel.displayName}'`,
            }),
            divider({ styles: styles.divider }),
            withInsertFormState({
              table: opts.table,
              fields,
              relations,
              withValues: opts.withValues,
              afterSubmitClient: (state, s) => {
                opts.afterSubmitClient?.(state, s);
                s.statements(closeModal);
              },
              beforeSubmitClient: opts.beforeSubmitClient,
              afterTransactionStart: opts.afterTransactionStart,
              afterTransactionCommit: opts.afterTransactionCommit,
              beforeTransactionCommit: opts.beforeTransactionCommit,
              beforeTransactionStart: opts.beforeTransactionStart,
              children: (formState) =>
                insertFormContent(opts.content, {
                  formState,
                  table: tableModel,
                  cancel: { type: "Proc", proc: closeModal },
                }),
            }),
          ],
        }),
    })
  );
}
