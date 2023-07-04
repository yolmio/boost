import { each, element, ifNode, sourceMap, state } from "../../nodeHelpers.js";
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
} from "../../procHelpers.js";
import { createStyles, flexGrowStyles } from "../../styleUtils.js";
import { alert } from "../../components/alert.js";
import { button } from "../../components/button.js";
import { deleteRecordDialog } from "../../components/deleteRecordDialog.js";
import { divider } from "../../components/divider.js";
import { formControl } from "../../components/formControl.js";
import { formLabel } from "../../components/formLabel.js";
import { iconButton } from "../../components/iconButton.js";
import { input } from "../../components/input.js";
import { materialIcon } from "../../components/materialIcon.js";
import { textarea } from "../../components/textarea.js";
import { typography } from "../../components/typography.js";
import { RecordGridContext } from "./shared.js";
import { model } from "../../singleton.js";
import { card } from "../../components/card.js";
import { Style } from "../../styleTypes.js";

export const name = "notesListCard";

export interface Opts {
  styles?: Style;
  foreignKeyField?: string;
  notesTable?: string;
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

export function content(opts: Opts, ctx: RecordGridContext) {
  let foreignKeyField = opts.foreignKeyField;
  const notesTable = opts.notesTable ?? ctx.table.name + "_note";
  if (!foreignKeyField) {
    const notesTableModel = model.database.tables[notesTable];
    if (!notesTableModel) {
      throw new Error(`No notes table found for ${notesTable}`);
    }
    const fkField = Object.values(notesTableModel.fields).find(
      (f) => f.type === "ForeignKey" && f.table === ctx.table.name
    );
    if (!fkField) {
      throw new Error(
        `No foreign key field found for ${notesTable} to ${ctx.table.name}`
      );
    }
    foreignKeyField = fkField.name;
  }
  return sourceMap(
    "notesListCard",
    card({
      variant: "outlined",
      styles: opts.styles,
      children: state({
        procedure: [scalar(`adding`, `false`)],
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
                color: "primary",
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
                                    `insert into db.${notesTable} (content, date, ${foreignKeyField}) values (ui.content, current_date(), ${ctx.recordId})`
                                  ),
                                  ctx.triggerRefresh,
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
            watch: [ctx.refreshKey],
            procedure: [
              table(
                `note`,
                `select content, date, id from db.${notesTable} where ${foreignKeyField} = ${ctx.recordId} order by date desc, id desc`
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
                                          props: {
                                            type: `'date'`,
                                            value: `date`,
                                          },
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
                                        click: [
                                          setScalar(`ui.editing`, `false`),
                                        ],
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
                                                  `update db.${notesTable} set content = ui.content, date = ui.date where id = note_record.id`
                                                ),
                                                ctx.triggerRefresh,
                                              ]),
                                              setScalar(`ui.editing`, `false`),
                                            ],
                                            catch: [
                                              setScalar(`failed`, `true`),
                                            ],
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
                                    children: `format.date(note_record.date, '%-d %b %Y')`,
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
                          table: notesTable,
                          recordId: `note_record.id`,
                          afterDeleteService: [ctx.triggerRefresh],
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
      }),
    })
  );
}
