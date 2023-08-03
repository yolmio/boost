import { each, element, ifNode, state } from "../../nodeHelpers.js";
import {
  addFile,
  commitUiChanges,
  delay,
  exit,
  if_,
  modify,
  record,
  scalar,
  serviceProc,
  setScalar,
  spawn,
  try_,
} from "../../procHelpers.js";
import { app } from "../../singleton.js";
import {
  createStyles,
  flexGrowStyles,
  visuallyHiddenStyles,
} from "../../styleUtils.js";
import { ident } from "../../utils/sqlHelpers.js";
import { divider } from "../../components/divider.js";
import { materialIcon } from "../../components/materialIcon.js";
import { typography } from "../../components/typography.js";
import { card } from "../../components/card.js";
import { Style } from "../../styleTypes.js";
import { RecordGridContext } from "./shared.js";
import { iconButton } from "../../components/iconButton.js";
import { ClientProcStatement } from "../../yom.js";
import { deleteRecordDialog } from "../../components/deleteRecordDialog.js";
import { input } from "../../components/input.js";
import { circularProgress } from "../../components/circularProgress.js";
import { alert } from "../../components/alert.js";

export const name = "attachmentsCard";

export interface Opts {
  styles?: Style;
  header?: string;
  table?: string;
}

const styles = createStyles({
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    pb: 1.5,
  },
  divider: {
    mb: 1.5,
  },
  failureAlert: {
    position: "fixed",
    bottom: 16,
    left: 16,
    zIndex: 1000,
  },
  attachmentsList: {
    display: "flex",
    flexDirection: "column",
  },
  attachment: {
    display: "flex",
    alignItems: "center",
    "&:not(:last-child)": {
      mb: 1,
      pb: 1,
      borderBottom: "1px solid",
      borderColor: "divider",
    },
  },
  attachmentLink: {
    color: "primary-500",
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
  editLoading: {
    ml: 1,
  },
});

