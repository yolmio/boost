import { element, ifNode, state } from "../nodeHelpers.js";
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
} from "../procHelpers.js";
import { createStyles } from "../styleUtils.js";
import { ident } from "../utils/sqlHelpers.js";
import { alert } from "./alert.js";
import { button } from "./button.js";
import { divider } from "./divider.js";
import { iconButton } from "./iconButton.js";
import { materialIcon } from "./materialIcon.js";
import { textarea } from "./textarea.js";
import { typography } from "./typography.js";

export interface NotesCardOpts {
  table: string;
  recordId: string;
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

export function notesCard(opts: NotesCardOpts) {
  return state({
    procedure: [scalar(`editing`, `false`), scalar(`refresh_key`, `0`)],
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
        watch: [`refresh_key`],
        procedure: [
          scalar(
            `note`,
            `(select notes from db.${ident(opts.table)} where id = ${
              opts.recordId
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
                    on: { input: [setScalar(`editing_note`, `target_value`)] },
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
                                  opts.table
                                )} set notes = ui.editing_note where id = ${
                                  opts.recordId
                                }`
                              ),
                              setScalar(`ui.refresh_key`, `ui.refresh_key + 1`),
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
  });
}
