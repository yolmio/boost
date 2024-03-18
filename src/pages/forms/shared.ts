import {
  FormStateProcedureExtensions,
  InsertFormState,
  InsertFormStateOpts,
  UpdateFormState,
  UpdateFormStateOpts,
  withInsertFormState,
  withUpdateFormState,
} from "../../formState";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles } from "../../styleUtils";
import { App, Table, system } from "../../system";
import { containerStyles } from "../../styleUtils";
import { getTableBaseUrl } from "../../utils/url";
import { SqlExpression } from "../../yom";
import { stringLiteral } from "../../utils/sqlHelpers";
import { alert, circularProgress, materialIcon } from "../../components";

export const styles = createStyles({
  root: () => [
    containerStyles(),
    {
      mx: "auto",
      my: 4,
      pb: 4,
      display: "flex",
      flexDirection: "column",
    },
  ],
  notContentWrapper: {
    display: "flex",
    justifyContent: "center",
    mt: 8,
  },
});

export interface ExternalInsertOpts extends FormStateProcedureExtensions {
  path?: string;
  table: string;
  title?: string;
  withValues?: Record<string, string>;
}

export interface InternalInsertOpts {
  createInsertFormStateOpts: (
    table: Table,
  ) => Omit<InsertFormStateOpts, "table">;
  content: (
    table: Table,
    formState: InsertFormState,
    cancelHref: SqlExpression,
  ) => Node;
  sourceName: string;
}

export function createInsertFormNode(
  external: ExternalInsertOpts,
  internal: InternalInsertOpts,
) {
  const tableModel = system.db.tables[external.table];
  const pathBase = getTableBaseUrl(external.table);
  return nodes.sourceMap(
    `${internal.sourceName}(table: "${external.table}")`,
    nodes.element("div", {
      styles: styles.root(),
      children: withInsertFormState({
        table: external.table,
        afterSubmitClient: external.afterSubmitClient,
        beforeSubmitClient: external.beforeSubmitClient,
        afterTransactionStart: external.afterTransactionStart,
        afterTransactionCommit: external.afterTransactionCommit,
        beforeTransactionCommit: external.beforeTransactionCommit,
        beforeTransactionStart: external.beforeTransactionStart,
        withValues: external.withValues,
        ...internal.createInsertFormStateOpts(tableModel),
        children: (formState) =>
          internal.content(
            tableModel,
            formState,
            `'/' || ${stringLiteral(pathBase)}`,
          ),
      }),
    }),
  );
}

export function addInsertForm(
  external: ExternalInsertOpts,
  internal: InternalInsertOpts,
  app: App,
) {
  const content = createInsertFormNode(external, internal);
  const pathBase = getTableBaseUrl(external.table);
  const path = external.path ?? pathBase + `/add`;
  app.pages.push({ path, content });
}

export interface ExternalUpdateOpts extends FormStateProcedureExtensions {
  path?: string;
  table: string;
  title?: SqlExpression;
}

export interface InternalUpdateOpts {
  createUpdateFormStateOpts: (
    table: Table,
  ) => Omit<UpdateFormStateOpts, "table">;
  content: (
    table: Table,
    formState: UpdateFormState,
    cancelHref: SqlExpression,
  ) => Node;
  sourceName: string;
}

export function createUpdateFormNode(
  external: ExternalUpdateOpts,
  internal: InternalUpdateOpts,
) {
  const tableModel = system.db.tables[external.table];
  const pathBase = getTableBaseUrl(external.table);
  return nodes.sourceMap(
    `${internal.sourceName}(table: "${external.table}")`,
    nodes.element("div", {
      styles: styles.root(),
      children: nodes.state({
        procedure: (s) =>
          s.record(
            `update_form_record`,
            `select * from db.${external.table} where id = ui.record_id`,
          ),
        statusScalar: `status`,
        children: nodes.switch(
          {
            condition: `status = 'received' and update_form_record.id is not null`,
            node: withUpdateFormState({
              table: external.table,
              initialRecord: `ui.update_form_record`,
              afterSubmitClient: external.afterSubmitClient,
              beforeSubmitClient: external.beforeSubmitClient,
              afterTransactionStart: external.afterTransactionStart,
              afterTransactionCommit: external.afterTransactionCommit,
              beforeTransactionCommit: external.beforeTransactionCommit,
              beforeTransactionStart: external.beforeTransactionStart,
              ...internal.createUpdateFormStateOpts(tableModel),
              children: (formState) =>
                internal.content(
                  tableModel,
                  formState,
                  `'/' || ${stringLiteral(pathBase)} || '/' || record_id`,
                ),
            }),
          },
          {
            condition: `status = 'received' and update_form_record.id is null`,
            node: nodes.element("div", {
              styles: styles.notContentWrapper,
              children: alert({
                color: "danger",
                startDecorator: materialIcon("Report"),
                size: "lg",
                children: `'No ' || ${stringLiteral(
                  tableModel.displayName.toLowerCase(),
                )} || ' with id'`,
              }),
            }),
          },
          {
            condition: `status = 'requested' or status = 'fallback_triggered'`,
            node: nodes.element("div", {
              styles: styles.notContentWrapper,
              children: circularProgress({ size: "lg" }),
            }),
          },
          {
            condition: `status = 'failed'`,
            node: nodes.element("div", {
              styles: styles.notContentWrapper,
              children: alert({
                color: "danger",
                startDecorator: materialIcon("Report"),
                size: "lg",
                children: `'Unable to load page'`,
              }),
            }),
          },
        ),
      }),
    }),
  );
}
