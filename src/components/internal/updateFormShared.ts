import { FormState, UpdateFormField, UpdateFormState } from "../../formState";
import { Table } from "../../system";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { Style } from "../../styleTypes";
import { downcaseFirst } from "../../utils/inflectors";
import { stringLiteral } from "../../utils/sqlHelpers";
import { alert } from "../alert";
import { button } from "../button";
import { checkbox } from "../checkbox";
import { divider } from "../divider";
import { formControl } from "../formControl";
import { formHelperText } from "../formHelperText";
import { formLabel } from "../formLabel";
import { materialIcon } from "../materialIcon";
import { typography } from "../typography";
import { getUniqueUiId } from "../utils";
import { fieldFormControl } from "./fieldFormControl";
import { labelOnLeftFormField } from "./labelOnLeftFormField";
import {
  genericFormStyles,
  labelOnLeftStyles,
  twoColumnFormStyles,
} from "./sharedFormStyles";
import { DomStatementsOrFn } from "../../statements";

export interface UpdateGridFormPart {
  styles?: Style;
  field?: string;
  initialValue?: string;
  label?: string;
}

export interface TwoColumnSectionedSection {
  styles?: Style;
  header: string;
  description?: string;
  parts: UpdateGridFormPart[];
}

export interface TwoColumnSectionedUpdateFormContent {
  type: "TwoColumnSectioned";
  header?: string;
  sections: TwoColumnSectionedSection[];
}

export interface LabelOnLeftPart {
  field: string;
  initialValue?: string;
  label?: string;
}

export interface LabelOnLeftUpdateFormContent {
  type: "LabelOnLeft";
  header?: string;
  parts: LabelOnLeftPart[];
}

export type AutoLabelOnLeftFieldOverride = Partial<
  Omit<LabelOnLeftPart, "field">
>;

export interface AutoLabelOnLeftUpdateFormContent {
  type: "AutoLabelOnLeft";
  header?: string;
  ignoreFields?: string[];
  fieldOverrides?: Record<string, AutoLabelOnLeftFieldOverride>;
}

export type UpdateFormContent =
  | TwoColumnSectionedUpdateFormContent
  | LabelOnLeftUpdateFormContent
  | AutoLabelOnLeftUpdateFormContent;

export interface UpdateFormContentOpts {
  table: Table;
  formState: UpdateFormState;
  cancel:
  | { type: "Href"; href: string }
  | {
    type: "Proc";
    proc: DomStatementsOrFn;
  };
}

