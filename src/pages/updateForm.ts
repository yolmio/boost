import {
  FormStateProcedureExtensions,
  withUpdateFormState,
} from "../formState";
import { app } from "../app";
import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { containerStyles, createStyles } from "../styleUtils";
import { stringLiteral } from "../utils/sqlHelpers";
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
    children: (formState) =>
      updateFormContent(opts.content, {
        formState,
        table,
        cancel: {
          type: "Href",
          href: `'/' || ${stringLiteral(pathBase)} ||'/' || record_id`,
        },
      }),
  });
  content = nodes.element("div", {
    styles: styles.root(),
    children: content,
  });
  app.ui.pages.push({
    path,
    content: nodes.state({
      procedure: (s) =>
        s.record(
          `record`,
          `select * from db.${opts.table} where id = record_id`
        ),
      statusScalar: `status`,
      children: nodes.switch(
        {
          condition: `status = 'received' and record.id is not null`,
          node: content,
        },
        {
          condition: `status = 'received' and record.id is null`,
          node: nodes.element("div", {
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
        }
      ),
    }),
  });
}
