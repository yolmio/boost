import { each, element, ifNode, state } from "../../nodeHelpers.js";
import {
  debugExpr,
  exit,
  getBoundingClientRect,
  getElProperty,
  if_,
  record,
  scalar,
  setScalar,
} from "../../procHelpers.js";
import { app } from "../../singleton.js";
import { createStyles, flexGrowStyles } from "../../styleUtils.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { divider } from "../../components/divider.js";
import { typography } from "../../components/typography.js";
import { card, cardOverflow } from "../../components/card.js";
import { Style } from "../../styleTypes.js";
import { RecordGridContext } from "./shared.js";
import { Node } from "../../nodeTypes.js";
import { pluralize } from "../../utils/inflectors.js";
import { button } from "../../components/button.js";
import { SqlExpression } from "../../yom.js";
import { chip } from "../../components/chip.js";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay.js";
import { getAssociationTable } from "../../utils/association.js";
import { iconButton } from "../../components/iconButton.js";
import { materialIcon } from "../../components/materialIcon.js";
import { deleteRecordDialog } from "../../components/deleteRecordDialog.js";
import { withInsertFormState } from "../../formState.js";
import { formControl } from "../../components/formControl.js";
import { formLabel } from "../../components/formLabel.js";
import { getTableRecordSelect } from "../../components/tableRecordSelect.js";
import { formHelperText } from "../../components/formHelperText.js";
import { alert } from "../../components/alert.js";
import { getUniqueUiId } from "../../components/utils.js";

export const name = "simpleLinkAssociationCard";

export type TableDisplayValue =
  | string
  | {
      expr: SqlExpression;
      label: string;
      display: (e: SqlExpression) => Node;
    };

export interface Opts {
  table: string;
  associationTable?: string;
  styles?: Style;
  headerStartDecorator?: Node;
  header?: string;
  displayValues: (ctx: RecordGridContext) => TableDisplayValue[];
}

const styles = createStyles({
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    pb: 1.5,
  },
  list: {
    listStyle: "none",
    px: 0,
    py: 1,
    my: 0,
    overflowY: "auto",
    maxHeight: "300px",
  },
  listItem: {
    p: 0,
    display: "flex",
    alignItems: "center",
    gap: 2,
    "&:not(:last-child)": {
      borderBottom: "1px solid",
      borderBottomColor: "divider",
      mb: 1,
      pb: 1,
    },
    px: 2,
  },
  itemValue: {
    mr: 0.5,
    color: "text-secondary",
    my: 0,
    fontSize: "sm",
    alignSelf: "flex-end",
  },
  itemValueWrapper: {
    display: "flex",
    flexDirection: "column",
    mb: 2,
  },
  link: {
    color: "primary-500",
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
});

