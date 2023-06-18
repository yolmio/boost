import {
  FormState,
  FormStateTableCursor,
  InsertFormField,
  InsertFormRelation,
} from "../../formState.js";
import { Table } from "../../modelTypes.js";
import { element, ifNode } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { model } from "../../singleton.js";
import { Style } from "../../styleTypes.js";
import { baseGridStyles, createStyles } from "../../styleUtils.js";
import { downcaseFirst } from "../../utils/inflectors.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { ClientProcStatement, EventHandler } from "../../yom.js";
import { alert } from "../alert.js";
import { button } from "../button.js";
import { card } from "../card.js";
import { checkbox } from "../checkbox.js";
import { divider } from "../divider.js";
import { formControl } from "../formControl.js";
import { formLabel } from "../formLabel.js";
import { iconButton } from "../iconButton.js";
import { materialIcon } from "../materialIcon.js";
import { typography } from "../typography.js";
import { getUniqueUiId } from "../utils.js";
import { fieldFormControl } from "./fieldFormControl.js";
import { labelOnLeftFormField } from "./labelOnLeftFormField.js";

export interface InsertGridFormPart {
  styles?: Style;
  field?: string;
  initialValue?: string;
  label?: string;
  onChange?: (formState: FormState) => ClientProcStatement[];
}

export type InsertRelationFormPart = {
  type: "Card";
  table: string;
  fields: (
    | string
    | {
        field: string;
        onChange?: (
          formState: FormState,
          cursor: FormStateTableCursor
        ) => ClientProcStatement[];
      }
  )[];
};

export interface InsertGridSection {
  styles?: Style;
  divider?: boolean;
  header?: string;
  description?: string;
  parts?: InsertGridFormPart[];
  relation?: InsertRelationFormPart;
}

export interface LabelOnLeftPart {
  field: string;
  initialValue?: string;
  label?: string;
  onChange?: (formState: FormState) => ClientProcStatement[];
}

export interface GridInsertFormContent {
  type: "Grid";
  parts: InsertGridFormPart[];
}

export interface AutoGridInsertFormContent {
  type: "AutoGrid";
  ignoreFields?: string[];
}

export interface SectionedGridInsertFormContent {
  type: "SectionedGrid";
  sections: InsertGridSection[];
}

export interface LabelOnLeftInsertFormContent {
  type: "LabelOnLeft";
  parts: LabelOnLeftPart[];
}

export type AutoLabelOnLeftFieldOverride = Partial<
  Omit<LabelOnLeftPart, "field">
>;

export interface AutoLabelOnLeftInsertFormContent {
  type: "AutoLabelOnLeft";
  ignoreFields?: string[];
  fieldOverrides?: Record<string, AutoLabelOnLeftFieldOverride>;
}

export type InsertFormContent =
  | GridInsertFormContent
  | AutoGridInsertFormContent
  | SectionedGridInsertFormContent
  | LabelOnLeftInsertFormContent
  | AutoLabelOnLeftInsertFormContent;

export interface InsertFormContentOpts {
  table: Table;
  formState: FormState;
  cancel:
    | { type: "Href"; href: string }
    | {
        type: "Proc";
        proc: ClientProcStatement[];
      };
  onSubmit: EventHandler;
}

export function getFieldsAndRelationsFromInsertFormContent(
  content: InsertFormContent,
  table: Table
) {
  let fields: InsertFormField[] = [];
  const relations: InsertFormRelation[] = [];
  switch (content.type) {
    case "Grid":
      throw new Error("TODO");
    case "AutoGrid":
      throw new Error("TODO");
    case "SectionedGrid": {
      for (const section of content.sections) {
        if (section.relation) {
          relations.push({
            table: section.relation.table,
            fields: section.relation.fields.map((f) =>
              typeof f === "string" ? { field: f } : f
            ),
          });
        }
        if (!section.parts) {
          continue;
        }
        for (const p of section.parts) {
          if (p.field) {
            fields.push({
              field: p.field,
              initialValue: p.initialValue,
            });
          }
        }
      }
      break;
    }
    case "LabelOnLeft":
      fields = content.parts.map((p) => ({
        field: p.field,
        initialValue: p.initialValue,
      }));
      break;
    case "AutoLabelOnLeft":
      fields = Object.keys(table.fields)
        .filter((f) => !content.ignoreFields?.includes(f))
        .map((f) => ({
          field: f,
          ...content.fieldOverrides?.[f],
        }));
      break;
  }
  return { fields, relations };
}

