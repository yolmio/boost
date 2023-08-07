import {
  FormState,
  FormStateProcedureExtensions,
  withUpdateFormState,
} from "../formState";
import { addPage } from "../appHelpers";
import { element, state, switchNode } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { record } from "../procHelpers";
import { app } from "../app";
import { containerStyles, createStyles } from "../styleUtils";
import { stringLiteral } from "../utils/sqlHelpers";
import { ClientProcStatement, ServiceProcStatement } from "../yom";
import {
  getFieldsFromUpdateFormContent,
  UpdateFormContent,
  updateFormContent,
} from "../components/internal/updateFormShared";
import { getTableBaseUrl } from "../utils/url";
import { circularProgress } from "../components/circularProgress";
import { alert } from "../components/alert";
import { materialIcon } from "../components/materialIcon";

export interface EditFormPage extends FormStateProcedureExtensions {
  table: string;
  path?: string;
  content: UpdateFormContent;
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
  notContentWrapper: {
    display: "flex",
    justifyContent: "center",
    mt: 8,
  },
});

export function updateFormPage(opts: EditFormPage) {
  const table = app.db.tables[opts.table];
  const pathBase = getTableBaseUrl(opts.table);
  const path = opts.path ?? pathBase + `/{record_id:id}/edit`;
  let content: Node = withUpdateFormState({
    table: opts.table,
    fields: getFieldsFromUpdateFormContent(opts.content, table),
    beforeSubmitClient: opts.beforeSubmitClient,
    beforeTransactionStart: opts.beforeTransactionStart,
    afterTransactionStart: opts.afterTransactionStart,
    beforeTransactionCommit: opts.beforeTransactionCommit,
    afterTransactionCommit: opts.afterTransactionCommit,
    afterSubmitClient: opts.afterSubmitClient,
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
        [
          `status = 'received' and record.id is null`,
          element("div", {
            styles: styles.notContentWrapper,
            children: alert({
              color: "danger",
              startDecorator: materialIcon("Report"),
              size: "lg",
              children: `'No ' || ${stringLiteral(
                table.displayName.toLowerCase()
              )} || ' with id'`,
            }),
          }),
        ],
        [
          `status = 'requested' or status = 'fallback_triggered'`,
          element("div", {
            styles: styles.notContentWrapper,
            children: circularProgress({ size: "lg" }),
          }),
        ],
        [
          `status = 'failed'`,
          element("div", {
            styles: styles.notContentWrapper,
            children: alert({
              color: "danger",
              startDecorator: materialIcon("Report"),
              size: "lg",
              children: `'Unable to load page'`,
            }),
          }),
        ]
      ),
    }),
  });
}
