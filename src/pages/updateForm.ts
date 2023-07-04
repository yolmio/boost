import { FormState, withUpdateFormState } from "../formState.js";
import { addPage } from "../modelHelpers.js";
import { element, state, switchNode } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { record } from "../procHelpers.js";
import { model } from "../singleton.js";
import { containerStyles, createStyles } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { ClientProcStatement, ServiceProcStatement } from "../yom.js";
import {
  getFieldsFromUpdateFormContent,
  UpdateFormContent,
  updateFormContent,
} from "../components/internal/updateFormShared.js";
import { getTableBaseUrl } from "../utils/url.js";

export interface EditFormPage {
  table: string;
  path?: string;
  content: UpdateFormContent;
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
});

export function updateFormPage(opts: EditFormPage) {
  const table = model.database.tables[opts.table];
  const pathBase = getTableBaseUrl(opts.table);
  const path = opts.path ?? pathBase + `/{record_id:id}/edit`;
  let content: Node = withUpdateFormState({
    table: opts.table,
    fields: getFieldsFromUpdateFormContent(opts.content, table),
    afterSubmitClient: opts.afterSubmitClient,
    afterSubmitService: opts.afterSubmitService,
    initialRecord: `ui.record`,
    children: ({ formState, onSubmit }) =>
      updateFormContent(opts.content, {
        formState,
        onSubmit,
        table,
        cancel: {
          type: "Href",
          href: `'/' || ${stringLiteral(pathBase)} ||'/' || record_id`,
        },
      }),
  });
  content = element("div", {
    styles: styles.root(),
    children: content,
  });
  addPage({
    path,
    content: state({
      procedure: [
        record(`record`, `select * from db.${opts.table} where id = record_id`),
      ],
      statusScalar: `status`,
      children: switchNode(
        [`status = 'received' and record.id is not null`, content],
        [`status = 'received' and record.id is null`, `'404 oh uh'`],
        [
          `status = 'requested' or status = 'fallback_triggered'`,
          `'loading very cool'`,
        ],
        [`status = 'failed'`, `'Failed uh oh'`]
      ),
    }),
  });
}
