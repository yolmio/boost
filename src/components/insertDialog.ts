import { FormState, withInsertFormState } from "../formState.js";
import { sourceMap } from "../nodeHelpers.js";
import { model } from "../singleton.js";
import { createStyles } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { ClientProcStatement, ServiceProcStatement } from "../yom.js";
import { divider } from "./divider.js";
import { modal, modalDialog } from "./modal.js";
import { typography } from "./typography.js";
import { getUniqueUiId } from "./utils.js";
import {
  getFieldsAndRelationsFromInsertFormContent,
  InsertFormContent,
  insertFormContent,
} from "./internal/insertFormShared.js";

export interface InsertDialogOpts {
  open: string;
  onClose: ClientProcStatement[];
  table: string;
  content: InsertFormContent;
  withValues?: Record<string, string>;
  title?: string;
  afterSubmitService?: (state: FormState) => ServiceProcStatement[];
  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
  beforeSubmitClient?: (state: FormState) => ClientProcStatement[];
  beforeTransaction?: (state: FormState) => ServiceProcStatement[];
  /** Runs before the insert */
  serviceCheck?: (state: FormState) => ServiceProcStatement[];
  /** Like afterSubmitService, but runs as part of the same transaction as the insert */
  postInsert?: (state: FormState) => ServiceProcStatement[];
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
  const tableModel = model.database.tables[opts.table];
  const { fields, relations } = getFieldsAndRelationsFromInsertFormContent(
    opts.content,
    tableModel
  );
  return sourceMap(
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
              children:
                opts.title ?? `'Add a new ${tableModel.name.displayName}'`,
            }),
            divider({ styles: styles.divider }),
            withInsertFormState({
              table: opts.table,
              fields,
              relations,
              withValues: opts.withValues,
              afterSubmitService: opts.afterSubmitService,
              afterSubmitClient: (state) => [
                ...(opts.afterSubmitClient?.(state) ?? []),
                ...closeModal,
              ],
              serviceCheck: opts.serviceCheck,
              postInsert: opts.postInsert,
              beforeSubmitClient: opts.beforeSubmitClient,
              beforeTransaction: opts.beforeTransaction,
              children: ({ formState, onSubmit }) =>
                insertFormContent(opts.content, {
                  formState,
                  onSubmit,
                  table: tableModel,
                  cancel: { type: "Proc", proc: closeModal },
                }),
            }),
          ],
        }),
    })
  );
}
