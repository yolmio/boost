import { nodes } from "../../nodeHelpers";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { alert } from "../../components/alert";
import { button } from "../../components/button";
import { deleteRecordDialog } from "../../components/deleteRecordDialog";
import { divider } from "../../components/divider";
import { formControl } from "../../components/formControl";
import { formLabel } from "../../components/formLabel";
import { iconButton } from "../../components/iconButton";
import { input } from "../../components/input";
import { materialIcon } from "../../components/materialIcon";
import { textarea } from "../../components/textarea";
import { typography } from "../../components/typography";
import { app } from "../../app";
import { card } from "../../components/card";
import { Style } from "../../styleTypes";
import { RecordGridBuilder } from "../recordGrid";
import { createUndoSnackbars } from "../../components/undoSnackbars";

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

export function content(opts: Opts, ctx: RecordGridBuilder) {
  let foreignKeyField = opts.foreignKeyField;
  const notesTable = opts.notesTable ?? ctx.table.name + "_note";
  if (!foreignKeyField) {
    const notesTableModel = app.db.tables[notesTable];
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
  const undoSnackbars = createUndoSnackbars({
    successSnackbarContent: `'Deleted note'`,
    afterUndo: ctx.triggerRefresh,
  });
  return nodes.sourceMap(
    "notesListCard",
    undoSnackbars.wrap(
      card({
        variant: "outlined",
        styles: opts.styles,
        children: nodes.state({
          procedure: (s) => s.scalar(`adding`, `false`),
          children: [
            nodes.element("div", {
              styles: styles.header,
              children: [
                typography({
                  level: "body-lg",
                  children: `'Notes'`,
                }),
                iconButton({
                  variant: "plain",
                  color: "primary",
                  size: "sm",
                  children: nodes.if({
                    condition: `adding`,
                    then: materialIcon("Close"),
                    else: materialIcon("Add"),
                  }),
                  on: {
                    click: (s) => s.setScalar(`ui.adding`, `not ui.adding`),
                  },
                }),
              ],
            }),
            divider(),
            nodes.if(
              `adding`,
              nodes.state({
                procedure: (s) =>
                  s
                    .scalar(`content`, `''`)
                    .scalar(`in_progress`, `false`)
                    .scalar(`failed`, `false`),
                children: nodes.element("div", {
                  styles: styles.addingForm,
                  children: [
                    textarea({
                      slots: {
                        textarea: {
                          props: { value: `content`, yolmFocusKey: `true` },
                          on: {
                            input: (s) =>
                              s.setScalar(`ui.content`, `target_value`),
                          },
                        },
                      },
                    }),
                    nodes.if(
                      `failed`,
                      alert({
                        styles: styles.addingError,
                        color: "danger",
                        children: `'Unable to add note at this time'`,
                      })
                    ),
                    nodes.element("div", {
                      styles: styles.addingButtons,
                      children: [
                        button({
                          children: "'Add note'",
                          loading: `in_progress`,
                          on: {
                            click: (s) =>
                              s
                                .if(`in_progress`, (s) => s.return())
                                .setScalar(`in_progress`, `true`)
                                .setScalar(`failed`, `false`)
                                .commitUiTreeChanges()
                                .try({
                                  body: (s) =>
                                    s
                                      .serviceProc((s) =>
                                        s
                                          .startTransaction()
                                          .modify(
                                            `insert into db.${notesTable} (content, date, ${foreignKeyField}) values (ui.content, current_date(), ${ctx.recordId})`
                                          )
                                          .commitTransaction()
                                          .statements(ctx.triggerRefresh)
                                      )
                                      .setScalar(`ui.adding`, `false`),
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
              })
            ),
            nodes.state({
              watch: [ctx.refreshKey],
              procedure: (s) =>
                s.table(
                  `note`,
                  `select content, date, id from db.${notesTable} where ${foreignKeyField} = ${ctx.recordId} order by date desc, id desc`
                ),
              children: nodes.if({
                condition: `exists (select id from note)`,
                then: nodes.element("div", {
                  styles: styles.notes,
                  children: nodes.each({
                    table: `note`,
                    recordName: `note_record`,
                    key: `id`,
                    children: [
                      nodes.if(`note_record.iteration_index != 0`, divider()),
                      nodes.state({
                        procedure: (s) =>
                          s
                            .scalar(`deleting`, `false`)
                            .scalar(`editing`, `false`),
                        children: [
                          nodes.if({
                            condition: `editing`,
                            then: nodes.state({
                              procedure: (s) =>
                                s
                                  .scalar(`content`, `note_record.content`)
                                  .scalar(`date`, `note_record.date`)
                                  .scalar(`in_progress`, `false`)
                                  .scalar(`failed`, `false`),
                              children: nodes.element("div", {
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
                                          input: (s) =>
                                            s.if(
                                              `try_cast(target_value as date) is not null`,
                                              (s) =>
                                                s.setScalar(
                                                  `ui.date`,
                                                  `cast(target_value as date)`
                                                )
                                            ),
                                        },
                                      }),
                                    ],
                                  }),
                                  textarea({
                                    slots: {
                                      textarea: { props: { value: `content` } },
                                    },
                                    on: {
                                      input: (s) =>
                                        s.setScalar(
                                          `ui.content`,
                                          `target_value`
                                        ),
                                    },
                                  }),
                                  nodes.if(
                                    `failed`,
                                    alert({
                                      styles: styles.editingError,
                                      color: "danger",
                                      children: `'Unable to edit note at this time'`,
                                    })
                                  ),
                                  nodes.element("div", {
                                    styles: styles.editButtons,
                                    children: [
                                      button({
                                        variant: "soft",
                                        color: "neutral",
                                        children: `'Cancel'`,
                                        on: {
                                          click: (s) =>
                                            s.setScalar(`ui.editing`, `false`),
                                        },
                                      }),
                                      button({
                                        children: `'Confirm changes'`,
                                        loading: `in_progress`,
                                        on: {
                                          click: (s) =>
                                            s
                                              .if(`in_progress`, (s) =>
                                                s.return()
                                              )
                                              .setScalar(
                                                `ui.in_progress`,
                                                `true`
                                              )
                                              .setScalar(`ui.failed`, `false`)
                                              .commitUiTreeChanges()
                                              .try({
                                                body: (s) =>
                                                  s
                                                    .serviceProc((s) =>
                                                      s
                                                        .startTransaction()
                                                        .modify(
                                                          `update db.${notesTable} set content = ui.content, date = ui.date where id = note_record.id`
                                                        )
                                                        .commitTransaction()
                                                        .statements(
                                                          ctx.triggerRefresh
                                                        )
                                                    )
                                                    .setScalar(
                                                      `ui.editing`,
                                                      `false`
                                                    ),
                                                catch: (s) =>
                                                  s.setScalar(`failed`, `true`),
                                              }),
                                        },
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            }),
                            else: nodes.element("div", {
                              styles: styles.note,
                              children: [
                                nodes.element("div", {
                                  styles: styles.noteHeader,
                                  children: [
                                    nodes.element("p", {
                                      styles: styles.noteDate,
                                      children: `format.date(note_record.date, '%-d %b %Y')`,
                                    }),
                                    nodes.element("div", {
                                      styles: flexGrowStyles,
                                    }),
                                    iconButton({
                                      color: "neutral",
                                      variant: "plain",
                                      size: "sm",
                                      children: materialIcon("EditOutlined"),
                                      on: {
                                        click: (s) =>
                                          s.setScalar(`ui.editing`, `true`),
                                      },
                                    }),
                                    iconButton({
                                      color: "neutral",
                                      variant: "plain",
                                      size: "sm",
                                      children: materialIcon("DeleteOutlined"),
                                      on: {
                                        click: (s) =>
                                          s.setScalar(`ui.deleting`, `true`),
                                      },
                                    }),
                                  ],
                                }),
                                nodes.element("p", {
                                  styles: styles.noteContent,
                                  children: `note_record.content`,
                                }),
                              ],
                            }),
                          }),
                          deleteRecordDialog({
                            open: `ui.deleting`,
                            onClose: (s) => s.setScalar(`ui.deleting`, `false`),
                            table: notesTable,
                            recordId: `note_record.id`,
                            afterTransactionCommit: ctx.triggerRefresh,
                            beforeTransactionCommit: undoSnackbars.setUndoTx(),
                            afterDeleteClient: undoSnackbars.openSuccess,
                          }),
                        ],
                      }),
                    ],
                  }),
                }),
                else: nodes.element("p", {
                  styles: styles.emptyText,
                  children: `'No notes'`,
                }),
              }),
            }),
          ],
        }),
      })
    )
  );
}
