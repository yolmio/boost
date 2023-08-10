import {
  FormStateProcedureExtensions,
  withInsertFormState,
} from "../formState";
import { app } from "../app";
import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { containerStyles, createStyles } from "../styleUtils";
import { stringLiteral } from "../utils/sqlHelpers";
import {
  getFieldsAndRelationsFromInsertFormContent,
  InsertFormContent,
  insertFormContent,
} from "../components/internal/insertFormShared";
import { getTableBaseUrl } from "../utils/url";

export interface InsertFormPageOpts extends FormStateProcedureExtensions {
  table: string;
  path?: string;
  content: InsertFormContent;
  withValues?: Record<string, string>;
}

const styles = createStyles({
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
});

export function insertFormPage(opts: InsertFormPageOpts) {
  const table = app.db.tables[opts.table];
  const pathBase = getTableBaseUrl(opts.table);
  const path = opts.path ?? pathBase + `/add`;
  const { fields, relations } = getFieldsAndRelationsFromInsertFormContent(
    opts.content,
    table
  );
  let content: Node = withInsertFormState({
    table: opts.table,
    fields,
    relations,
    withValues: opts.withValues,
    beforeSubmitClient: opts.beforeSubmitClient,
    beforeTransactionStart: opts.beforeTransactionStart,
    afterTransactionStart: opts.afterTransactionStart,
    beforeTransactionCommit: opts.beforeTransactionCommit,
    afterTransactionCommit: opts.afterTransactionCommit,
    afterSubmitClient: opts.afterSubmitClient,
    children: (formState) =>
      insertFormContent(opts.content, {
        formState,
        table,
        cancel: { type: "Href", href: `'/' || ` + stringLiteral(pathBase) },
      }),
  });
  content = nodes.element("div", {
    styles: styles.root(),
    children: content,
  });
  app.ui.pages.push({ path, content });
}
