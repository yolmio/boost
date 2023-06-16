import { each, element, ifNode, state } from "../nodeHelpers.js";
import {
  commitUiChanges,
  exit,
  if_,
  modify,
  scalar,
  serviceProc,
  setScalar,
  table,
  try_,
} from "../procHelpers.js";
import { createStyles, flexGrowStyles } from "../styleUtils.js";
import { alert } from "./alert.js";
import { button } from "./button.js";
import { deleteRecordDialog } from "./deleteRecordDialog.js";
import { divider } from "./divider.js";
import { formControl } from "./formControl.js";
import { formLabel } from "./formLabel.js";
import { iconButton } from "./iconButton.js";
import { input } from "./input.js";
import { materialIcon } from "./materialIcon.js";
import { textarea } from "./textarea.js";
import { typography } from "./typography.js";

export interface NotesListCardOpts {
  foreignKey: string;
  foreignKeyField: string;
  notesTable: string;
}

const styles = createStyles({
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    pb: 1.5,
  },
  addingForm: {
    mt: 1,
  },
  addingButtons: {
    my: 1,
    display: "flex",
    justifyContent: "flex-end",
  },
  addingError: {
    mt: 1,
  },
  emptyText: {
    color: "text-secondary",
    fontSize: "lg",
    my: 2,
  },
  notes: {
    display: "flex",
    flexDirection: "column",
    maxHeight: 400,
    overflowY: "auto",
    overflowX: "hidden",
    pt: 2,
    gap: 2,
  },
  editing: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  editingError: {
    my: 1,
  },
  editButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 1,
  },
  note: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  noteHeader: {
    display: "flex",
    alignItems: "center",
  },
  noteDate: {
    color: "text-secondary",
    my: 0,
  },
  noteContent: {
    whiteSpace: "pre-wrap",
    my: 0,
  },
});

