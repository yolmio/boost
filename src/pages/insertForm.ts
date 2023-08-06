import {
  FormStateProcedureExtensions,
  withInsertFormState,
} from "../formState.js";
import { addPage } from "../appHelpers.js";
import { element } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { app } from "../singleton.js";
import { containerStyles, createStyles } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import {
  getFieldsAndRelationsFromInsertFormContent,
  InsertFormContent,
  insertFormContent,
} from "../components/internal/insertFormShared.js";
import { getTableBaseUrl } from "../utils/url.js";

export interface SectionedInsertFormPageOpts
  extends FormStateProcedureExtensions {
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

export function insertFormPage(opts: SectionedInsertFormPageOpts) {
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
    children: ({ formState, onSubmit }) =>
      insertFormContent(opts.content, {
        formState,
        onSubmit,
        table,
        cancel: { type: "Href", href: `'/' || ` + stringLiteral(pathBase) },
      }),
  });
  content = element("div", {
    styles: styles.root(),
    children: content,
  });
  addPage({ path, content });
}
