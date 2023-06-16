import { Field } from "../modelTypes.js";
import { element, ifNode, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import {
  addImage,
  commitTransaction,
  commitUiChanges,
  debugExpr,
  delay,
  exit,
  if_,
  joinTasks,
  modify,
  navigate,
  record,
  scalar,
  serviceProc,
  setScalar,
  spawn,
  startTransaction,
  try_,
} from "../procHelpers.js";
import { model } from "../singleton.js";
import {
  createStyles,
  displayNoneStyles,
  flexGrowStyles,
} from "../styleUtils.js";
import { pluralize } from "../utils/inflectors.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { ClientProcStatement } from "../yom.js";
import { alert } from "./alert.js";
import { button } from "./button.js";
import { chip } from "./chip.js";
import { confirmDangerDialog } from "./confirmDangerDialog.js";
import { deleteRecordDialog } from "./deleteRecordDialog.js";
import { materialIcon } from "./materialIcon.js";
import { modal, modalDialog } from "./modal.js";
import { typography } from "./typography.js";
import { getUniqueUiId } from "./utils.js";

export interface KeyRecordInfoCardOpts {
  table: string;
  recordId: string;
  picture?: {
    thumbnailField?: string;
    fullField?: string;
  };
  chipFields?: string[];
  fields: string[];
  editUrl?: string;
}

function getFieldValue(field: Field): Node {
  const fieldSql = `record.${field.name.name}`;
  if (field.type === "Bool" && field.enumLike) {
    const trueStr = stringLiteral(field.enumLike.true);
    const falseStr = stringLiteral(field.enumLike.false);
    if (field.enumLike.null) {
      const nullStr = stringLiteral(field.enumLike.null);
      return `case when ${fieldSql} is null then ${nullStr} when ${fieldSql} then ${trueStr} else ${falseStr} end`;
    }
    return `case when ${fieldSql} then ${trueStr} else ${falseStr} end`;
  }
  if (field.type === "Enum") {
    return `dt.display_${field.enum}(${fieldSql})`;
  }
  if (field.type === "Date" && field.formatString) {
    return `date.format(${fieldSql}, ${stringLiteral(field.formatString)})`;
  }
  return fieldSql;
}

const pictureInputId = stringLiteral(getUniqueUiId());

const styles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    sm: { flexDirection: "row" },
  },
  infoSection: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  header: {
    mb: 0.5,
  },
  buttons: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    gap: 1,
  },
  chips: {
    display: "flex",
    gap: 1,
    mb: 0.5,
  },
  field: {
    fontSize: "md",
    my: 0,
  },
  fieldLabel: {
    mr: 0.5,
    color: "text-secondary",
  },
  fieldValue: {
    fontWeight: "lg",
  },
  imgWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  img: {
    maxHeight: 240,
    maxWidth: 240,
    cursor: "pointer",
  },
  emptyImg: {
    width: 240,
    minWidth: 240,
    fontSize: 180,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  imgInput: {
    display: "flex",
  },
  uploadError: {
    mt: 1,
  },
});