export function insertFormContent(
  content: InsertFormContent,
  opts: InsertFormContentOpts
): Node {
  switch (content.type) {
    case "Grid":
      throw gridInsertFormContent(content, opts);
    case "AutoGrid":
      throw new Error("TODO");
    case "SectionedGrid":
      return sectionedGridFormContent(content, opts);
    case "LabelOnLeft":
      return labelOnLeftInsertFormContent(content, opts);
    case "AutoLabelOnLeft": {
      const parts = Object.keys(opts.table.fields)
        .filter((f) => !content.ignoreFields?.includes(f))
        .map((f) => ({ field: f, ...content.fieldOverrides?.[f] }));
      return labelOnLeftInsertFormContent({ type: "LabelOnLeft", parts }, opts);
    }
  }
}

const styles = createStyles({
  header: {
    mb: 2,
  },
  divider: {
    mb: 2,
    mt: 3,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    gap: 2,
    mb: 1.5,
  },
  buttons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 1,
  },
  relationCard: {
    p: 2,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    sm: {
      p: 4,
    },
    dark: {
      backgroundColor: "neutral-800",
    },
    gridColumnSpan: "full",
    lg: {
      gridColumnSpan: 6,
    },
    xl: {
      gridColumnSpan: 4,
    },
  },
  addButtonWrapper: {
    gridColumnSpan: "full",
    lg: {
      gridColumnSpan: 6,
    },
    xl: {
      gridColumnSpan: 4,
    },

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    py: 4,
  },
  addButton: {
    backgroundColor: "transparent",
    display: "flex",
    alignItems: "center",
    borderColor: "neutral-400",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: "lg",
    px: 6,
    py: 4,
    cursor: "pointer",
    "&:hover": {
      borderColor: "primary-600",
    },
  },
  baseGridSection: {
    ...baseGridStyles,
    gap: 2,
  },
});

function gridPart(
  part: InsertGridFormPart,
  formState: FormState,
  table: Table
) {
  if (!part.field) {
    return element("div", { styles: part.styles });
  }
  const field = table.fields[part.field];
  const id = stringLiteral(getUniqueUiId());
  if (field.type === "Bool" && !field.enumLike) {
    return element("div", {
      styles: part.styles,
      children: checkbox({
        label: stringLiteral(field.name.displayName),
        variant: "outlined",
        checked: formState.fields.get(part.field),
        props: { id },
        on: {
          checkboxChange: [
            formState.fields.set(
              part.field,
              `coalesce(not ` + formState.fields.get(part.field) + `, true)`
            ),
          ],
        },
      }),
    });
  }
  const fieldValue = fieldFormControl({
    id,
    field,
    fieldHelper: formState.fieldHelper(part.field),
    onChange: part.onChange?.(formState),
  });
  if (!fieldValue) {
    throw new Error(
      "sectionedGridFormContent does not handle field of type " + field.type
    );
  }
  return formControl({
    styles: part.styles,
    children: [
      formLabel({
        props: { htmlFor: id },
        children: stringLiteral(field.name.displayName),
      }),
      fieldValue,
    ],
  });
}

export function sectionedGridFormContent(
  content: SectionedGridInsertFormContent,
  { table, formState, onSubmit, cancel }: InsertFormContentOpts
): Node {
  const sections = content.sections.map((section, i): Node => {
    const parts: Node[] = [];
    if (i !== 0 && (section.divider ?? true)) {
      parts.push(
        divider({
          styles: styles.divider,
        })
      );
    }
    if (section.header) {
      parts.push(
        typography({
          level: "h4",
          styles: styles.header,
          children: stringLiteral(section.header),
        })
      );
    }
    if (section.description) {
      parts.push(
        typography({
          level: "h6",
          styles: styles.header,
          children: stringLiteral(section.description),
        })
      );
    }
    if (section.parts) {
      parts.push(
        element("div", {
          styles: section.styles
            ? [styles.baseGridSection, section.styles]
            : styles.baseGridSection,
          children: section.parts.map((p) => gridPart(p, formState, table)),
        })
      );
    }
    if (section.relation) {
      const relationTable = model.database.tables[section.relation.table];
      parts.push(
        element("div", {
          styles: styles.baseGridSection,
          children: [
            formState.each(relationTable.name.name, (cursor) =>
              card({
                styles: styles.relationCard,
                variant: "outlined",
                children: [
                  section.relation!.fields.map((f) => {
                    const normalizedFieldOpts =
                      typeof f === "string" ? { field: f } : f;
                    const field =
                      relationTable.fields[normalizedFieldOpts.field];
                    const uniqueId = stringLiteral(getUniqueUiId());
                    const id = uniqueId + ` || ${cursor.idField}`;
                    return labelOnLeftFormField({
                      field,
                      id,
                      fieldHelper: cursor.field(field.name.name),
                      onChange: normalizedFieldOpts.onChange?.(
                        formState,
                        cursor
                      ),
                    });
                  }),
                  element("div", {
                    styles: { display: "flex", justifyContent: "flex-end" },
                    children: iconButton({
                      color: "danger",
                      variant: "plain",
                      size: "sm",
                      children: materialIcon("Delete"),
                      on: { click: [cursor.delete] },
                    }),
                  }),
                ],
              })
            ),
            element("div", {
              styles: styles.addButtonWrapper,
              children: element("button", {
                styles: styles.addButton,
                children: typography({
                  startDecorator: materialIcon("Add"),
                  children: `'Add ' || ${stringLiteral(
                    downcaseFirst(relationTable.name.displayName)
                  )}`,
                }),
                on: {
                  click: [
                    ...formState.addRecordToTable(relationTable.name.name, {}),
                  ],
                },
              }),
            }),
          ],
        })
      );
    }
    return parts;
  });
  sections.push(
    element("div", {
      styles: styles.buttons,
      children: [
        button({
          variant: "soft",
          color: "neutral",
          children: `'Cancel'`,
          href: cancel.type === "Href" ? cancel.href : undefined,
          on: cancel.type === "Proc" ? { click: cancel.proc } : undefined,
        }),
        button({
          children: `'Confirm changes'`,
          on: {
            click: onSubmit,
          },
        }),
      ],
    })
  );
  return sections;
}

