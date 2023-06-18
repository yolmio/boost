import { element, ifNode, state } from "../../nodeHelpers.js";
import {
  commitUiChanges,
  debugExpr,
  exit,
  if_,
  modify,
  record,
  scalar,
  serviceProc,
  setScalar,
  try_,
} from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";
import { ident } from "../../utils/sqlHelpers.js";
import { alert } from "../../components/alert.js";
import { button } from "../../components/button.js";
import { divider } from "../../components/divider.js";
import { iconButton } from "../../components/iconButton.js";
import { materialIcon } from "../../components/materialIcon.js";
import { textarea } from "../../components/textarea.js";
import { typography } from "../../components/typography.js";
import { RecordGridContext } from "./shared.js";
import { card } from "../../components/card.js";
import { Style } from "../../styleTypes.js";

export const name = "notesCard";

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

export function content(opts: Opts, ctx: RecordGridContext) {
  return card({
    variant: "outlined",
    styles: opts.styles,
    children: state({
      procedure: [scalar(`editing`, `false`)],
      children: [
        element("div", {
          styles: styles.header,
          children: [
            typography({
              level: "h6",
              children: `'Notes'`,
            }),
            iconButton({
              variant: "plain",
              size: "sm",
              children: ifNode(
                `editing`,
                materialIcon("Close"),
                materialIcon("Edit")
              ),
              on: { click: [setScalar(`editing`, `not editing`)] },
            }),
          ],
        }),
        divider(),
        state({
          watch: [ctx.refreshKey],
          procedure: [
            scalar(
              `note`,
              `(select notes from db.${ident(ctx.table.name.name)} where id = ${
                ctx.recordId
              })`
            ),
          ],
          children: ifNode(
            `editing`,
            state({
              procedure: [
                scalar(`editing_note`, `note`),
                scalar(`in_progress`, `false`),
                scalar(`failed`, `false`),
              ],
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
                        input: [setScalar(`editing_note`, `target_value`)],
                      },
                    },
                  },
                }),
                ifNode(
                  `failed`,
                  alert({
                    styles: styles.editingError,
                    color: "danger",
                    children: `'Unable to add note at this time'`,
                  })
                ),
                element("div", {
                  styles: styles.buttons,
                  children: [
                    button({
                      loading: `in_progress`,
                      children: "'Save changes'",
                      size: "sm",
                      on: {
                        click: [
                          if_(`in_progress`, exit()),
                          setScalar(`in_progress`, `true`),
                          setScalar(`failed`, `false`),
                          commitUiChanges(),
                          try_({
                            body: [
                              serviceProc([
                                modify(
                                  `update db.${ident(
                                    ctx.table.name.name
                                  )} set notes = ui.editing_note where id = ${
                                    ctx.recordId
                                  }`
                                ),
                                ctx.triggerRefresh,
                              ]),
                              setScalar(`ui.editing`, `false`),
                            ],
                            catch: [
                              setScalar(`ui.in_progress`, `false`),
                              setScalar(`ui.failed`, `true`),
                            ],
                          }),
                        ],
                      },
                    }),
                  ],
                }),
              ],
            }),
            ifNode(
              `note is null or note = ''`,
              element("p", {
                styles: styles.emptyNote,
                children: "'No notes here!'",
              }),
              element("p", {
                styles: styles.noteText,
                children: `note`,
              })
            )
          ),
        }),
      ],
    }),
  });
}
