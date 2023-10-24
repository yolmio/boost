import { ImageSetFieldGroup, Table } from "../../app";
import { nodes } from "../../nodeHelpers";
import { app } from "../../app";
import { createStyles, visuallyHiddenStyles } from "../../styleUtils";
import { getUploadStatements, getVariantFromImageSet } from "../../utils/image";
import { stringLiteral } from "../../utils/sqlHelpers";
import * as yom from "../../yom";
import { alert } from "../../components/alert";
import { button } from "../../components/button";
import { chip } from "../../components/chip";
import { imageDialog } from "../../components/imageDialog";
import { materialIcon } from "../../components/materialIcon";
import { recordDeleteButton } from "../../components/recordDeleteButton";
import { typography } from "../../components/typography";
import { circularProgress } from "../../components/circularProgress";
import { Color, Size, Variant } from "../../components/types";
import { RecordGridBuilder } from "../recordGrid";

type Chip =
  | string
  | {
      field: string;
      color?: Color;
      size?: Size;
      variant?: Variant;
      displayName?: string;
    }
  | {
      color?: Color;
      size?: Size;
      variant?: Variant;
      displayName: string;
      fields: string[];
      condition: (...fields: yom.SqlExpression[]) => yom.SqlExpression;
    };

export interface Opts {
  subHeader?: yom.SqlExpression;
  chips?: Chip[];
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
    "&:focus-within": app.theme.focus.default,
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
    "&:focus": app.theme.focus.default,
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
  ctx: RecordGridBuilder
) {
  const { spawnUploadTasks, joinUploadTasks, updateImagesInDb } =
    getUploadStatements(ctx.table.name, ctx.recordId, imageFieldGroup);
  return nodes.state({
    procedure: (s) =>
      s
        .scalar(`uploading`, `false`)
        .scalar(`dialog_open`, `false`)
        .scalar(`failed_upload`, `false`),
    children: [
      nodes.if({
        condition: `record.named_page_header_thumb is null`,
        then: nodes.element("label", {
          styles: styles.emptyLabel(),
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
                              .statements(ctx.triggerRefresh)
                          ),
                      catch: (s) =>
                        s.setScalar(`failed_upload`, `true`).spawn({
                          detached: true,
                          procedure: (s) =>
                            s
                              .delay("5000")
                              .setScalar(`failed_upload`, `false`)
                              .commitUiChanges(),
                        }),
                    })
                    .setScalar(`uploading`, `false`),
              },
            }),
            nodes.if({
              condition: `uploading`,
              then: circularProgress(),
              else: materialIcon("Person"),
            }),
          ],
        }),
        else: [
          nodes.element("div", {
            styles: styles.imgWrapper,
            children: nodes.element("img", {
              styles: styles.img(),
              props: {
                tabIndex: `0`,
                src: `'/_a/file/' || sys.account || '/' || sys.app || '/' || record.named_page_header_thumb`,
              },
              on: {
                click: (s) => s.setScalar(`dialog_open`, `true`),
                keydown: (s) =>
                  s.if(`event.key = 'Enter'`, (s) =>
                    s.setScalar(`dialog_open`, `true`)
                  ),
              },
            }),
          }),
          imageDialog({
            open: `dialog_open`,
            group: "image",
            onClose: (s) => s.setScalar(`dialog_open`, `false`),
            recordId: `ui.record_id`,
            tableName: ctx.table.name,
            afterReplace: ctx.triggerRefresh,
            afterRemove: ctx.triggerRefresh,
          }),
        ],
      }),
      nodes.if(
        `failed_upload`,
        nodes.element("div", {
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

export function content(opts: Opts, ctx: RecordGridBuilder) {
  const { table: tableModel, refreshKey, recordId } = ctx;
  if (!tableModel.recordDisplayName) {
    throw new Error("Table must have recordDisplayName for simpleNamedHeader");
  }
  const nameExpr = tableModel.recordDisplayName.expr(
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
  );
  let selectFields = opts.chips
    ? ", " +
      opts.chips
        .map((v, i) =>
          typeof v === "string"
            ? v
            : "field" in v
            ? v.field
            : v.condition(...v.fields.map((f) => `record.${f}`)) +
              " as chip_" +
              i
        )
        .join(", ")
    : "";
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
  return nodes.sourceMap(
    "namedPageHeader",
    nodes.state({
      watch: [refreshKey],
      procedure: (s) =>
        s.record(
          `record`,
          `select ${nameExpr} as name${selectFields} from db.${tableModel.identName} as record where id = ${recordId}`
        ),
      children: nodes.element("div", {
        styles: styles.root,
        children: [
          imageFieldGroup ? imagePart(imageFieldGroup, opts, ctx) : undefined,
          nodes.element("div", {
            styles: { display: "flex", gap: 0.5, flexDirection: "column" },
            children: [
              nodes.element("div", {
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
                ? nodes.element("h6", {
                    styles: styles.subHeader,
                    children: `record.named_page_sub_header`,
                  })
                : undefined,
              opts.chips
                ? nodes.element("div", {
                    styles: styles.chips,
                    children: opts.chips.map((c, i) => {
                      if (typeof c === "string") {
                        const field = tableModel.fields[c];
                        return nodes.if(
                          `record.${c}`,
                          chip({
                            variant: "soft",
                            color: "neutral",
                            size: "sm",
                            children: stringLiteral(field.displayName),
                          })
                        );
                      } else if ("field" in c) {
                        const field = tableModel.fields[c.field];
                        return nodes.if(
                          `record.${c.field}`,
                          chip({
                            variant: c.variant ?? "soft",
                            color: c.color ?? "neutral",
                            size: c.size ?? "sm",
                            children: stringLiteral(field.displayName),
                          })
                        );
                      } else {
                        return nodes.if(
                          `record.chip_${i}`,
                          chip({
                            variant: c.variant ?? "soft",
                            color: c.color ?? "neutral",
                            size: c.size ?? "sm",
                            children: stringLiteral(c.displayName),
                          })
                        );
                      }
                    }),
                  })
                : undefined,
            ],
          }),
          nodes.element("div", {
            styles: styles.grow,
          }),
          nodes.element("div", {
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
                afterDeleteService: (s) =>
                  s.navigate(stringLiteral(ctx.pathBase)),
              }),
            ],
          }),
        ],
      }),
    })
  );
}
