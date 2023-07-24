import { ImageSetFieldGroup, Table } from "../../modelTypes.js";
import { element, ifNode, state } from "../../nodeHelpers.js";
import {
  commitUiChanges,
  delay,
  exit,
  if_,
  navigate,
  record,
  scalar,
  serviceProc,
  setScalar,
  spawn,
  try_,
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { createStyles, visuallyHiddenStyles } from "../../styleUtils.js";
import {
  getUploadStatements,
  getVariantFromImageSet,
} from "../../utils/image.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { ClientProcStatement, SqlExpression } from "../../yom.js";
import { alert } from "../../components/alert.js";
import { button } from "../../components/button.js";
import { chip } from "../../components/chip.js";
import { imageDalog } from "../../components/imageDialog.js";
import { materialIcon } from "../../components/materialIcon.js";
import { recordDeleteButton } from "../../components/recordDeleteButton.js";
import { typography } from "../../components/typography.js";
import { RecordGridContext } from "./shared.js";
import { circularProgress } from "../../components/circularProgress.js";

export const name = "namedHeader";

export interface Opts {
  subHeader?: SqlExpression;
  chips?: string[];
  prefix?: string;
  imageGroup?: string;
  disableImage?: boolean;
}

const styles = createStyles({
  root: {
    gridColumnSpan: "full",
    display: "flex",
    gap: 2,
    alignItems: "center",
    flexDirection: "column",
    md: {
      alignItems: "flex-start",
      flexDirection: "row",
    },
  },
  emptyLabel: () => ({
    width: 128,
    height: 128,
    borderRadius: "xl",
    border: "1px solid",
    borderColor: "divider",
    fontSize: 80,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    "&:focus-within": model.theme.focus.default,
  }),
  imgWrapper: {
    width: 128,
    height: 128,
    borderRadius: "xl",
  },
  img: () => ({
    width: 128,
    height: 128,
    borderRadius: "xl",
    cursor: "pointer",
    "&:focus": model.theme.focus.default,
  }),
  subHeader: {
    fontSize: "lg",
    fontWeight: "md",
    color: "text-secondary",
    my: 0,
  },
  uploadFail: {
    position: "fixed",
    bottom: 16,
    left: 16,
    zIndex: 1000,
  },
  grow: {
    display: "none",
    md: {
      flexGrow: 1,
      display: "block",
    },
  },
  chips: {
    display: "flex",
    gap: 1,
  },
});

function imagePart(
  imageFieldGroup: ImageSetFieldGroup,
  opts: Opts,
  ctx: RecordGridContext
) {
  const { spawnUploadTasks, joinUploadTasks, updateImagesInDb } =
    getUploadStatements(ctx.table.name, ctx.recordId, imageFieldGroup);
  return state({
    procedure: [
      scalar(`uploading`, `false`),
      scalar(`dialog_open`, `false`),
      scalar(`failed_upload`, `false`),
    ],
    children: [
      ifNode(
        `record.named_page_header_thumb is null`,
        element("label", {
          styles: styles.emptyLabel(),
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
                      serviceProc([...updateImagesInDb, ctx.triggerRefresh]),
                    ],
                    catch: [
                      setScalar(`failed_upload`, `true`),
                      spawn({
                        detached: true,
                        statements: [
                          delay("5000"),
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
            ifNode(`uploading`, circularProgress(), materialIcon("Person")),
          ],
        }),
        [
          element("div", {
            styles: styles.imgWrapper,
            children: element("img", {
              styles: styles.img(),
              props: {
                tabIndex: `0`,
                src: `'/_a/file/' || sys.account || '/' || sys.app || '/' || record.named_page_header_thumb`,
              },
              on: {
                click: [setScalar(`dialog_open`, `true`)],
                keydown: [
                  if_(`event.key = 'Enter'`, [
                    setScalar(`dialog_open`, `true`),
                  ]),
                ],
              },
            }),
          }),
          imageDalog({
            open: `dialog_open`,
            group: "image",
            onClose: [setScalar(`dialog_open`, `false`)],
            recordId: `ui.record_id`,
            tableName: ctx.table.name,
            afterReplace: [ctx.triggerRefresh],
            afterRemove: [ctx.triggerRefresh],
          }),
        ]
      ),
      ifNode(
        `failed_upload`,
        element("div", {
          styles: styles.uploadFail,
          children: alert({
            color: "danger",
            children: "'Failed to upload image'",
            size: "lg",
            startDecorator: materialIcon("Warning"),
          }),
        })
      ),
    ],
  });
}

function getImageFieldGroup(
  table: Table,
  opts: Opts
): ImageSetFieldGroup | undefined {
  if (opts.disableImage) {
    return;
  }
  if (opts.imageGroup) {
    const imageFieldGroup = table.fieldGroups[opts.imageGroup];
    if (!imageFieldGroup) {
      throw new Error(`Field group ${opts.imageGroup} not found`);
    }
    if (imageFieldGroup.type !== "Image") {
      throw new Error(
        `Field group ${opts.imageGroup} is not an image set field group`
      );
    }
    return imageFieldGroup;
  }
  let imageSetCount = 0;
  for (const group of Object.values(table.fieldGroups)) {
    if (group.type === "Image") {
      imageSetCount += 1;
    }
  }
  if (imageSetCount === 0) {
    return;
  }
  if (imageSetCount === 1) {
    return Object.values(table.fieldGroups).find(
      (g) => g.type === "Image"
    ) as ImageSetFieldGroup;
  }
  for (const group of Object.values(table.fieldGroups)) {
    if (group.type === "Image" && group.name === "main_image") {
      return group;
    }
  }
  throw new Error(
    "Multiple image set field groups found, but none named 'main_image'"
  );
}

export function content(opts: Opts, ctx: RecordGridContext) {
  const { table: tableModel, refreshKey, recordId } = ctx;
  if (!tableModel.recordDisplayName) {
    throw new Error("Table must have recordDisplayName for simpleNamedHeader");
  }
  const nameExpr = tableModel.recordDisplayName.expr(
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
  );
  let selectFields = opts.chips ? ", " + opts.chips.join(", ") : "";
  if (opts.prefix) {
    selectFields += ", " + opts.prefix;
  }
  if (opts.subHeader) {
    selectFields += `, ${opts.subHeader} as named_page_sub_header`;
  }
  const imageFieldGroup = getImageFieldGroup(tableModel, opts);
  if (imageFieldGroup) {
    const variant = getVariantFromImageSet(
      imageFieldGroup,
      "square_thumbnail",
      ["general_thumbnail"]
    );
    if (!variant) {
      throw new Error("No thumbnail variant found");
    }
    selectFields += `, ${variant} as named_page_header_thumb`;
  }
  return state({
    watch: [refreshKey],
    procedure: [
      record(
        `record`,
        `select ${nameExpr} as name${selectFields} from db.${tableModel.name} as record where id = ${recordId}`
      ),
    ],
    children: element("div", {
      styles: styles.root,
      children: [
        imageFieldGroup ? imagePart(imageFieldGroup, opts, ctx) : undefined,
        element("div", {
          styles: { display: "flex", gap: 0.5, flexDirection: "column" },
          children: [
            element("div", {
              styles: { display: "flex", alignItems: "baseline", gap: 0.5 },
              children: [
                typography({
                  level: "h4",
                  children: [
                    opts.prefix ? `record.${opts.prefix} || ' '` : `''`,
                    `record.name`,
                  ],
                }),
              ],
            }),
            opts.subHeader
              ? element("h6", {
                  styles: styles.subHeader,
                  children: `record.named_page_sub_header`,
                })
              : undefined,
            opts.chips
              ? element("div", {
                  styles: styles.chips,
                  children: opts.chips.map((c) => {
                    const field = tableModel.fields[c];
                    return ifNode(
                      `record.${c}`,
                      chip({
                        variant: "soft",
                        color: "neutral",
                        size: "sm",
                        children: stringLiteral(field.displayName),
                      })
                    );
                  }),
                })
              : undefined,
          ],
        }),
        element("div", {
          styles: styles.grow,
        }),
        element("div", {
          styles: { display: "flex", gap: 1 },
          children: [
            button({
              color: "primary",
              size: "sm",
              variant: "soft",
              startDecorator: materialIcon("Edit"),
              children: `'Edit'`,
              href: `${stringLiteral(
                ctx.pathBase
              )} || '/' || ui.record_id || '/edit'`,
            }),
            recordDeleteButton({
              table: tableModel.name,
              recordId: `ui.record_id`,
              dialogConfirmDescription: `'Are you sure you want to delete ' || record.name || '?'`,
              size: "sm",
              afterDeleteService: [navigate(stringLiteral(ctx.pathBase))],
            }),
          ],
        }),
      ],
    }),
  });
}