export function content(opts: Opts, ctx: RecordGridContext) {
  const otherTable = app.database.tables[opts.table];
  const listScrollId = stringLiteral(getUniqueUiId());
  if (!otherTable) {
    throw new Error(`Table ${opts.table} not found`);
  }
  if (!otherTable.getHrefToRecord) {
    throw new Error(`Table ${opts.table} does not have getHrefToRecord`);
  }
  const assocTableMatch = getAssociationTable(ctx.table.name, opts.table);
  if (assocTableMatch === "ambiguous") {
    throw new Error(
      `Ambiguous association between ${ctx.table.name} and ${opts.table}`
    );
  }
  if (assocTableMatch === "notFound") {
    throw new Error(
      `No association found between ${ctx.table.name} and ${opts.table}`
    );
  }
  const {
    table: assocTable,
    toLeft: toCurrentField,
    toRight: toOtherField,
  } = assocTableMatch;
  const displayValues = opts.displayValues(ctx);
  let selectFields = "";
  for (let i = 0; i < displayValues.length; i++) {
    const value = displayValues[i];
    selectFields += ", ";
    if (typeof value === "string") {
      selectFields += `${ident(otherTable.name)}.${ident(value)}`;
    } else {
      selectFields += `${value.expr} as expr_${i}`;
    }
  }
  const { recordDisplayName } = otherTable;
  if (recordDisplayName) {
    selectFields += `, ${recordDisplayName.expr(
      ...recordDisplayName.fields.map((f) => `${ident(opts.table)}.${ident(f)}`)
    )} as display_name`;
  }
  const relatedQuery = `select
    ${ident(otherTable.name)}.${ident(
    otherTable.primaryKeyFieldName
  )} as other_id,
    ${ident(assocTable.name)}.${ident(
    assocTable.primaryKeyFieldName
  )} as assoc_id
  ${selectFields}
    from db.${ident(assocTable.name)}
        join db.${ident(otherTable.name)}
            on ${ident(otherTable.name)}.${ident(
    otherTable.primaryKeyFieldName
  )} = ${ident(assocTable.name)}.${ident(toOtherField.name)}
    where ${ident(assocTable.name)}.${ident(toCurrentField.name)} = ${
    ctx.recordId
  } order by ${ident(assocTable.name)}.${ident(
    assocTable.primaryKeyFieldName
  )} desc
  limit row_count`;
  return state({
    procedure: [scalar(`adding`, `false`), scalar(`row_count`, `20`)],
    children: card({
      variant: "outlined",
      styles: opts.styles,
      children: [
        element("div", {
          styles: styles.header,
          children: [
            typography({
              level: "h6",
              startDecorator: opts.headerStartDecorator,
              children:
                opts.header ?? stringLiteral(pluralize(otherTable.displayName)),
            }),
            element("div", { styles: flexGrowStyles }),
            iconButton({
              variant: "soft",
              color: "primary",
              size: "sm",
              children: ifNode(
                `adding`,
                materialIcon("Close"),
                materialIcon("Add")
              ),
              on: { click: [setScalar(`adding`, `not adding`)] },
            }),
          ],
        }),
        ifNode(
          `adding`,
          withInsertFormState({
            table: assocTable.name,
            withValues: { [toCurrentField.name]: ctx.recordId },
            afterTransactionCommit: () => [
              ctx.triggerRefresh,
              setScalar(`adding`, `false`),
            ],
            fields: [{ field: toOtherField.name }],
            children: ({ formState, onSubmit }) => [
              element("div", {
                styles: {
                  mb: 2,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 2,
                },
                children: [
                  formControl({
                    styles: { flexGrow: 1 },
                    error: formState.fields.hasError(toOtherField.name),
                    children: [
                      formLabel({
                        children: stringLiteral(toOtherField.displayName),
                        required: toOtherField.notNull,
                      }),
                      getTableRecordSelect(otherTable.name, {
                        value: formState.fields.get(toOtherField.name),
                        onSelectValue: (v) => [
                          formState.fields.set(toOtherField.name, v),
                        ],
                        error: formState.fields.hasError(toOtherField.name),
                      }),
                      ifNode(
                        formState.fields.hasError(toOtherField.name),
                        formHelperText({
                          children: formState.fields.error(toOtherField.name),
                        })
                      ),
                    ],
                  }),
                  button({
                    children: `'Add ' || ${stringLiteral(
                      otherTable.displayName
                    )}`,
                    loading: formState.submitting,
                    on: {
                      click: onSubmit,
                    },
                  }),
                ],
              }),
              ifNode(
                formState.hasFormError,
                alert({
                  styles: { mt: 1 },
                  color: "danger",
                  children: formState.getFormError,
                })
              ),
            ],
          })
        ),
        divider(),
        cardOverflow({
          children: state({
            watch: [ctx.refreshKey, `row_count`],
            procedure: [
              record("related", relatedQuery),
              scalar(`service_row_count`, `row_count`),
            ],
            children: element("ul", {
              styles: styles.list,
              props: {
                id: listScrollId,
              },
              on: {
                scroll: [
                  if_(
                    `status != 'received' or (service_row_count is not null and (select count(*) from related) < service_row_count)`,
                    [exit()]
                  ),
                  getElProperty(
                    "scrollHeight",
                    "el_scroll_height",
                    listScrollId
                  ),
                  getBoundingClientRect(listScrollId, "el_rect"),
                  getElProperty("scrollTop", "el_scroll_top", listScrollId),
                  if_(
                    `el_scroll_height - el_scroll_top - el_rect.height < 300`,
                    [setScalar(`row_count`, `row_count + 20`)]
                  ),
                ],
              },
              children: each({
                table: "related",
                recordName: "record",
                key: "record.assoc_id",
                children: element("li", {
                  styles: styles.listItem,
                  children: [
                    recordDisplayName
                      ? element("a", {
                          props: {
                            href: otherTable.getHrefToRecord("record.other_id"),
                          },
                          styles: styles.link,
                          children: `record.display_name`,
                        })
                      : button({
                          variant: "soft",
                          children: `'View'`,
                          href: otherTable.getHrefToRecord("record.other_id"),
                          size: "sm",
                        }),
                    element("div", { styles: flexGrowStyles }),
                    displayValues.map((displayValue, i) => {
                      if (typeof displayValue === "string") {
                        const field = otherTable.fields[displayValue];
                        if (!field) {
                          throw new Error(
                            `Field ${displayValue} does not exist in table ${otherTable.name}`
                          );
                        }
                        const value = `record.${ident(displayValue)}`;
                        if (field.type === "Bool") {
                          return ifNode(
                            value,
                            chip({
                              variant: "soft",
                              color: "neutral",
                              size: "sm",
                              children: stringLiteral(field.displayName),
                            })
                          );
                        }
                        const content = element("div", {
                          styles: styles.itemValueWrapper,
                          children: [
                            element("p", {
                              styles: styles.itemValue,
                              children: `${stringLiteral(
                                field.displayName
                              )} || ':'`,
                            }),
                            inlineFieldDisplay(field, value),
                          ],
                        });
                        if (field.notNull) {
                          return content;
                        }
                        return ifNode(value + ` is not null`, content);
                      } else {
                        return element("div", {
                          styles: styles.itemValueWrapper,
                          children: [
                            element("p", {
                              styles: styles.itemValue,
                              children: `${stringLiteral(
                                displayValue.label
                              )} || ':'`,
                            }),
                            displayValue.display(`record.expr_${i}`),
                          ],
                        });
                      }
                    }),
                    state({
                      procedure: [scalar(`deleting`, `false`)],
                      children: [
                        iconButton({
                          variant: "plain",
                          color: "neutral",
                          size: "sm",
                          children: materialIcon("DeleteOutlined"),
                          on: { click: [setScalar(`deleting`, `true`)] },
                        }),
                        deleteRecordDialog({
                          open: `deleting`,
                          onClose: [setScalar(`deleting`, `false`)],
                          recordId: `related.assoc_id`,
                          table: assocTable.name,
                          afterDeleteService: [ctx.triggerRefresh],
                        }),
                      ],
                    }),
                  ],
                }),
              }),
            }),
          }),
        }),
        ,
      ],
    }),
  });
}
