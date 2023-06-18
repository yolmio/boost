import { FormState, withUpdateFormState } from "../formState.js";
import { model } from "../singleton.js";
import { createStyles } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
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
import { element, sourceMap } from "../nodeHelpers.js";

export interface EditDialogOpts {
  open: string;
  onClose: ClientProcStatement[];
  table: string;
  content: UpdateFormContent;
  initialRecord?: string;
  recordId: string;
  afterSubmitService?: (state: FormState) => ServiceProcStatement[];
  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
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
  contentWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
});

export function updateDialog(opts: EditDialogOpts) {
  const tableModel = model.database.tables[opts.table];
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
              children: `'Update ' || ${stringLiteral(
                tableModel.name.displayName
              )}`,
            }),
            divider({ styles: styles.divider }),
            withUpdateFormState({
              table: opts.table,
              recordId: opts.recordId,
              fields: getFieldsFromUpdateFormContent(opts.content, tableModel),
              afterSubmitService: opts.afterSubmitService,
              initialRecord: opts.initialRecord,
              afterSubmitClient: (state) => [
                ...(opts.afterSubmitClient?.(state) ?? []),
                ...closeModal,
              ],
              children: ({ formState, onSubmit }) =>
                element("div", {
                  styles: styles.contentWrapper,
                  children: updateFormContent(opts.content, {
                    formState,
                    onSubmit,
                    table: tableModel,
                    cancel: { type: "Proc", proc: closeModal },
                  }),
                }),
            }),
          ],
        }),
    })
  );
}
