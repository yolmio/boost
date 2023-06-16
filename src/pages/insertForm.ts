import { FormState, withInsertFormState } from "../formState.js";
import { addPage } from "../modelHelpers.js";
import { element, ifNode } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { model } from "../singleton.js";
import { containerStyles, createStyles } from "../styleUtils.js";
import { pluralize } from "../utils/inflectors.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { ClientProcStatement, ServiceProcStatement } from "../yom.js";
import {
  getFieldsAndRelationsFromInsertFormContent,
  InsertFormContent,
  insertFormContent,
} from "../components/internal/insertFormShared.js";

export interface SectionedInsertFormPageOpts {
  table: string;
  path?: string;
  content: InsertFormContent;
  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
  afterSubmitService?: (state: FormState) => ServiceProcStatement[];
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
  formError: {
    alignItems: "flex-start",
    my: 1.5,
  },
});

export function insertFormPage(opts: SectionedInsertFormPageOpts) {
  const table = model.database.tables[opts.table];
  const pathBase = pluralize(opts.table.split("_").join(" "))
    .split(" ")
    .join("-");
  const path = opts.path ?? pathBase + `/add`;
  const { fields, relations } = getFieldsAndRelationsFromInsertFormContent(
    opts.content,
    table
  );
  let content: Node = withInsertFormState({
    table: opts.table,
    fields,
    relations,
    afterSubmitClient: opts.afterSubmitClient,
    afterSubmitService: opts.afterSubmitService,
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
