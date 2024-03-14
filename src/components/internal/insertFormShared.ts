import {
  FormState,
  FormStateTableCursor,
  InsertFormField,
  InsertFormRelation,
  InsertFormState,
} from "../../formState";
import { Table, system } from "../../system";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { Style } from "../../styleTypes";
import { downcaseFirst } from "../../utils/inflectors";
import { stringLiteral } from "../../utils/sqlHelpers";
import { alert } from "../alert";
import { button } from "../button";
import { card } from "../card";
import { checkbox } from "../checkbox";
import { divider } from "../divider";
import { formControl } from "../formControl";
import { formHelperText } from "../formHelperText";
import { formLabel } from "../formLabel";
import { iconButton } from "../iconButton";
import { materialIcon } from "../materialIcon";
import { typography } from "../typography";
import { getUniqueUiId } from "../utils";
import { fieldFormControl } from "./fieldFormControl";
import { labelOnLeftFormField } from "./labelOnLeftFormField";
import {
  labelOnLeftStyles,
  genericFormStyles,
  multiCardInsertStyles,
  twoColumnFormStyles,
} from "./sharedFormStyles";
import { DomStatements, DomStatementsOrFn } from "../../statements";

export interface InsertGridFormPart {
  styles?: Style;
  field?: string;
  initialValue?: string;
  label?: string;
  onChange?: (formState: FormState, s: DomStatements) => unknown;
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
          cursor: FormStateTableCursor,
          s: DomStatements,
        ) => unknown;
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

export interface SingleColumnPart {
  field: string;
  initialValue?: string;
  label?: string;
  onChange?: (formState: FormState, s: DomStatements) => DomStatements;
}

export interface SingleColumnOpts {
  header?: string;
  parts: SingleColumnPart[];
}

export type AutoSingleColumnFieldOverride = Partial<
  Omit<SingleColumnPart, "field">
>;

export interface AutoSingleColumnOpts {
  header?: string;
  ignoreFields?: string[];
  fieldOverrides?: Record<string, AutoSingleColumnFieldOverride>;
}

export interface TwoColumnSectionedSection {
  styles?: Style;
  header: string;
  description?: string;
  parts?: InsertGridFormPart[];
  relation?: InsertRelationFormPart;
}

export interface TwoColumnSectionedOpts {
  header?: string;
  sections: TwoColumnSectionedSection[];
}

export interface InsertFormContentOpts {
  table: Table;
  formState: InsertFormState;
  cancel:
    | { type: "Href"; href: string }
    | {
        type: "Proc";
        proc: DomStatementsOrFn;
      };
}

export function getFieldsAndRelationsFromTwoColumnSectioned(
  content: TwoColumnSectionedOpts,
) {
  let fields: InsertFormField[] = [];
  const relations: InsertFormRelation[] = [];
  for (const section of content.sections) {
    if (section.relation) {
      relations.push({
        table: section.relation.table,
        fields: section.relation.fields.map((f) =>
          typeof f === "string" ? { field: f } : f,
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
  return { fields, relations };
}

export function getFieldsFromAutoSingleColumn(
  opts: AutoSingleColumnOpts,
  table: Table,
) {
  return Object.keys(table.fields)
    .filter((f) => !opts.ignoreFields?.includes(f))
    .map((f) => ({
      field: f,
      ...opts.fieldOverrides?.[f],
    }));
}

export function getFieldsFromSingleColumn(opts: SingleColumnOpts) {
  return opts.parts.map((p) => ({
    field: p.field,
    initialValue: p.initialValue,
  }));
}

function gridPart(
  part: InsertGridFormPart,
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
          slots: { input: { props: { id } } },
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
    onChange: (s) => part.onChange?.(formState, s),
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
        children: stringLiteral(part.label ?? field.displayName),
      }),
      fieldValue,
      nodes.if(
        fieldHelper.hasError,
        formHelperText({ children: fieldHelper.error }),
      ),
    ],
  });
}

export function twoColumnSectionedContent(
  content: TwoColumnSectionedOpts,
  { table, formState, cancel }: InsertFormContentOpts,
): Node {
  const header = stringLiteral(
    content.header ?? downcaseFirst(table.displayName),
  );
  const sections: Node[] = [
    nodes.element("h1", {
      styles: genericFormStyles.pageHeader,
      children: `'Add new ' || ${header}`,
    }),
  ];
  for (const section of content.sections) {
    sections.push(divider());
    let sectionBody: Node;
    if (section.relation) {
      const relationTable = system.db.tables[section.relation.table];
      sectionBody = nodes.element("div", {
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
                    onChange: (s) =>
                      normalizedFieldOpts.onChange?.(formState, cursor, s),
                  });
                }),
                nodes.element("div", {
                  styles: twoColumnFormStyles.cardFooter,
                  children: iconButton({
                    color: "danger",
                    variant: "plain",
                    size: "sm",
                    children: materialIcon("Delete"),
                    on: { click: cursor.delete },
                    ariaLabel: `'Delete'`,
                  }),
                }),
              ],
            }),
          ),
          nodes.element("div", {
            styles: multiCardInsertStyles.addButtonWrapper,
            children: nodes.element("button", {
              styles: multiCardInsertStyles.addButton,
              children: typography({
                startDecorator: materialIcon("Add"),
                children: `'Add ' || ${stringLiteral(
                  downcaseFirst(relationTable.displayName),
                )}`,
              }),
              on: {
                click: formState.addRecordToTable(relationTable.name, {}),
              },
            }),
          }),
        ],
      });
    } else if (section.parts) {
      sectionBody = nodes.element("div", {
        styles: section.styles
          ? [twoColumnFormStyles.partsWrapper, section.styles]
          : twoColumnFormStyles.partsWrapper,
        children: section.parts.map((p) => gridPart(p, formState, table)),
      });
    } else {
      sectionBody = nodes.element("div", {
        children: `'You should specify a relation or parts'`,
      });
    }
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
          sectionBody,
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
          children: `'Add new ' || ${header}`,
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

export function autoSingleColumnContent(
  opts: AutoSingleColumnOpts,
  contentOpts: InsertFormContentOpts,
) {
  const parts = Object.keys(contentOpts.table.fields)
    .filter((f) => !opts.ignoreFields?.includes(f))
    .map((f) => ({ field: f, ...opts.fieldOverrides?.[f] }));
  return singleColumnContent({ parts, header: opts.header }, contentOpts);
}

export function singleColumnContent(
  content: SingleColumnOpts,
  { table, formState, cancel }: InsertFormContentOpts,
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
        onChange: (s) => part.onChange?.(formState, s),
      }),
    );
  }
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
          children: "'Add'",
          loading: formState.submitting,
          on: { click: formState.onSubmit },
        }),
      ],
    }),
  );
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
  return nodes.element("div", {
    styles: labelOnLeftStyles.root,
    children: fields,
  });
}