export function content(opts: Opts, ctx: RecordGridContext) {
  const attachmentTableName = opts.table ?? ctx.table.name + "_attachment";
  const attachmentTable = app.database.tables[attachmentTableName];
  if (!attachmentTable) {
    throw new Error(`Table ${attachmentTableName} does not exist`);
  }
  return state({
    procedure: [
      scalar(`failed_edit`, `false`),
      scalar(`uploading`, `false`),
      scalar(`failed_upload`, `false`),
    ],
    children: card({
      variant: "outlined",
      styles: opts.styles,
      children: [
        element("div", {
          styles: styles.header,
          children: [
            typography({
              level: "h6",
              startDecorator: materialIcon("Attachment"),
              children: opts.header ?? `'Attachments'`,
            }),
            iconButton({
              tag: "label",
              size: "sm",
              children: [
                element("input", {
                  styles: visuallyHiddenStyles,
                  props: {
                    type: `'file'`,
                  },
                  on: {
                    fileChange: [
                      if_(`uploading`, exit()),
                      setScalar(`uploading`, `true`),
                      commitUiChanges(),
                      try_<ClientProcStatement>({
                        body: [
                          addFile({
                            domUuid: `(select uuid from file)`,
                            fileRecord: `added_file`,
                          }),
                          serviceProc([
                            modify(
                              `insert into db.${ident(
                                attachmentTable.name
                              )} (name, file, ${
                                ctx.table.name
                              }) values ((select name from file), added_file.uuid, ${
                                ctx.recordId
                              })`
                            ),
                            ctx.triggerRefresh,
                          ]),
                        ],
                        catch: [
                          setScalar(`failed_upload`, `true`),
                          spawn({
                            detached: true,
                            statements: [
                              delay("4000"),
                              setScalar(`failed_upload`, `false`),
                              commitUiChanges(),
                            ],
                          }),
                        ],
                      }),
                      setScalar(`uploading`, `false`),
                    ],
                  },
                }),
                ifNode(
                  `uploading`,
                  circularProgress({ size: "sm" }),
                  materialIcon({
                    name: "Upload",
                    title: "'Upload Attachment'",
                  })
                ),
              ],
              variant: "plain",
              color: "primary",
            }),
          ],
        }),
        divider({ styles: styles.divider }),
        element("div", {
          styles: styles.attachmentsList,
          children: state({
            watch: [ctx.refreshKey],
            procedure: [
              record(
                "attachment",
                `select id, name, file from db.${ident(
                  attachmentTable.name
                )} where ${ctx.table.name} = ${ctx.recordId}`
              ),
            ],
            children: ifNode(
              `exists (select 1 from attachment)`,
              each({
                table: "attachment",
                recordName: "attachment_record",
                children: state({
                  procedure: [
                    scalar(`deleting`, `false`),
                    scalar(`editing`, `false`),
                  ],
                  children: element("div", {
                    styles: styles.attachment,
                    children: [
                      ifNode(
                        `editing`,
                        state({
                          procedure: [
                            scalar(`new_name`, `attachment_record.name`),
                            scalar(`submitting`, `false`),
                          ],
                          children: [
                            input({
                              size: "sm",
                              styles: flexGrowStyles,
                              slots: {
                                input: {
                                  props: {
                                    value: `new_name`,
                                    yolmFocusKey: `true`,
                                  },
                                  on: {
                                    input: [
                                      setScalar(`new_name`, `target_value`),
                                    ],
                                    blur: [
                                      if_(`new_name = attachment_record.name`, [
                                        exit(),
                                      ]),
                                      setScalar(`submitting`, `true`),
                                      commitUiChanges(),
                                      try_<ClientProcStatement>({
                                        body: [
                                          serviceProc([
                                            modify(
                                              `update db.${ident(
                                                attachmentTable.name
                                              )} set name = new_name where id = attachment_record.id`
                                            ),
                                            ctx.triggerRefresh,
                                          ]),
                                        ],
                                        catch: [
                                          setScalar(`failed_edit`, `true`),
                                          spawn({
                                            detached: true,
                                            statements: [
                                              delay("4000"),
                                              setScalar(`failed_edit`, `false`),
                                              commitUiChanges(),
                                            ],
                                          }),
                                        ],
                                      }),
                                      setScalar(`editing`, `false`),
                                    ],
                                    keydown: [
                                      if_(`event.key = 'Enter'`, [
                                        setScalar(`submitting`, `true`),
                                        commitUiChanges(),
                                        try_<ClientProcStatement>({
                                          body: [
                                            serviceProc([
                                              modify(
                                                `update db.${ident(
                                                  attachmentTable.name
                                                )} set name = new_name where id = attachment_record.id`
                                              ),
                                              ctx.triggerRefresh,
                                            ]),
                                          ],
                                          catch: [
                                            setScalar(`failed_edit`, `true`),
                                            spawn({
                                              detached: true,
                                              statements: [
                                                delay("4000"),
                                                setScalar(
                                                  `failed_edit`,
                                                  `false`
                                                ),
                                                commitUiChanges(),
                                              ],
                                            }),
                                          ],
                                        }),
                                        setScalar(`editing`, `false`),
                                      ]),
                                      if_(`event.key = 'Escape'`, [
                                        setScalar(`editing`, `false`),
                                      ]),
                                    ],
                                  },
                                },
                              },
                            }),
                            ifNode(
                              `submitting`,
                              circularProgress({
                                styles: styles.editLoading,
                                size: "sm",
                              })
                            ),
                          ],
                        }),
                        element("a", {
                          styles: styles.attachmentLink,
                          props: {
                            href: `'/_a/file/' || sys.account || '/' || sys.app || '/' || attachment_record.file`,
                            target: "'_blank'",
                          },
                          children: "attachment_record.name",
                        })
                      ),
                      element("div", { styles: flexGrowStyles }),
                      iconButton({
                        href: `'/_a/file/' || sys.account || '/' || sys.app || '/' || attachment_record.file`,
                        props: { download: "attachment_record.name" },
                        variant: "plain",
                        color: "neutral",
                        size: "sm",
                        children: materialIcon({
                          name: "DownloadOutlined",
                          title: "'Download'",
                        }),
                      }),
                      iconButton({
                        variant: "plain",
                        color: "neutral",
                        size: "sm",
                        children: materialIcon({
                          name: "EditOutlined",
                          title: "'Edit'",
                        }),
                        on: { click: [setScalar(`editing`, `not editing`)] },
                      }),
                      deleteRecordDialog({
                        onClose: [setScalar(`deleting`, `false`)],
                        open: `deleting`,
                        recordId: `attachment_record.id`,
                        table: attachmentTable.name,
                        afterDeleteService: [ctx.triggerRefresh],
                      }),
                      iconButton({
                        variant: "plain",
                        color: "neutral",
                        size: "sm",
                        children: materialIcon({
                          name: "DeleteOutlined",
                          title: "'Delete'",
                        }),
                        on: { click: [setScalar(`deleting`, `true`)] },
                      }),
                    ],
                  }),
                }),
              }),
              typography({
                level: "body2",
                styles: { fontSize: "md" },
                children: "'No attachments'",
              })
            ),
          }),
        }),
        ifNode(
          `failed_upload or failed_edit`,
          element("div", {
            styles: styles.failureAlert,
            children: alert({
              color: "danger",
              children:
                "case when failed_upload then 'Failed to upload attachment' else 'Failed to edit attachment' end",
              size: "lg",
              startDecorator: materialIcon("Warning"),
            }),
          })
        ),
      ],
    }),
  });
}
