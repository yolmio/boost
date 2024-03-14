import {
  FormStateProcedureExtensions,
  InsertFormState,
  InsertFormStateOpts,
  UpdateFormState,
  UpdateFormStateOpts,
  withInsertFormState,
  withUpdateFormState,
} from "../../../formState";
import { nodes } from "../../../nodeHelpers";
import { Node } from "../../../nodeTypes";
import { DomStatements, DomStatementsOrFn } from "../../../statements";
import { createStyles } from "../../../styleUtils";
import { Table, system } from "../../../system";
import { ident, stringLiteral } from "../../../utils/sqlHelpers";
import { SqlExpression } from "../../../yom";
import { alert } from "../../alert";
import { circularProgress } from "../../circularProgress";
import { divider } from "../../divider";
import { materialIcon } from "../../materialIcon";
import { modal, modalDialog } from "../../modal";
import { typography } from "../../typography";
import { getUniqueUiId } from "../../utils";

export const styles = createStyles({
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

export const titleId = stringLiteral(getUniqueUiId());

export interface ExternalInsertDialogOpts extends FormStateProcedureExtensions {
  open: SqlExpression;
  onClose: DomStatementsOrFn;
  table: string;
  title?: SqlExpression;
  withValues?: Record<string, string>;
}

export interface InternalInsertDialogOpts {
  createInsertFormStateOpts: (
    table: Table,
  ) => Omit<InsertFormStateOpts, "table">;
  content: (
    table: Table,
    formState: InsertFormState,
    closeModal: DomStatements,
  ) => Node;
  sourceName: string;
}

export function insertDialog(
  external: ExternalInsertDialogOpts,
  internal: InternalInsertDialogOpts,
) {
  const tableModel = system.db.tables[external.table];
  return nodes.sourceMap(
    `${internal.sourceName}(table: "${external.table}")`,
    modal({
      onClose: external.onClose,
      open: external.open,
      children: (closeModal) =>
        withInsertFormState({
          table: external.table,
          afterSubmitClient: (state, s) => {
            external.afterSubmitClient?.(state, s);
            s.statements(closeModal);
          },
          beforeSubmitClient: external.beforeSubmitClient,
          afterTransactionStart: external.afterTransactionStart,
          afterTransactionCommit: external.afterTransactionCommit,
          beforeTransactionCommit: external.beforeTransactionCommit,
          beforeTransactionStart: external.beforeTransactionStart,
          withValues: external.withValues,
          ...internal.createInsertFormStateOpts(tableModel),
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
                    external.title ?? `'Add a new ${tableModel.displayName}'`,
                }),
                divider({ styles: styles.divider }),
                internal.content(tableModel, formState, closeModal),
              ],
            }),
        }),
    }),
  );
}

export interface ExternalUpdateDialogOpts extends FormStateProcedureExtensions {
  open: SqlExpression;
  onClose: DomStatementsOrFn;
  table: string;
  title?: SqlExpression;
  recordId: SqlExpression;
}

export interface InternalUpdateDialogOpts {
  createUpdateFormStateOpts: (
    table: Table,
  ) => Omit<UpdateFormStateOpts, "table">;
  content: (
    table: Table,
    formState: UpdateFormState,
    closeModal: DomStatements,
  ) => Node;
  sourceName: string;
}

export function updateDialog(
  external: ExternalUpdateDialogOpts,
  internal: InternalUpdateDialogOpts,
) {
  const tableModel = system.db.tables[external.table];
  function withDialog(children: Node, keydown?: DomStatementsOrFn) {
    return modalDialog({
      size: "lg",
      styles: styles.modalDialog,
      props: {
        role: "'dialog'",
        "aria-labelledby": titleId,
      },
      on: { keydown },
      children: [
        typography({
          tag: "h2",
          level: "inherit",
          styles: styles.header,
          props: {
            id: titleId,
          },
          children:
            external.title ??
            `'Update ' || ${stringLiteral(tableModel.displayName)}`,
        }),
        divider({ styles: styles.divider }),
        children,
      ],
    });
  }
  return nodes.sourceMap(
    `${internal.sourceName}(table: "${external.table}")`,

    modal({
      onClose: external.onClose,
      open: external.open,
      children: (closeModal) =>
        nodes.state({
          procedure: (s) =>
            s.record(
              `update_dialog_record`,
              `select * from db.${ident(external.table)} where id = ${
                external.recordId
              }`,
            ),
          statusScalar: `update_dialog_status`,
          children: nodes.switch(
            {
              condition: `update_dialog_status = 'received' and update_dialog_record.id is not null`,
              node: withUpdateFormState({
                table: external.table,
                recordId: external.recordId,
                initialRecord: `update_dialog_record`,
                beforeSubmitClient: external.beforeSubmitClient,
                beforeTransactionStart: external.beforeTransactionStart,
                afterTransactionStart: external.afterTransactionStart,
                beforeTransactionCommit: external.beforeTransactionCommit,
                afterTransactionCommit: external.afterTransactionCommit,
                afterSubmitClient: (state, s) => {
                  external.afterSubmitClient?.(state, s);
                  s.statements(closeModal);
                },
                ...internal.createUpdateFormStateOpts(tableModel),
                children: (formState) =>
                  withDialog(
                    internal.content(tableModel, formState, closeModal),
                    (s) =>
                      s.if(
                        `event.key = 'Enter' and (event.ctrl_key or event.meta_key)`,
                        formState.onSubmit,
                      ),
                  ),
              }),
            },
            {
              condition: `update_dialog_status = 'requested' or update_dialog_status = 'fallback_triggered'`,
              node: withDialog(
                nodes.element("div", {
                  children: circularProgress({ size: "lg" }),
                }),
              ),
            },
            {
              condition: `true`,
              node: withDialog(
                alert({
                  color: "danger",
                  startDecorator: materialIcon("Report"),
                  size: "lg",
                  children: `'Unable to load page'`,
                }),
              ),
            },
          ),
        }),
    }),
  );
}
