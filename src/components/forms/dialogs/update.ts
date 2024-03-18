import { FormStateProcedureExtensions } from "../../../formState";
import { DomStatementsOrFn } from "../../../statements";
import {
  AutoSingleColumnFieldOverride,
  AutoSingleColumnOpts,
  SingleColumnOpts,
  autoSingleColumnContent,
  getFieldsFromAutoSingleColumn,
} from "../../internal/updateFormShared";
import { ExternalUpdateDialogOpts, updateDialog } from "./shared";
import * as yom from "../../../yom";
import { Node } from "../../../nodeTypes";

export interface UpdateAutoSingleColumnUpdateOpts
  extends FormStateProcedureExtensions,
    AutoSingleColumnOpts,
    ExternalUpdateDialogOpts {}

export function updateAutoSingleColumn(opts: UpdateAutoSingleColumnUpdateOpts) {
  return updateDialog(opts, {
    sourceName: "forms.dialog.updateAutoSingleColumn",
    createUpdateFormStateOpts: (table) => ({
      fields: getFieldsFromAutoSingleColumn(opts, table),
    }),
    content: (table, formState, closeModal) =>
      autoSingleColumnContent(opts, {
        formState,
        table,
        cancel: { type: "Proc", proc: closeModal },
      }),
  });
}

export interface UpdateSingleColumnUpdateOpts
  extends FormStateProcedureExtensions,
    SingleColumnOpts,
    ExternalUpdateDialogOpts {}

export function updateSingleColumn(opts: UpdateSingleColumnUpdateOpts) {
  return updateDialog(opts, {
    sourceName: "forms.dialog.updateSingleColumn",
    createUpdateFormStateOpts: (table) => ({
      fields: getFieldsFromAutoSingleColumn(opts, table),
    }),
    content: (table, formState, closeModal) =>
      autoSingleColumnContent(opts, {
        formState,
        table,
        cancel: { type: "Proc", proc: closeModal },
      }),
  });
}

export interface EmbeddedUpdateDialogOpts extends FormStateProcedureExtensions {
  open: yom.SqlExpression;
  onClose: DomStatementsOrFn;
  table: string;
  recordId: yom.SqlExpression;
  ignoreFields?: string[];
}

export type EmbeddedUpdateDialog =
  | undefined
  | null
  | false
  | ((opts: EmbeddedUpdateDialogOpts) => Node)
  | Partial<
      Omit<UpdateAutoSingleColumnUpdateOpts, "table" | "open" | "onClose">
    >;

export function resolveEmbeddedUpdateDialog(
  opts: EmbeddedUpdateDialogOpts,
  dialog: EmbeddedUpdateDialog,
): Node {
  if (typeof dialog === "function") {
    return dialog(opts);
  }
  return updateAutoSingleColumn(opts);
}
