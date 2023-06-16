import {
  FormState,
  FormStateTableCursor,
  InsertFormField,
  withMultiInsertFormState,
} from "../formState.js";
import { addPage } from "../modelHelpers.js";
import { element, ifNode, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { scalar, setScalar } from "../procHelpers.js";
import { model } from "../singleton.js";
import { StyleObject } from "../styleTypes.js";
import { downcaseFirst, pluralize } from "../utils/inflectors.js";
import { lazy } from "../utils/memoize.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import {
  ClientProcStatement,
  ServiceProcStatement,
  StateStatement,
} from "../yom.js";
import { button } from "../components/button.js";
import { card } from "../components/card.js";
import { checkbox } from "../components/checkbox.js";
import { iconButton } from "../components/iconButton.js";
import { materialIcon } from "../components/materialIcon.js";
import { typography } from "../components/typography.js";
import { fieldFormControl } from "../components/internal/fieldFormControl.js";
import { createStyles } from "../styleUtils.js";
import { containerStyles } from "../styleUtils.js";
import { flexGrowStyles } from "../styleUtils.js";
import { alert } from "../components/alert.js";
import { formHelperText } from "../components/formHelperText.js";
import { formControl } from "../components/formControl.js";
import { getTableBaseUrl } from "../utils/url.js";
import { getUniqueUiId } from "../components/utils.js";
import { labelOnLeftFormField } from "../components/internal/labelOnLeftFormField.js";

export interface CardFormField extends InsertFormField {
  emptyComboboxQuery?: (
    formState: FormState,
    cursor: FormStateTableCursor
  ) => string;
  onChange?: (
    formState: FormState,
    cursor: FormStateTableCursor
  ) => ClientProcStatement[];
}

export interface MultiCardInsertPageOpts {
  path?: string;
  table: string;
  sharedSection?: {
    header: string;
    fields: {
      field: string;
      initialValue?: string;
    }[];
  };
  sharedStaticValues?: [string, string][];
  cardsHeader?: string;
  cardFields: CardFormField[];
  cardFooterFields?: { field: string }[];
  initialCardRecord?: Record<string, string>;
  /** When a new record is added, the initial values */
  initialNewValues?: Record<string, string>;

  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
  afterSubmitService?: (state: FormState) => ServiceProcStatement[];

  afterInsertScreen?: {
    node: Node;
    /** State hoisted above the form state, so that you can store information to display in the after insert screen */
    state?: StateStatement[];
  };
}

