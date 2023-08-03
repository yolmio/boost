import {
  FormState,
  FormStateTableCursor,
  InsertFormField,
  InsertFormRelation,
} from "../../formState.js";
import { Table } from "../../appTypes.js";
import { element, ifNode } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { app } from "../../singleton.js";
import { Style } from "../../styleTypes.js";
import { downcaseFirst } from "../../utils/inflectors.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { ClientProcStatement, EventHandler } from "../../yom.js";
import { alert } from "../alert.js";
import { button } from "../button.js";
import { card } from "../card.js";
import { checkbox } from "../checkbox.js";
import { divider } from "../divider.js";
import { formControl } from "../formControl.js";
import { formHelperText } from "../formHelperText.js";
import { formLabel } from "../formLabel.js";
import { iconButton } from "../iconButton.js";
import { materialIcon } from "../materialIcon.js";
import { typography } from "../typography.js";
import { getUniqueUiId } from "../utils.js";
import { fieldFormControl } from "./fieldFormControl.js";
import { labelOnLeftFormField } from "./labelOnLeftFormField.js";
import {
  labelOnLeftStyles,
  genericFormStyles,
  multiCardInsertStyles,
  twoColumnFormStyles,
} from "./sharedFormStyles.js";

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

export interface LabelOnLeftInsertFormContent {
  type: "LabelOnLeft";
  header?: string;
  parts: LabelOnLeftPart[];
}

export type AutoLabelOnLeftFieldOverride = Partial<
  Omit<LabelOnLeftPart, "field">
>;

export interface AutoLabelOnLeftInsertFormContent {
  type: "AutoLabelOnLeft";
  header?: string;
  ignoreFields?: string[];
  fieldOverrides?: Record<string, AutoLabelOnLeftFieldOverride>;
}

export interface TwoColumnSectionedSection {
  styles?: Style;
  header: string;
  description?: string;
  parts?: InsertGridFormPart[];
  relation?: InsertRelationFormPart;
}

export interface TwoColumnSectionedInsertFormContent {
  type: "TwoColumnSectioned";
  header?: string;
  sections: TwoColumnSectionedSection[];
}

