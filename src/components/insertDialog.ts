import {
  FormStateProcedureExtensions,
  withInsertFormState,
} from "../formState";
import { nodes } from "../nodeHelpers";
import { system } from "../system";
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
  const tableModel = system.db.tables[opts.table];
  const { fields, relations } = getFieldsAndRelationsFromInsertFormContent(
    opts.content,
    tableModel,
  );
  return nodes.sourceMap(
    `insertDialog(table: "${opts.table}")`,
    modal({
      onClose: opts.onClose,
      open: opts.open,
      children: (closeModal) =>
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
            modalDialog({
              size: "lg",
              styles: styles.modalDialog,
              props: {
                role: "'dialog'",
                "aria-labelledby": titleId,
              },
              on: {
                keydown: (s) =>
                  s.if(
                    `event.key = 'Enter' and (event.ctrl_key or event.meta_key)`,
                    formState.onSubmit,
                  ),
              },
              children: [
                typography({
                  tag: "h2",
                  level: "inherit",
                  styles: styles.header,
                  props: {
                    id: titleId,
                  },
                  children:
                    opts.title ?? `'Add a new ${tableModel.displayName}'`,
                }),
                divider({ styles: styles.divider }),
                insertFormContent(opts.content, {
                  formState,
                  table: tableModel,
                  cancel: { type: "Proc", proc: closeModal },
                }),
              ],
            }),
        }),
    }),
  );
}