export function notesListCard(opts: NotesListCardOpts) {
  return state({
    procedure: [scalar(`refresh_key`, `0`), scalar(`adding`, `false`)],
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
            color: "info",
            size: "sm",
            children: ifNode(
              `adding`,
              materialIcon("Close"),
              materialIcon("Add")
            ),
            on: { click: [setScalar(`ui.adding`, `not ui.adding`)] },
          }),
        ],
      }),
      divider(),
      ifNode(
        `adding`,
        state({
          procedure: [
            scalar(`content`, `''`),
            scalar(`in_progress`, `false`),
            scalar(`failed`, `false`),
          ],
          children: element("div", {
            styles: styles.addingForm,
            children: [
              textarea({
                slots: {
                  textarea: {
                    props: { value: `content`, yolmFocusKey: `true` },
                    on: {
                      input: [setScalar(`ui.content`, `target_value`)],
                    },
                  },
                },
              }),
              ifNode(
                `failed`,
                alert({
                  styles: styles.addingError,
                  color: "danger",
                  children: `'Unable to add note at this time'`,
                })
              ),
              element("div", {
                styles: styles.addingButtons,
                children: [
                  button({
                    children: "'Add note'",
                    loading: `in_progress`,
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
                                `insert into db.${opts.notesTable} (content, date, ${opts.foreignKeyField}) values (ui.content, current_date(), ${opts.foreignKey})`
                              ),
                              setScalar(`ui.refresh_key`, `ui.refresh_key + 1`),
                            ]),
                            setScalar(`ui.adding`, `false`),
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
        })
      ),
      state({
        watch: [`refresh_key`],
        procedure: [
          table(
            `note`,
            `select content, date, id from db.${opts.notesTable} where ${opts.foreignKeyField} = ${opts.foreignKey} order by date desc, id desc`
          ),
        ],
        children: ifNode(
          `exists (select id from note)`,
          element("div", {
            styles: styles.notes,
            children: each({
              table: `note`,
              recordName: `note_record`,
              key: `id`,
              children: [
                ifNode(`note_record.iteration_index != 0`, divider()),
                state({
                  procedure: [
                    scalar(`deleting`, `false`),
                    scalar(`editing`, `false`),
                  ],
                  children: [
                    ifNode(
                      `editing`,
                      state({
                        procedure: [
                          scalar(`content`, `note_record.content`),
                          scalar(`date`, `note_record.date`),
                          scalar(`in_progress`, `false`),
                          scalar(`failed`, `false`),
                        ],
                        children: element("div", {
                          styles: styles.editing,
                          children: [
                            formControl({
                              children: [
                                formLabel({
                                  children: `'Date'`,
                                }),
                                input({
                                  slots: {
                                    input: {
                                      props: { type: `'date'`, value: `date` },
                                    },
                                  },
                                  on: {
                                    input: [
                                      if_(
                                        `try_cast(target_value as date) is not null`,
                                        [
                                          setScalar(
                                            `ui.date`,
                                            `cast(target_value as date)`
                                          ),
                                        ]
                                      ),
                                    ],
                                  },
                                }),
                              ],
                            }),
                            textarea({
                              slots: {
                                textarea: { props: { value: `content` } },
                              },
                              on: {
                                input: [
                                  setScalar(`ui.content`, `target_value`),
                                ],
                              },
                            }),
                            ifNode(
                              `failed`,
                              alert({
                                styles: styles.editingError,
                                color: "danger",
                                children: `'Unable to edit note at this time'`,
                              })
                            ),
                            element("div", {
                              styles: styles.editButtons,
                              children: [
                                button({
                                  variant: "soft",
                                  color: "neutral",
                                  children: `'Cancel'`,
                                  on: {
                                    click: [setScalar(`ui.editing`, `false`)],
                                  },
                                }),
                                button({
                                  children: `'Confirm changes'`,
                                  loading: `in_progress`,
                                  on: {
                                    click: [
                                      if_(`in_progress`, exit()),
                                      setScalar(`ui.in_progress`, `true`),
                                      setScalar(`ui.failed`, `false`),
                                      commitUiChanges(),
                                      try_({
                                        body: [
                                          serviceProc([
                                            modify(
                                              `update db.${opts.notesTable} set content = ui.content, date = ui.date where id = note_record.id`
                                            ),
                                            setScalar(
                                              `ui.refresh_key`,
                                              `ui.refresh_key + 1`
                                            ),
                                          ]),
                                          setScalar(`ui.editing`, `false`),
                                        ],
                                        catch: [setScalar(`failed`, `true`)],
                                      }),
                                    ],
                                  },
                                }),
                              ],
                            }),
                          ],
                        }),
                      }),
                      element("div", {
                        styles: styles.note,
                        children: [
                          element("div", {
                            styles: styles.noteHeader,
                            children: [
                              element("p", {
                                styles: styles.noteDate,
                                children: `date.format(note_record.date, '%-d %b %Y')`,
                              }),
                              element("div", { styles: flexGrowStyles }),
                              iconButton({
                                color: "neutral",
                                variant: "plain",
                                size: "sm",
                                children: materialIcon("EditOutlined"),
                                on: {
                                  click: [setScalar(`ui.editing`, `true`)],
                                },
                              }),
                              iconButton({
                                color: "neutral",
                                variant: "plain",
                                size: "sm",
                                children: materialIcon("DeleteOutlined"),
                                on: {
                                  click: [setScalar(`ui.deleting`, `true`)],
                                },
                              }),
                            ],
                          }),
                          element("p", {
                            styles: styles.noteContent,
                            children: `note_record.content`,
                          }),
                        ],
                      })
                    ),
                    deleteRecordDialog({
                      open: `ui.deleting`,
                      onClose: [setScalar(`ui.deleting`, `false`)],
                      table: opts.notesTable,
                      recordId: `note_record.id`,
                      afterDeleteService: [
                        setScalar(`ui.refresh_key`, `ui.refresh_key + 1`),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          }),
          element("p", {
            styles: styles.emptyText,
            children: `'No notes'`,
          })
        ),
      }),
    ],
  });
}