export function getFieldsFromUpdateFormContent(
  content: UpdateFormContent,
  table: Table,
) {
  const fields: UpdateFormField[] = [];
  switch (content.type) {
    case "TwoColumnSectioned": {
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
  opts: UpdateFormContentOpts,
): Node {
  switch (content.type) {
    case "TwoColumnSectioned":
      return twoColumnSectionedUpdateFormContent(content, opts);
    case "LabelOnLeft":
      return labelOnLeftUpdateFormContent(content, opts);
    case "AutoLabelOnLeft": {
      const parts = Object.keys(opts.table.fields)
        .filter((f) => !content.ignoreFields?.includes(f))
        .map((f) => ({ field: f }));
      return labelOnLeftUpdateFormContent(
        { type: "LabelOnLeft", parts, header: content.header },
        opts,
      );
    }
  }
}

function gridPart(
  part: UpdateGridFormPart,
  formState: FormState,
  table: Table,
) {
  if (!part.field) {
    return nodes.element("div", { styles: part.styles });
  }
  const field = table.fields[part.field];
  const id = stringLiteral(getUniqueUiId());
  const fieldHelper = formState.field(part.field);
  if (field.type === "Bool" && !field.enumLike) {
    return nodes.element("div", {
      styles: part.styles,
      children: [
        checkbox({
          error: fieldHelper.hasError,
          label: stringLiteral(field.displayName),
          variant: "outlined",
          checked: fieldHelper.value,
          props: { id },
          on: {
            checkboxChange: fieldHelper.setValue(
              `coalesce(not ` + fieldHelper.value + `, true)`,
            ),
          },
        }),
        nodes.if(
          fieldHelper.hasError,
          nodes.element("div", {
            styles: genericFormStyles.errorText,
            children: fieldHelper.error,
          }),
        ),
      ],
    });
  }
  const fieldValue = fieldFormControl({
    id,
    field,
    fieldHelper,
  });
  if (!fieldValue) {
    throw new Error(
      "sectionedGridFormContent does not handle field of type " + field.type,
    );
  }
  return formControl({
    error: fieldHelper.hasError,
    styles: part.styles,
    children: [
      formLabel({
        props: { htmlFor: id },
        children: stringLiteral(field.displayName),
      }),
      fieldValue,
      nodes.if(
        fieldHelper.hasError,
        formHelperText({ children: fieldHelper.error }),
      ),
    ],
  });
}

function twoColumnSectionedUpdateFormContent(
  content: TwoColumnSectionedUpdateFormContent,
  { table, formState, cancel }: UpdateFormContentOpts,
): Node {
  const header = stringLiteral(
    content.header ?? downcaseFirst(table.displayName),
  );
  const sections: Node[] = [
    nodes.element("h1", {
      styles: genericFormStyles.pageHeader,
      children: `'Edit ' || ${header}`,
    }),
  ];
  for (const section of content.sections) {
    sections.push(divider());
    sections.push(
      nodes.element("div", {
        styles: twoColumnFormStyles.section,
        children: [
          nodes.element("div", {
            children: [
              typography({
                level: "h2",
                styles: twoColumnFormStyles.header,
                children: stringLiteral(section.header),
              }),
              section.description
                ? nodes.element("p", {
                  styles: twoColumnFormStyles.description,
                  children: stringLiteral(section.description),
                })
                : undefined,
            ],
          }),
          nodes.element("div", {
            styles: section.styles
              ? [twoColumnFormStyles.partsWrapper, section.styles]
              : twoColumnFormStyles.partsWrapper,
            children: section.parts.map((p) => gridPart(p, formState, table)),
          }),
        ],
      }),
    );
  }
  sections.push(
    nodes.if(
      formState.hasFormError,
      alert({
        color: "danger",
        size: "lg",
        children: formState.formError,
        startDecorator: materialIcon("Error"),
      }),
    ),
  );
  sections.push(
    nodes.element("div", {
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
          children: `'Save'`,
          loading: formState.submitting,
          on: {
            click: formState.onSubmit,
          },
        }),
      ],
    }),
  );
  return nodes.element("div", {
    styles: twoColumnFormStyles.root,
    children: sections,
  });
}

function labelOnLeftUpdateFormContent(
  content: LabelOnLeftUpdateFormContent,
  { table, formState, cancel }: UpdateFormContentOpts,
) {
  const fields: Node[] = [];
  if (content.header) {
    fields.push(
      nodes.element("h1", {
        styles: genericFormStyles.pageHeader,
        children: stringLiteral(content.header),
      }),
      divider(),
    );
  }
  for (const part of content.parts) {
    fields.push(
      labelOnLeftFormField({
        field: table.fields[part.field],
        fieldHelper: formState.field(part.field),
        id: stringLiteral(getUniqueUiId()),
      }),
    );
  }
  fields.push(
    nodes.if(
      formState.hasFormError,
      alert({
        color: "danger",
        size: "lg",
        children: formState.formError,
        startDecorator: materialIcon("Error"),
      }),
    ),
  );
  fields.push(
    nodes.element("div", {
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
          children: "'Save'",
          loading: formState.submitting,
          on: { click: formState.onSubmit },
        }),
      ],
    }),
  );
  return nodes.element("div", {
    styles: labelOnLeftStyles.root,
    children: fields,
  });
}
