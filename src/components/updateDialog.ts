import {
  FormState,
  FormStateProcedureExtensions,
  withUpdateFormState,
} from "../formState.js";
import { app } from "../singleton.js";
import { createStyles } from "../styleUtils.js";
import { ident, stringLiteral } from "../utils/sqlHelpers.js";
import { ClientProcStatement, ServiceProcStatement } from "../yom.js";
import { divider } from "./divider.js";
import { modal, modalDialog } from "./modal.js";
import { typography } from "./typography.js";
import { getUniqueUiId } from "./utils.js";
import {
  getFieldsFromUpdateFormContent,
  UpdateFormContent,
  updateFormContent,
} from "./internal/updateFormShared.js";
import { element, sourceMap, state, switchNode } from "../nodeHelpers.js";
import { record } from "../procHelpers.js";
import { alert } from "./alert.js";
import { circularProgress } from "./circularProgress.js";
import { materialIcon } from "./materialIcon.js";

export interface EditDialogOpts extends FormStateProcedureExtensions {
  open: string;
  onClose: ClientProcStatement[];
  table: string;
  content: UpdateFormContent;
  recordId: string;
}

const titleId = stringLiteral(getUniqueUiId());

const styles = createStyles({
  title: {
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

export function updateDialog(opts: EditDialogOpts) {
  const tableModel = app.database.tables[opts.table];
  return sourceMap(
    `updateDialog(table: ${opts.table})`,
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
              styles: styles.title,
              props: {
                id: titleId,
              },
              children: `'Update ' || ${stringLiteral(tableModel.displayName)}`,
            }),
            divider({ styles: styles.divider }),
            state({
              procedure: [
                record(
                  `update_dialog_record`,
                  `select * from db.${ident(opts.table)} where id = ${
                    opts.recordId
                  }`
                ),
              ],
              statusScalar: `update_dialog_status`,
              children: switchNode(
                [
                  `update_dialog_status = 'received' and update_dialog_record.id is not null`,
                  withUpdateFormState({
                    table: opts.table,
                    recordId: opts.recordId,
                    fields: getFieldsFromUpdateFormContent(
                      opts.content,
                      tableModel
                    ),
                    initialRecord: `update_dialog_record`,
                    beforeSubmitClient: opts.beforeSubmitClient,
                    beforeTransactionStart: opts.beforeTransactionStart,
                    afterTransactionStart: opts.afterTransactionStart,
                    beforeTransactionCommit: opts.beforeTransactionCommit,
                    afterTransactionCommit: opts.afterTransactionCommit,
                    afterSubmitClient: (state) => [
                      ...(opts.afterSubmitClient?.(state) ?? []),
                      ...closeModal,
                    ],
                    children: ({ formState, onSubmit }) =>
                      updateFormContent(opts.content, {
                        formState,
                        onSubmit,
                        table: tableModel,
                        cancel: { type: "Proc", proc: closeModal },
                      }),
                  }),
                ],
                [
                  `update_dialog_status = 'requested' or update_dialog_status = 'fallback_triggered'`,
                  element("div", {
                    children: circularProgress({ size: "lg" }),
                  }),
                ],
                [
                  `true`,
                  alert({
                    color: "danger",
                    startDecorator: materialIcon("Report"),
                    size: "lg",
                    children: `'Unable to load page'`,
                  }),
                ]
              ),
            }),
          ],
        }),
    })
  );
}