export function gridInsertFormContent(
  content: GridInsertFormContent,
  { table, formState, onSubmit, cancel }: InsertFormContentOpts
) {
  return [
    element("div", {
      styles: styles.grid,
      children: content.parts.map((p) => {
        if (!p.field) {
          return element("div", { styles: p.styles });
        }
        const field = table.fields[p.field];

        const id = stringLiteral(getUniqueUiId());
        if (field.type === "Bool" && !field.enumLike) {
          return element("div", {
            styles: p.styles,
            children: checkbox({
              label: stringLiteral(field.name.displayName),
              variant: "outlined",
              checked: formState.fields.get(p.field),
              on: {
                checkboxChange: [
                  formState.fields.set(
                    p.field,
                    `coalesce(not ` + formState.fields.get(p.field) + `, true)`
                  ),
                ],
              },
            }),
          });
        }
        const control = fieldFormControl({
          field,
          id,
          fieldHelper: formState.fieldHelper(p.field),
        });
        if (!control) {
          throw new Error(
            "Edit dialog does not support field of type " + field.type
          );
        }
        return formControl({
          styles: p.styles,
          children: [
            formLabel({
              props: { htmlFor: id },
              children: stringLiteral(field.name.displayName),
            }),
            control,
          ],
        });
      }),
    }),
    ifNode(
      formState.hasFormError,
      alert({
        styles: { alignItems: "flex-start", mb: 1.5 },
        variant: "soft",
        color: "danger",
        startDecorator: materialIcon("Warning"),
        children: typography({
          color: "danger",
          children: formState.getFormError,
        }),
      })
    ),
    element("div", {
      styles: styles.buttons,
      children: [
        button({
          variant: "plain",
          color: "neutral",
          props: { type: "'button'" },
          href: cancel.type === "Href" ? cancel.href : undefined,
          on: cancel.type === "Proc" ? { click: cancel.proc } : undefined,
          children: "'Cancel'",
        }),
        button({
          variant: "solid",
          color: "primary",
          children: "'Confirm changes'",
          on: { click: onSubmit },
        }),
      ],
    }),
  ];
}

export function labelOnLeftInsertFormContent(
  content: LabelOnLeftInsertFormContent,
  { table, formState, onSubmit, cancel }: InsertFormContentOpts
) {
  const fields: Node[] = [];
  for (const part of content.parts) {
    fields.push(
      labelOnLeftFormField({
        field: table.fields[part.field],
        fieldHelper: formState.fieldHelper(part.field),
        id: stringLiteral(getUniqueUiId()),
        onChange: part.onChange?.(formState),
      })
    );
  }
  fields.push(
    element("div", {
      styles: styles.buttons,
      children: [
        button({
          variant: "plain",
          color: "neutral",
          props: { type: "'button'" },
          href: cancel.type === "Href" ? cancel.href : undefined,
          on: cancel.type === "Proc" ? { click: cancel.proc } : undefined,
          children: "'Cancel'",
        }),
        button({
          variant: "solid",
          color: "primary",
          children: "'Add'",
          loading: formState.submitting,
          on: { click: onSubmit },
        }),
      ],
    })
  );
  return fields;
}
