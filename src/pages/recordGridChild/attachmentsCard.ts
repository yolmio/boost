import { nodes } from "../../nodeHelpers";
import { system } from "../../system";
import {
  createStyles,
  flexGrowStyles,
  visuallyHiddenStyles,
} from "../../styleUtils";
import { ident } from "../../utils/sqlHelpers";
import { divider } from "../../components/divider";
import { materialIcon } from "../../components/materialIcon";
import { typography } from "../../components/typography";
import { card } from "../../components/card";
import { Style } from "../../styleTypes";
import { iconButton } from "../../components/iconButton";
import { deleteRecordDialog } from "../../components/deleteRecordDialog";
import { input } from "../../components/input";
import { circularProgress } from "../../components/circularProgress";
import { alert } from "../../components/alert";
import { RecordGridBuilder } from "../recordGrid";

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

export function content(opts: Opts, ctx: RecordGridBuilder) {
  const attachmentTableName = opts.table ?? ctx.table.name + "_attachment";
  const attachmentTable = system.db.tables[attachmentTableName];
  if (!attachmentTable) {
    throw new Error(`Table ${attachmentTableName} does not exist`);
  }
  return nodes.state({
    procedure: (s) =>
      s
        .scalar(`failed_edit`, `false`)
        .scalar(`uploading`, `false`)
        .scalar(`failed_upload`, `false`),
    children: card({
      variant: "outlined",
      styles: opts.styles,
      children: [
        nodes.element("div", {
          styles: styles.header,
          children: [
            typography({
              level: "body-lg",
              startDecorator: materialIcon("Attachment"),
              children: opts.header ?? `'Attachments'`,
            }),
            iconButton({
              tag: "label",
              size: "sm",
              ariaLabel: `'Upload attachment'`,
              children: [
                nodes.element("input", {
                  styles: visuallyHiddenStyles,
                  props: {
                    type: `'file'`,
                  },
                  on: {
                    fileChange: (s) =>
                      s
                        .if(`uploading`, (s) => s.return())
                        .setScalar(`uploading`, `true`)
                        .commitUiTreeChanges()
                        .try({
                          body: (s) =>
                            s
                              .addFile({
                                domUuid: `(select uuid from file)`,
                                fileRecord: `added_file`,
                              })
                              .serviceProc((s) =>
                                s
                                  .startTransaction()
                                  .modify(
                                    `insert into db.${ident(
                                      attachmentTable.name,
                                    )} (name, file, ${ctx.table.name
                                    }) values ((select name from file), added_file.uuid, ${ctx.recordId
                                    })`,
                                  )
                                  .commitTransaction()
                                  .statements(ctx.triggerRefresh),
                              ),
                          catch: (s) =>
                            s.setScalar(`failed_upload`, `true`).spawn({
                              detached: true,
                              procedure: (s) =>
                                s
                                  .delay("4000")
                                  .setScalar(`failed_upload`, `false`)
                                  .commitUiTreeChanges(),
                            }),
                        })
                        .setScalar(`uploading`, `false`),
                  },
                }),
                nodes.if({
                  condition: `uploading`,
                  then: circularProgress({ size: "sm" }),
                  else: materialIcon("Upload"),
                }),
              ],
              variant: "plain",
              color: "primary",
            }),
          ],
        }),
        divider({ styles: styles.divider }),
        nodes.element("div", {
          styles: styles.attachmentsList,
          children: nodes.state({
            watch: [ctx.refreshKey],
            procedure: (s) =>
              s.record(
                "attachment",
                `select id, name, file from db.${ident(
                  attachmentTable.name,
                )} where ${ctx.table.name} = ${ctx.recordId}`,
              ),
            children: nodes.if({
              condition: `exists (select 1 from attachment)`,
              then: nodes.each({
                table: "attachment",
                recordName: "attachment_record",
                children: nodes.state({
                  procedure: (s) =>
                    s.scalar(`deleting`, `false`).scalar(`editing`, `false`),
                  children: nodes.element("div", {
                    styles: styles.attachment,
                    children: [
                      nodes.if({
                        condition: `editing`,
                        then: nodes.state({
                          procedure: (s) =>
                            s
                              .scalar(`new_name`, `attachment_record.name`)
                              .scalar(`submitting`, `false`),
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
                                    input: (s) =>
                                      s.setScalar(`new_name`, `target_value`),
                                    blur: (s) =>
                                      s
                                        .if(
                                          `new_name = attachment_record.name`,
                                          (s) => s.return(),
                                        )
                                        .setScalar(`submitting`, `true`)
                                        .commitUiTreeChanges()
                                        .try({
                                          body: (s) =>
                                            s.serviceProc((s) =>
                                              s
                                                .startTransaction()
                                                .modify(
                                                  `update db.${ident(
                                                    attachmentTable.name,
                                                  )} set name = new_name where id = attachment_record.id`,
                                                )
                                                .commitTransaction()
                                                .statements(ctx.triggerRefresh),
                                            ),
                                          catch: (s) =>
                                            s
                                              .setScalar(`failed_edit`, `true`)
                                              .spawn({
                                                detached: true,
                                                procedure: (s) =>
                                                  s
                                                    .delay("4000")
                                                    .setScalar(
                                                      `failed_edit`,
                                                      `false`,
                                                    )
                                                    .commitUiTreeChanges(),
                                              }),
                                        })
                                        .setScalar(`editing`, `false`),
                                    keydown: (s) =>
                                      s
                                        .if(`event.key = 'Enter'`, (s) =>
                                          s
                                            .setScalar(`submitting`, `true`)
                                            .commitUiTreeChanges()
                                            .try({
                                              body: (s) =>
                                                s.serviceProc((s) =>
                                                  s
                                                    .startTransaction()
                                                    .modify(
                                                      `update db.${ident(
                                                        attachmentTable.name,
                                                      )} set name = new_name where id = attachment_record.id`,
                                                    )
                                                    .commitTransaction()
                                                    .statements(
                                                      ctx.triggerRefresh,
                                                    ),
                                                ),
                                              catch: (s) =>
                                                s
                                                  .setScalar(
                                                    `failed_edit`,
                                                    `true`,
                                                  )
                                                  .spawn({
                                                    detached: true,
                                                    procedure: (s) =>
                                                      s
                                                        .delay("4000")
                                                        .setScalar(
                                                          `failed_edit`,
                                                          `false`,
                                                        )
                                                        .commitUiTreeChanges(),
                                                  }),
                                            })
                                            .setScalar(`editing`, `false`),
                                        )
                                        .if(`event.key = 'Escape'`, (s) =>
                                          s.setScalar(`editing`, `false`),
                                        ),
                                  },
                                },
                              },
                            }),
                            nodes.if(
                              `submitting`,
                              circularProgress({
                                styles: styles.editLoading,
                                size: "sm",
                              }),
                            ),
                          ],
                        }),
                        else: nodes.element("a", {
                          styles: styles.attachmentLink,
                          props: {
                            href: `'/_a/file/' || attachment_record.file`,
                            target: "'_blank'",
                          },
                          children: "attachment_record.name",
                        }),
                      }),
                      nodes.element("div", { styles: flexGrowStyles }),
                      iconButton({
                        href: `'/_a/file/' || attachment_record.file`,
                        props: { download: "attachment_record.name" },
                        variant: "plain",
                        color: "neutral",
                        size: "sm",
                        ariaLabel: `'Download File'`,
                        children: materialIcon("DownloadOutlined"),
                      }),
                      iconButton({
                        variant: "plain",
                        color: "neutral",
                        size: "sm",
                        ariaLabel: `'Edit Attachment'`,
                        children: materialIcon("EditOutlined"),
                        on: {
                          click: (s) => s.setScalar(`editing`, `not editing`),
                        },
                      }),
                      deleteRecordDialog({
                        onClose: (s) => s.setScalar(`deleting`, `false`),
                        open: `deleting`,
                        recordId: `attachment_record.id`,
                        table: attachmentTable.name,
                        afterTransactionCommit: ctx.triggerRefresh,
                      }),
                      iconButton({
                        variant: "plain",
                        color: "neutral",
                        size: "sm",
                        ariaLabel: `'Delete Attachment'`,
                        children: materialIcon("DeleteOutlined"),
                        on: { click: (s) => s.setScalar(`deleting`, `true`) },
                      }),
                    ],
                  }),
                }),
              }),
              else: typography({
                level: "body-sm",
                styles: { fontSize: "md" },
                children: "'No attachments'",
              }),
            }),
          }),
        }),
        nodes.if(
          `failed_upload or failed_edit`,
          nodes.element("div", {
            styles: styles.failureAlert,
            children: alert({
              color: "danger",
              children:
                "case when failed_upload then 'Failed to upload attachment' else 'Failed to edit attachment' end",
              size: "lg",
              startDecorator: materialIcon("Warning"),
            }),
          }),
        ),
      ],
    }),
  });
}