export function keyRecordInfoCard(opts: KeyRecordInfoCardOpts) {
  const tableModel = model.database.tables[opts.table];
  const pathBase = pluralize(opts.table.split("_").join(" "))
    .split(" ")
    .join("-");
  const editUrl =
    opts.editUrl ??
    stringLiteral(pathBase) + `|| '/' || ui.record_id || '/edit'`;
  if (!tableModel.recordDisplayName) {
    throw new Error("Table must have recordDisplayName for keyRecordInfoCard");
  }
  const nameExpr = tableModel.recordDisplayName.expr(
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
  );
  const selectFields = [`${nameExpr} as name`];
  for (const field of opts.fields) {
    selectFields.push(field);
  }
  if (opts.chipFields) {
    for (const field of opts.chipFields) {
      selectFields.push(field);
    }
  }
  const thumbnailField = opts.picture?.thumbnailField
    ? tableModel.fields[opts.picture!.thumbnailField]
    : tableModel.fields.picture_thumbnail;
  const fullField = opts.picture?.fullField
    ? tableModel.fields[opts.picture!.fullField]
    : tableModel.fields.picture_full;
  let pictureSection: undefined | Node;
  if (thumbnailField && fullField) {
    selectFields.push(fullField.name.name);
    selectFields.push(thumbnailField.name.name);
    pictureSection = ifNode(
      `record.${thumbnailField.name.name} is null`,
      element("div", {
        styles: styles.emptyImg,
        children: [
          materialIcon({
            name: "Person",
            fontSize: "inherit",
          }),
          state({
            procedure: [
              scalar(`uploading`, `false`),
              scalar(`failed`, `false`),
            ],
            children: [
              element("div", {
                styles: styles.imgInput,
                children: [
                  element("input", {
                    styles: displayNoneStyles,
                    props: {
                      id: pictureInputId,
                      accept: "'image/*'",
                      type: `'file'`,
                      capture: `true`,
                    },
                    on: {
                      fileChange: [
                        if_(`uploading`, exit()),
                        setScalar(`failed`, `false`),
                        setScalar(`uploading`, `true`),
                        commitUiChanges(),
                        scalar(`thumbnail_uuid`, { type: "Uuid" }),
                        scalar(`full_uuid`, { type: "Uuid" }),
                        spawn({
                          handleScalar: "thumbnail_task",
                          statements: [
                            try_<ClientProcStatement>({
                              body: [
                                addImage({
                                  fileRecord: `thumbnail`,
                                  jpegQuality: `80`,
                                  domUuid: `(select uuid from file)`,
                                  resize: {
                                    width: `240`,
                                    height: `240`,
                                    type: `'cover'`,
                                  },
                                }),
                                setScalar(`thumbnail_uuid`, `thumbnail.uuid`),
                              ],
                              catch: [setScalar(`failed`, `true`)],
                            }),
                          ],
                        }),
                        spawn({
                          handleScalar: "full_task",
                          statements: [
                            try_<ClientProcStatement>({
                              body: [
                                addImage({
                                  fileRecord: `full`,
                                  jpegQuality: `80`,
                                  domUuid: `(select uuid from file)`,
                                }),
                                setScalar(`full_uuid`, `full.uuid`),
                              ],
                              catch: [setScalar(`failed`, `true`)],
                            }),
                          ],
                        }),
                        if_(`failed`, exit()),
                        try_<ClientProcStatement>({
                          body: [
                            joinTasks([`thumbnail_task`, `full_task`]),
                            serviceProc([
                              modify(
                                `update db.${opts.table} set ${thumbnailField.name.name} = thumbnail_uuid, ${fullField.name.name} = full_uuid where id = ui.record_id`
                              ),
                            ]),
                            modify(
                              `update ui.record set ${thumbnailField.name.name} = thumbnail_uuid, ${fullField.name.name} = full_uuid`
                            ),
                          ],
                          catch: [setScalar(`failed`, `true`)],
                        }),
                      ],
                    },
                  }),
                  button({
                    tag: "label",
                    props: {
                      htmlFor: pictureInputId,
                    },
                    children: `'Upload picture'`,
                    size: "sm",
                    variant: "outlined",
                    color: "neutral",
                    loading: `uploading`,
                    startDecorator: materialIcon("Upload"),
                    loadingPosition: "start",
                  }),
                ],
              }),
              ifNode(
                `failed`,
                alert({
                  color: "danger",
                  styles: styles.uploadError,
                  children: `'Unable to upload picture'`,
                  size: "sm",
                })
              ),
            ],
          }),
        ],
      }),
      state({
        procedure: [scalar(`open`, `false`), scalar(`removing`, `false`)],
        children: [
          element("div", {
            styles: styles.imgWrapper,
            children: [
              element("a", {
                children: element("img", {
                  styles: styles.img,
                  props: {
                    src: `'/_a/file/' || sys.account || '/' || sys.app || '/' || record.${thumbnailField.name.name}`,
                  },
                }),
                on: { click: [setScalar(`ui.open`, `true`)] },
              }),
              button({
                variant: "outlined",
                color: "neutral",
                children: `'Remove picture'`,
                size: "sm",
                startDecorator: materialIcon(`Close`),
                on: { click: [setScalar(`ui.removing`, `true`)] },
              }),
              confirmDangerDialog({
                open: `ui.removing`,
                onClose: [setScalar(`ui.removing`, `false`)],
                description: `'Are you sure you want to remove this picture?'`,
                onConfirm: (closeModal) => [
                  try_<ClientProcStatement>({
                    body: [
                      serviceProc([
                        modify(
                          `update db.${opts.table} set ${thumbnailField.name.name} = null, ${fullField.name.name} = null where id = ui.record_id`
                        ),
                      ]),
                      ...closeModal,
                      modify(
                        `update ui.record set ${thumbnailField.name.name} = null, ${fullField.name.name} = null`
                      ),
                    ],
                    catch: [
                      setScalar(
                        `dialog_error`,
                        `'Something went wrong with removing the picture, please try again later.'`
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
          modal({
            open: `ui.open`,
            onClose: [setScalar(`ui.open`, `false`)],
            children: () =>
              modalDialog({
                children: element("img", {
                  props: {
                    src: `'/_a/file/' || sys.account || '/' || sys.app || '/' || record.${fullField.name.name}`,
                  },
                }),
              }),
          }),
        ],
      })
    );
  }
  let chips: undefined | Node;
  if (opts.chipFields) {
    chips = element("div", {
      styles: styles.chips,
      children: opts.chipFields.map((fieldName) => {
        const field = tableModel.fields[fieldName];
        return ifNode(
          `record.${field.name.name}`,
          chip({
            size: "sm",
            color: "neutral",
            children: stringLiteral(field.name.displayName),
          })
        );
      }),
    });
  }
  const fields = element("div", {
    styles: { display: "flex", flexDirection: "column" },
    children: opts.fields.map((name) => {
      const field = tableModel.fields[name];
      return element("p", {
        styles: styles.field,
        children: [
          element("span", {
            styles: styles.fieldLabel,
            children: stringLiteral(field.name.displayName),
          }),
          element("span", {
            styles: styles.fieldValue,
            children: getFieldValue(field),
          }),
        ],
      });
    }),
  });
  return state({
    procedure: [
      record(
        `record`,
        `select ${selectFields.join(",")} from db.${
          opts.table
        } as record where id = record_id`
      ),
    ],
    children: element("div", {
      styles: styles.root,
      children: [
        pictureSection,
        element("div", {
          styles: styles.infoSection,
          children: [
            typography({
              level: "h4",
              styles: styles.header,
              children: `record.name`,
            }),
            chips,
            fields,
            element("div", {
              styles: flexGrowStyles,
            }),
            element("div", {
              styles: styles.buttons,
              children: [
                button({
                  variant: "soft",
                  color: "info",
                  children: `'Edit'`,
                  size: "sm",
                  href: editUrl,
                  startDecorator: materialIcon(`Edit`),
                }),
                state({
                  procedure: [scalar(`deleting`, `false`)],
                  children: [
                    button({
                      variant: "soft",
                      color: "danger",
                      children: `'Delete'`,
                      size: "sm",
                      startDecorator: materialIcon(`Delete`),
                      on: { click: [setScalar(`ui.deleting`, `true`)] },
                    }),
                    deleteRecordDialog({
                      open: `deleting`,
                      onClose: [setScalar(`ui.deleting`, `false`)],
                      recordId: `ui.record_id`,
                      table: opts.table,
                      confirmDescription: `'Are you sure you want to delete ' || record.name || '?'`,
                      afterDeleteService: [navigate(stringLiteral(pathBase))],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}
