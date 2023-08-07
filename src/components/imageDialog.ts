import { element, ifNode, state } from "../nodeHelpers";
import {
  commitUiChanges,
  exit,
  if_,
  modify,
  scalar,
  serviceProc,
  setScalar,
  try_,
} from "../procHelpers";
import { app } from "../app";
import { createStyles, visuallyHiddenStyles } from "../styleUtils";
import { getUploadStatements, getVariantFromImageSet } from "../utils/image";
import { ident } from "../utils/sqlHelpers";
import { ClientProcStatement, ServiceProcStatement } from "../yom";
import { alert } from "./alert";
import { button } from "./button";
import { divider } from "./divider";
import { iconButton } from "./iconButton";
import { materialIcon } from "./materialIcon";
import { modal, modalDialog } from "./modal";

export interface ImageDialogOptions {
  tableName: string;
  open: string;
  onClose: ClientProcStatement[];
  recordId: string;
  group: string;
  afterReplace?: ServiceProcStatement[];
  afterRemove?: ServiceProcStatement[];
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

export function imageDalog(opts: ImageDialogOptions) {
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
        children: state({
          procedure: [
            scalar(
              `full_img`,
              `(select ${fullImageFieldName} from db.${ident(
                table.name
              )} where id = ${opts.recordId})`
            ),
            scalar(`uploading`, `false`),
            scalar(`deleting`, `false`),
            scalar(`failed_upload`, `false`),
            scalar(`failed_remove`, `false`),
          ],
          children: element("div", {
            styles: styles.dialogRoot,
            children: [
              element("div", {
                children: element("img", {
                  styles: styles.img,
                  props: {
                    src: `'/_a/file/' || sys.account || '/' || sys.app || '/' || full_img`,
                  },
                }),
              }),
              element("div", {
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
                      element("input", {
                        styles: visuallyHiddenStyles,
                        props: {
                          accept: "'image/*'",
                          type: `'file'`,
                        },
                        on: {
                          fileChange: [
                            if_(`uploading`, exit()),
                            setScalar(`uploading`, `true`),
                            commitUiChanges(),
                            ...spawnUploadTasks,
                            try_<ClientProcStatement>({
                              body: [
                                ...joinUploadTasks,
                                serviceProc([
                                  ...updateImagesInDb,
                                  setScalar(
                                    `full_img`,
                                    `uuid_` + fullImageIndex
                                  ),
                                  ...(opts.afterReplace ?? []),
                                ]),
                              ],
                              catch: [setScalar(`failed_upload`, `true`)],
                            }),
                            setScalar(`uploading`, `false`),
                          ],
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
                      click: [
                        setScalar(`deleting`, `true`),
                        commitUiChanges(),
                        try_<ClientProcStatement>({
                          body: [
                            serviceProc([
                              modify(
                                `update db.${ident(
                                  table.name
                                )} set ${setFieldsToNull} where id = ${
                                  opts.recordId
                                }`
                              ),
                              ...(opts.afterRemove ?? []),
                            ]),
                            ...opts.onClose,
                          ],
                          catch: [setScalar(`failed_remove`, `true`)],
                        }),
                        setScalar(`deleting`, `false`),
                      ],
                    },
                    children: `'Remove'`,
                    variant: "outlined",
                    color: "danger",
                    loadingPosition: "start",
                  }),
                  ifNode(
                    `failed_upload`,
                    alert({
                      color: "danger",
                      children: `'Failed to upload image'`,
                    })
                  ),
                  ifNode(
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