export type InsertFormContent =
  | LabelOnLeftInsertFormContent
  | AutoLabelOnLeftInsertFormContent
  | TwoColumnSectionedInsertFormContent;

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
    case "TwoColumnSectioned": {
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
    case "LabelOnLeft":
      return labelOnLeftInsertFormContent(content, opts);
    case "AutoLabelOnLeft": {
      const parts = Object.keys(opts.table.fields)
        .filter((f) => !content.ignoreFields?.includes(f))
        .map((f) => ({ field: f, ...content.fieldOverrides?.[f] }));
      return labelOnLeftInsertFormContent(
        { type: "LabelOnLeft", parts, header: content.header },
        opts
      );
    }
    case "TwoColumnSectioned":
      return twoColumnSectionedInsertFormContent(content, opts);
  }
}

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
  const fieldHelper = formState.fieldHelper(part.field);
  if (field.type === "Bool" && !field.enumLike) {
    return element("div", {
      styles: part.styles,
      children: [
        checkbox({
          error: fieldHelper.hasError,
          label: stringLiteral(field.displayName),
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
        ifNode(
          fieldHelper.hasError,
          element("div", {
            styles: genericFormStyles.errorText,
            children: fieldHelper.error,
          })
        ),
      ],
    });
  }
  const fieldValue = fieldFormControl({
    id,
    field,
    fieldHelper,
    onChange: part.onChange?.(formState),
  });
  if (!fieldValue) {
    throw new Error(
      "sectionedGridFormContent does not handle field of type " + field.type
    );
  }
  return formControl({
    error: fieldHelper.hasError,
    styles: part.styles,
    children: [
      formLabel({
        props: { htmlFor: id },
        children: stringLiteral(part.label ?? field.displayName),
      }),
      fieldValue,
      ifNode(
        fieldHelper.hasError,
        formHelperText({ children: fieldHelper.error })
      ),
    ],
  });
}

function twoColumnSectionedInsertFormContent(
  content: TwoColumnSectionedInsertFormContent,
  { table, formState, onSubmit, cancel }: InsertFormContentOpts
): Node {
  const header = stringLiteral(
    content.header ?? downcaseFirst(table.displayName)
  );
  const sections: Node[] = [
    element("h1", {
      styles: genericFormStyles.pageHeader,
      children: `'Add new ' || ${header}`,
    }),
  ];
  for (const section of content.sections) {
    sections.push(divider());
    let sectionBody: Node;
    if (section.relation) {
      const relationTable = app.database.tables[section.relation.table];
      sectionBody = element("div", {
        styles: twoColumnFormStyles.cardRelation,
        children: [
          formState.each(relationTable.name, (cursor) =>
            card({
              styles: multiCardInsertStyles.relationCard,
              variant: "outlined",
              children: [
                section.relation!.fields.map((f) => {
                  const normalizedFieldOpts =
                    typeof f === "string" ? { field: f } : f;
                  const field = relationTable.fields[normalizedFieldOpts.field];
                  const uniqueId = stringLiteral(getUniqueUiId());
                  const id = uniqueId + ` || ${cursor.idField}`;
                  return labelOnLeftFormField({
                    field,
                    id,
                    fieldHelper: cursor.field(field.name),
                    onChange: normalizedFieldOpts.onChange?.(formState, cursor),
                  });
                }),
                element("div", {
                  styles: twoColumnFormStyles.cardFooter,
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
            styles: multiCardInsertStyles.addButtonWrapper,
            children: element("button", {
              styles: multiCardInsertStyles.addButton,
              children: typography({
                startDecorator: materialIcon("Add"),
                children: `'Add ' || ${stringLiteral(
                  downcaseFirst(relationTable.displayName)
                )}`,
              }),
              on: {
                click: [...formState.addRecordToTable(relationTable.name, {})],
              },
            }),
          }),
        ],
      });
    } else if (section.parts) {
      sectionBody = element("div", {
        styles: section.styles
          ? [twoColumnFormStyles.partsWrapper, section.styles]
          : twoColumnFormStyles.partsWrapper,
        children: section.parts.map((p) => gridPart(p, formState, table)),
      });
    } else {
      sectionBody = element("div", {
        children: `'You should specify a relation or parts'`,
      });
    }
    sections.push(
      element("div", {
        styles: twoColumnFormStyles.section,
        children: [
          element("div", {
            children: [
              typography({
                level: "h2",
                styles: twoColumnFormStyles.header,
                children: stringLiteral(section.header),
              }),
              section.description
                ? element("p", {
                    styles: twoColumnFormStyles.description,
                    children: stringLiteral(section.description),
                  })
                : undefined,
            ],
          }),
          sectionBody,
        ],
      })
    );
  }
  sections.push(
    ifNode(
      formState.hasFormError,
      alert({
        color: "danger",
        size: "lg",
        children: formState.getFormError,
        startDecorator: materialIcon("Error"),
      })
    )
  );
  sections.push(
    element("div", {
      styles: genericFormStyles.actionButtons,
      children: [
        button({
          variant: "plain",
          color: "neutral",
          children: `'Cancel'`,
          href: cancel.type === "Href" ? cancel.href : undefined,
          on: cancel.type === "Proc" ? { click: cancel.proc } : undefined,
        }),
        button({
          children: `'Add new ' || ${header}`,
          loading: formState.submitting,
          on: {
            click: onSubmit,
          },
        }),
      ],
    })
  );
  return element("div", {
    styles: twoColumnFormStyles.root,
    children: sections,
  });
}

export function labelOnLeftInsertFormContent(
  content: LabelOnLeftInsertFormContent,
  { table, formState, onSubmit, cancel }: InsertFormContentOpts
) {
  const fields: Node[] = [];
  if (content.header) {
    fields.push(
      element("h1", {
        styles: genericFormStyles.pageHeader,
        children: stringLiteral(content.header),
      }),
      divider()
    );
  }
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
      styles: genericFormStyles.actionButtons,
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
  fields.push(
    ifNode(
      formState.hasFormError,
      alert({
        color: "danger",
        size: "lg",
        children: formState.getFormError,
        startDecorator: materialIcon("Error"),
      })
    )
  );
  return element("div", {
    styles: labelOnLeftStyles.root,
    children: fields,
  });
}