const styles = createStyles({
  root: () => {
    const containerStyle = containerStyles();
    return {
      py: 2,
      display: "flex",
      flexDirection: "column",
      gap: 2,
      ...containerStyle,
      sm: {
        ...containerStyle.sm,
        gap: 4,
      },
    };
  },
  sharedFields: {
    display: "flex",
    gap: 1,
    flexWrap: "wrap",
  },
  grid: {
    display: "grid",
    gap: 2,
    gridTemplateColumns: `repeat(1, minmax(0, 1fr))`,
    lg: {
      gridTemplateColumns: `repeat(2, minmax(0, 1fr))`,
    },
    xl: {
      gridTemplateColumns: `repeat(3, minmax(0, 1fr))`,
    },
    sm: {
      gap: 4,
    },
  },
  card: {
    gridColumn: `span 1 / span 1`,
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
  },
  cardFooterFields: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  addButtonWrapper: {
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
  buttons: {
    display: "flex",
    justifyContent: "end",
  },
});

export function multiCardInsertPage(opts: Readonly<MultiCardInsertPageOpts>) {
  const table = model.database.tables[opts.table];
  const formStateFields = opts.cardFields.slice();
  if (opts.cardFooterFields) {
    formStateFields.push(...opts.cardFooterFields);
  }
  const formContent = withMultiInsertFormState({
    table: opts.table,
    sharedFields: opts.sharedSection?.fields,
    fields: formStateFields,
    sharedStaticValues: opts.sharedStaticValues,
    afterSubmitClient: (state) => [
      ...(opts.afterSubmitClient?.(state) ?? []),
      opts.afterInsertScreen ? setScalar(`ui.added`, `true`) : null,
    ],
    afterSubmitService: opts.afterSubmitService,
    initializeFormState: opts.initialCardRecord
      ? (state) => state.addRecordToTable(opts.table, opts.initialCardRecord!)
      : undefined,
    children: ({ formState, onSubmit }) =>
      element("div", {
        styles: styles.root(),
        children: [
          opts.sharedSection
            ? [
                typography({
                  level: "h4",
                  children: opts.sharedSection.header,
                }),
                element("div", {
                  styles: styles.sharedFields,
                  children: opts.sharedSection.fields.map((f) => {
                    const field = table.fields[f.field];
                    const fieldHelper = formState.fieldHelper(f.field);
                    const control = fieldFormControl({
                      field,
                      id: stringLiteral(getUniqueUiId()),
                      fieldHelper,
                    });
                    if (!control) {
                      throw new Error(
                        "multiCardInsert does not handle field of type " +
                          field.type +
                          "for shared fields"
                      );
                    }
                    return formControl({
                      error: fieldHelper.hasError,
                      children: [
                        control,
                        ifNode(
                          fieldHelper.hasError,
                          formHelperText({
                            children: fieldHelper.error,
                          })
                        ),
                      ],
                    });
                  }),
                }),
              ]
            : null,
          typography({
            level: "h4",
            children: `'Add your ${downcaseFirst(
              pluralize(table.name.displayName)
            )}'`,
          }),
          element("div", {
            styles: styles.grid,
            children: [
              formState.each(opts.table, (cursor) =>
                card({
                  variant: "outlined",
                  styles: styles.card,
                  children: [
                    opts.cardFields.map((f) => {
                      const field = table.fields[f.field];
                      const uniqueId = stringLiteral(getUniqueUiId());
                      const id = uniqueId + ` || ${cursor.idField}`;
                      return labelOnLeftFormField({
                        field,
                        id,
                        fieldHelper: cursor.field(field.name.name),
                        onChange: f.onChange?.(formState, cursor),
                        comboboxEmptyQuery: f.emptyComboboxQuery?.(
                          formState,
                          cursor
                        ),
                      });
                    }),
                    element("div", {
                      styles: styles.cardFooterFields,
                      children: [
                        opts.cardFooterFields &&
                          opts.cardFooterFields.map((f) => {
                            const field = table.fields[f.field];
                            const fieldHelper = cursor.field(f.field);
                            if (field.type === "Bool" && !field.enumLike) {
                              return checkbox({
                                variant: "outlined",
                                checked: fieldHelper.value,
                                on: {
                                  checkboxChange: [
                                    fieldHelper.setValue(
                                      `not ${fieldHelper.value}`
                                    ),
                                  ],
                                },
                                label: stringLiteral(field.name.displayName),
                              });
                            }
                            throw new Error(
                              "multiCardInsert does not handle field of type " +
                                field.type +
                                "for card footer fields"
                            );
                          }),
                        element("div", { styles: flexGrowStyles }),
                        iconButton({
                          color: "danger",
                          variant: "plain",
                          size: "sm",
                          children: materialIcon("Delete"),
                          on: { click: [cursor.delete] },
                        }),
                      ],
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
                    children: `'Add another ' || ${stringLiteral(
                      downcaseFirst(table.name.displayName)
                    )}`,
                  }),
                  on: {
                    click: [
                      ...formState.addRecordToTable(
                        opts.table,
                        opts.initialNewValues ?? {}
                      ),
                    ],
                  },
                }),
              }),
            ],
          }),
          ifNode(
            formState.getFormError + " is not null",
            alert({
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
            on: { click: onSubmit },
            children: [
              button({
                size: "lg",
                loading: formState.submitting,
                children: `'Confirm new ${downcaseFirst(
                  pluralize(table.name.displayName)
                )}'`,
              }),
            ],
          }),
        ],
      }),
  });
  let content = formContent;
  if (opts.afterInsertScreen) {
    content = state({
      procedure: [
        scalar(`added`, `false`),
        ...(opts.afterInsertScreen.state ?? []),
      ],
      children: ifNode(`added`, opts.afterInsertScreen.node, content),
    });
  }
  addPage({
    path: opts.path ?? "/" + getTableBaseUrl(table.name.name) + "/add",
    content,
  });
}
