import { nodes } from "../../nodeHelpers";
import { createStyles } from "../../styleUtils";
import { ident } from "../../utils/sqlHelpers";
import { alert } from "../../components/alert";
import { button } from "../../components/button";
import { divider } from "../../components/divider";
import { iconButton } from "../../components/iconButton";
import { materialIcon } from "../../components/materialIcon";
import { textarea } from "../../components/textarea";
import { typography } from "../../components/typography";
import { card } from "../../components/card";
import { Style } from "../../styleTypes";
import { RecordGridBuilder } from "../recordGrid";

export interface Opts {
  styles?: Style;
}

const styles = createStyles({
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    pb: 1.5,
  },
  emptyNote: {
    color: "text-tertiary",
    my: 1.5,
    pb: 0,
  },
  noteText: {
    whiteSpace: "pre-wrap",
  },
  editingError: {
    mt: 1.5,
  },
  textarea: {
    mt: 1.5,
  },
  buttons: {
    display: "flex",
    justifyContent: "flex-end",
    mt: 1.5,
  },
});

export function content(opts: Opts, ctx: RecordGridBuilder) {
  return card({
    variant: "outlined",
    styles: opts.styles,
    children: nodes.state({
      procedure: (s) => s.scalar(`editing`, `false`),
      children: [
        nodes.element("div", {
          styles: styles.header,
          children: [
            typography({
              level: "h6",
              children: `'Notes'`,
            }),
            iconButton({
              variant: "plain",
              size: "sm",
              children: nodes.if({
                expr: `editing`,
                then: materialIcon("Close"),
                else: materialIcon("Edit"),
              }),
              on: { click: (s) => s.setScalar(`editing`, `not editing`) },
            }),
          ],
        }),
        divider(),
        nodes.state({
          watch: [ctx.refreshKey],
          procedure: (s) =>
            s.scalar(
              `note`,
              `(select notes from db.${ident(ctx.table.name)} where id = ${
                ctx.recordId
              })`
            ),
          children: nodes.if({
            expr: `editing`,
            then: nodes.state({
              procedure: (s) =>
                s
                  .scalar(`editing_note`, `note`)
                  .scalar(`in_progress`, `false`)
                  .scalar(`failed`, `false`),
              children: [
                textarea({
                  styles: styles.textarea,
                  slots: {
                    textarea: {
                      props: {
                        value: `editing_note`,
                        yolmFocusKey: `true`,
                        rows: `5`,
                      },
                      on: {
                        input: (s) =>
                          s.setScalar(`editing_note`, `target_value`),
                      },
                    },
                  },
                }),
                nodes.if(
                  `failed`,
                  alert({
                    styles: styles.editingError,
                    color: "danger",
                    children: `'Unable to add note at this time'`,
                  })
                ),
                nodes.element("div", {
                  styles: styles.buttons,
                  children: [
                    button({
                      loading: `in_progress`,
                      children: "'Save changes'",
                      size: "sm",
                      on: {
                        click: (s) =>
                          s
                            .if(`in_progress`, (s) => s.return())
                            .setScalar(`in_progress`, `true`)
                            .setScalar(`failed`, `false`)
                            .commitUiChanges()
                            .try({
                              body: (s) =>
                                s
                                  .serviceProc((s) =>
                                    s
                                      .modify(
                                        `update db.${ident(
                                          ctx.table.name
                                        )} set notes = ui.editing_note where id = ${
                                          ctx.recordId
                                        }`
                                      )
                                      .statements(ctx.triggerRefresh)
                                  )
                                  .setScalar(`ui.editing`, `false`),
                              catch: (s) =>
                                s
                                  .setScalar(`ui.in_progress`, `false`)
                                  .setScalar(`ui.failed`, `true`),
                            }),
                      },
                    }),
                  ],
                }),
              ],
            }),
            else: nodes.if({
              expr: `note is null or note = ''`,
              then: nodes.element("p", {
                styles: styles.emptyNote,
                children: "'No notes here!'",
              }),
              else: nodes.element("p", {
                styles: styles.noteText,
                children: `note`,
              }),
            }),
          }),
        }),
      ],
    }),
  });
}
