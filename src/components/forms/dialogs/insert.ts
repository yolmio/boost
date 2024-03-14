import { FormStateProcedureExtensions } from "../../../formState";
import { DomStatementsOrFn } from "../../../statements";
import {
  AutoSingleColumnFieldOverride,
  AutoSingleColumnOpts,
  SingleColumnOpts,
  autoSingleColumnContent,
  getFieldsFromAutoSingleColumn,
} from "../../internal/insertFormShared";
import { ExternalInsertDialogOpts, insertDialog } from "./shared";
import * as yom from "../../../yom";
import { Node } from "../../../nodeTypes";

export interface InsertAutoSingleColumnInsertOpts
  extends FormStateProcedureExtensions,
    AutoSingleColumnOpts,
    ExternalInsertDialogOpts {}

export function insertAutoSingleColumn(opts: InsertAutoSingleColumnInsertOpts) {
  const ignoreFields = [
    ...(opts.ignoreFields ?? []),
    ...Object.keys(opts.withValues ?? {}),
  ];
  return insertDialog(opts, {
    sourceName: "forms.dialog.insertAutoSingleColumn",
    createInsertFormStateOpts: (table) => ({
      fields: getFieldsFromAutoSingleColumn({ ...opts, ignoreFields }, table),
    }),
    content: (table, formState, closeModal) =>
      autoSingleColumnContent(
        {
          ...opts,
          ignoreFields,
        },
        {
          formState,
          table,
          cancel: { type: "Proc", proc: closeModal },
        },
      ),
  });
}

export interface InsertSingleColumnInsertOpts
  extends FormStateProcedureExtensions,
    SingleColumnOpts,
    ExternalInsertDialogOpts {}

export function insertSingleColumn(opts: InsertSingleColumnInsertOpts) {
  return insertDialog(opts, {
    sourceName: "forms.dialog.insertSingleColumn",
    createInsertFormStateOpts: (table) => ({
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

export interface EmbeddedInsertDialogOpts extends FormStateProcedureExtensions {
  open: yom.SqlExpression;
  onClose: DomStatementsOrFn;
  table: string;
  withValues?: Record<string, string>;
  initialValues?: Record<string, string>;
}

/**
 * When pages or components need to use an insert dialog, they can use this type to specify the dialog.
 *
 * By default the dialog will be an `autoSingleColumn` dialog. The various pages and components will provide
 * values, initial values and procedures extensions, if you provide a function, be sure to use them or
 * the dialog will not work as expected.
 */
export type EmbeddedInsertDialog =
  | undefined
  | null
  | false
  | ((opts: EmbeddedInsertDialogOpts) => Node)
  | Partial<
      Omit<InsertAutoSingleColumnInsertOpts, "table" | "open" | "onClose">
    >;

export function resolveEmbeddedInsertDialog(
  opts: EmbeddedInsertDialogOpts,
  dialog: EmbeddedInsertDialog,
): Node | undefined {
  if (!dialog) {
    return insertAutoSingleColumn({
      ...opts,
      ignoreFields: Object.keys(opts.withValues ?? {}),
      fieldOverrides: Object.entries(opts.initialValues ?? {})
        .map(([field, value]) => ({ field, initialValue: value }))
        .reduce(
          (acc, { field, initialValue }) => {
            acc[field] = { initialValue };
            return acc;
          },
          {} as Record<string, AutoSingleColumnFieldOverride>,
        ),
    });
  }
  if (typeof dialog === "function") {
    return dialog(opts);
  }
  const fieldOverrides: Record<string, AutoSingleColumnFieldOverride> = {};
  if (opts.initialValues) {
    for (const [field, value] of Object.entries(opts.initialValues)) {
      fieldOverrides[field] = { initialValue: value };
    }
  }
  return insertAutoSingleColumn({
    ...opts,
    ...dialog,
    ignoreFields: [
      ...(dialog.ignoreFields ?? []),
      ...Object.keys(opts.withValues ?? {}),
    ],
  });
}
