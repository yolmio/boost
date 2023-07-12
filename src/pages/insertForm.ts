import { FormState, withInsertFormState } from "../formState.js";
import { addPage } from "../modelHelpers.js";
import { element } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { model } from "../singleton.js";
import { containerStyles, createStyles } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { ClientProcStatement, ServiceProcStatement } from "../yom.js";
import {
  getFieldsAndRelationsFromInsertFormContent,
  InsertFormContent,
  insertFormContent,
} from "../components/internal/insertFormShared.js";
import { getTableBaseUrl } from "../utils/url.js";

export interface SectionedInsertFormPageOpts {
  table: string;
  path?: string;
  content: InsertFormContent;
  withValues?: Record<string, string>;
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
  const table = model.database.tables[opts.table];
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
    afterSubmitService: opts.afterSubmitService,
    afterSubmitClient: opts.afterSubmitClient,
    serviceCheck: opts.serviceCheck,
    postInsert: opts.postInsert,
    beforeSubmitClient: opts.beforeSubmitClient,
    beforeTransaction: opts.beforeTransaction,
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
