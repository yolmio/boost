import { nodes } from "../nodeHelpers";
import { app } from "../app";
import { createStyles, visuallyHiddenStyles } from "../styleUtils";
import { getUploadStatements, getVariantFromImageSet } from "../utils/image";
import { ident } from "../utils/sqlHelpers";
import * as yom from "../yom";
import { alert } from "./alert";
import { button } from "./button";
import { divider } from "./divider";
import { iconButton } from "./iconButton";
import { materialIcon } from "./materialIcon";
import { modal, modalDialog } from "./modal";
import { DomStatementsOrFn, ServiceStatementsOrFn } from "../statements";

export interface ImageDialogOptions {
  tableName: string;
  open: string;
  onClose: DomStatementsOrFn;
  recordId: yom.SqlExpression;
  group: string;
  afterReplace?: ServiceStatementsOrFn;
  afterRemove?: ServiceStatementsOrFn;
}

const styles = createStyles({
  dialogRoot: {
    display: "flex",
    gap: 1.5,
    flexDirection: "column-reverse",
    maxWidth: "calc(100vw - 32px)",
    lg: { flexDirection: "row" },
  },
  img: {
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100vh - 98px)",
    minHeight: 50,
    width: "100%",
    border: "1px solid",
    borderColor: "divider",
    lg: {
      maxWidth: "calc(100vw - 32px - 132px)",
      maxHeight: "calc(100vh - 48px)",
    },
  },
  actionsWrapper: {
    display: "flex",
    gap: 1,
    alignItems: "center",
    lg: { flexDirection: "column" },
  },
  closeButton: {
    order: 5,
    ml: "auto",
    justifySelf: "flex-end",
    lg: {
      ml: "auto",
      order: "initial",
      justifySelf: "inherit",
      alignSelf: "flex-end",
    },
  },
  divider: {
    display: "none",
    lg: { display: "block" },
  },
  replaceButton: () => ({ "&:focus-within": app.theme.focus.default }),
});

export function imageDialog(opts: ImageDialogOptions) {
  const table = app.db.tables[opts.tableName];
  const fieldGroup = table.fieldGroups[opts.group];
  if (fieldGroup.type !== "Image") {
    throw new Error("Invalid field group type for image dialog");
  }
  const fullImageFieldName = getVariantFromImageSet(fieldGroup, "dialog_full", [
    "general_full",
  ]);
  if (!fullImageFieldName) {
    throw new Error("Image dialog requires a full image variant");
  }
  const fullImageIndex = Object.keys(fieldGroup.variants).indexOf(
    fullImageFieldName
  );
  const { spawnUploadTasks, joinUploadTasks, updateImagesInDb } =
    getUploadStatements(opts.tableName, opts.recordId, fieldGroup);
  const setFieldsToNull = Object.keys(fieldGroup.variants)
    .map((fieldName) => ident(fieldName) + " = null")
    .join(",");
  return modal({
    open: opts.open,
    onClose: opts.onClose,
    children: () =>
      modalDialog({
        children: nodes.state({
          procedure: (s) =>
            s
              .scalar(
                `full_img`,
                `(select ${fullImageFieldName} from db.${ident(
                  table.name
                )} where id = ${opts.recordId})`
              )
              .scalar(`uploading`, `false`)
              .scalar(`deleting`, `false`)
              .scalar(`failed_upload`, `false`)
              .scalar(`failed_remove`, `false`),
          children: nodes.element("div", {
            styles: styles.dialogRoot,
            children: [
              nodes.element("div", {
                children: nodes.element("img", {
                  styles: styles.img,
                  props: {
                    src: `'/_a/file/' || sys.account || '/' || sys.app || '/' || full_img`,
                  },
                }),
              }),
              nodes.element("div", {
                styles: styles.actionsWrapper,
                children: [
                  iconButton({
                    styles: styles.closeButton,
                    children: materialIcon("Close"),
                    color: "neutral",
                    variant: "plain",
                    size: "sm",
                    on: { click: opts.onClose },
                  }),
                  divider({ styles: styles.divider, inset: "none" }),
                  button({
                    tag: "label",
                    size: "sm",
                    startDecorator: materialIcon("Upload"),
                    styles: styles.replaceButton(),
                    children: [
                      nodes.element("input", {
                        styles: visuallyHiddenStyles,
                        props: {
                          accept: "'image/*'",
                          type: `'file'`,
                        },
                        on: {
                          fileChange: (s) =>
                            s
                              .if(`uploading`, (s) => s.return())
                              .setScalar(`uploading`, `true`)
                              .commitUiChanges()
                              .statements(spawnUploadTasks)
                              .try({
                                body: (s) =>
                                  s
                                    .statements(joinUploadTasks)
                                    .serviceProc((s) =>
                                      s
                                        .startTransaction()
                                        .statements(updateImagesInDb)
                                        .commitTransaction()
                                        .setScalar(
                                          `full_img`,
                                          `uuid_` + fullImageIndex
                                        )
                                        .statements(opts.afterReplace)
                                    ),
                                catch: (s) =>
                                  s.setScalar(`failed_upload`, `true`),
                              })
                              .setScalar(`uploading`, `false`),
                        },
                      }),
                      `'Replace'`,
                    ],
                    variant: "outlined",
                    color: "neutral",
                    loading: `uploading`,
                    loadingPosition: "start",
                  }),
                  button({
                    startDecorator: materialIcon("Delete"),
                    loading: `deleting`,
                    size: "sm",
                    on: {
                      click: (s) =>
                        s
                          .setScalar(`deleting`, `true`)
                          .commitUiChanges()
                          .try({
                            body: (s) =>
                              s.serviceProc((s) =>
                                s
                                  .startTransaction()
                                  .modify(
                                    `update db.${ident(
                                      table.name
                                    )} set ${setFieldsToNull} where id = ${
                                      opts.recordId
                                    }`
                                  )
                                  .commitTransaction()
                                  .statements(opts.afterRemove)
                              ),
                            ...opts.onClose,
                            catch: (s) => s.setScalar(`failed_remove`, `true`),
                          })
                          .setScalar(`deleting`, `false`),
                    },
                    children: `'Remove'`,
                    variant: "outlined",
                    color: "danger",
                    loadingPosition: "start",
                  }),
                  nodes.if(
                    `failed_upload`,
                    alert({
                      color: "danger",
                      children: `'Failed to upload image'`,
                    })
                  ),
                  nodes.if(
                    `failed_remove`,
                    alert({
                      color: "danger",
                      children: `'Failed to remove image'`,
                    })
                  ),
                ],
              }),
            ],
          }),
        }),
      }),
  });
}
