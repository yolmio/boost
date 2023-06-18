import { FormState, UpdateFormField } from "../../formState.js";
import { Table } from "../../modelTypes.js";
import { element, ifNode } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { Style } from "../../styleTypes.js";
import { baseGridStyles, createStyles } from "../../styleUtils.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { ClientProcStatement, EventHandler } from "../../yom.js";
import { alert } from "../alert.js";
import { button } from "../button.js";
import { checkbox } from "../checkbox.js";
import { divider } from "../divider.js";
import { formControl } from "../formControl.js";
import { formLabel } from "../formLabel.js";
import { materialIcon } from "../materialIcon.js";
import { typography } from "../typography.js";
import { getUniqueUiId } from "../utils.js";
import { fieldFormControl } from "./fieldFormControl.js";
import { labelOnLeftFormField } from "./labelOnLeftFormField.js";

export interface UpdateGridFormPart {
  styles?: Style;
  field?: string;
  initialValue?: string;
  label?: string;
}

export interface UpdateGridSection {
  styles?: Style;
  divider?: boolean;
  header?: string;
  description?: string;
  parts?: UpdateGridFormPart[];
}

export interface LabelOnLeftPart {
  field: string;
  initialValue?: string;
  label?: string;
}

export interface GridUpdateFormContent {
  type: "Grid";
  parts: UpdateGridFormPart[];
}

export interface AutoGridUpdateFormContent {
  type: "AutoGrid";
  ignoreFields?: string[];
}

export interface SectionedGridUpdateFormContent {
  type: "SectionedGrid";
  sections: UpdateGridSection[];
}

export interface LabelOnLeftUpdateFormContent {
  type: "LabelOnLeft";
  parts: LabelOnLeftPart[];
}

export type AutoLabelOnLeftFieldOverride = Partial<
  Omit<LabelOnLeftPart, "field">
>;

export interface AutoLabelOnLeftUpdateFormContent {
  type: "AutoLabelOnLeft";
  ignoreFields?: string[];
  fieldOverrides?: Record<string, AutoLabelOnLeftFieldOverride>;
}

export type UpdateFormContent =
  | GridUpdateFormContent
  | AutoGridUpdateFormContent
  | SectionedGridUpdateFormContent
  | LabelOnLeftUpdateFormContent
  | AutoLabelOnLeftUpdateFormContent;

export interface UpdateFormContentOpts {
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

export function getFieldsFromUpdateFormContent(
  content: UpdateFormContent,
  table: Table
) {
  const fields: UpdateFormField[] = [];
  switch (content.type) {
    case "Grid":
      throw new Error("TODO");
    case "AutoGrid":
      throw new Error("TODO");
    case "SectionedGrid": {
      for (const section of content.sections) {
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
      return content.parts.map((p) => ({
        field: p.field,
        initialValue: p.initialValue,
      }));
    case "AutoLabelOnLeft":
      return Object.keys(table.fields)
        .filter((f) => !content.ignoreFields?.includes(f))
        .map((f) => ({
          field: f,
          ...content.fieldOverrides?.[f],
        }));
  }
  return fields;
}

export function updateFormContent(
  content: UpdateFormContent,
  opts: UpdateFormContentOpts
): Node {
  switch (content.type) {
    case "Grid":
      throw gridUpdateFormContent(content, opts);
    case "AutoGrid":
      throw new Error("TODO");
    case "SectionedGrid":
      return sectionedGridFormContent(content, opts);
    case "LabelOnLeft":
      return labelOnLeftUpdateFormContent(content, opts);
    case "AutoLabelOnLeft": {
      const parts = Object.keys(opts.table.fields)
        .filter((f) => !content.ignoreFields?.includes(f))
        .map((f) => ({ field: f }));
      return labelOnLeftUpdateFormContent({ type: "LabelOnLeft", parts }, opts);
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
  baseGridSection: {
    ...baseGridStyles,
    gap: 2,
  },
});

function gridPart(
  part: UpdateGridFormPart,
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
  content: SectionedGridUpdateFormContent,
  { table, formState, onSubmit, cancel }: UpdateFormContentOpts
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

export function gridUpdateFormContent(
  content: GridUpdateFormContent,
  { table, formState, onSubmit, cancel }: UpdateFormContentOpts
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
      formState.getFormError + " is not null",
      alert({
        styles: { alignItems: "flex-start", mb: 1.5 },
        variant: "soft",
        color: "danger",
        startDecorator: materialIcon("Warning"),
        children: typography({
          color: "danger",
          children: `'an error'`,
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

export function labelOnLeftUpdateFormContent(
  content: LabelOnLeftUpdateFormContent,
  { table, formState, onSubmit, cancel }: UpdateFormContentOpts
) {
  const fields: Node[] = [];
  for (const part of content.parts) {
    fields.push(
      labelOnLeftFormField({
        field: table.fields[part.field],
        fieldHelper: formState.fieldHelper(part.field),
        id: stringLiteral(getUniqueUiId()),
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
          children: "'Confirm changes'",
          loading: formState.submitting,
          on: { click: onSubmit },
        }),
      ],
    })
  );
  return fields;
}
