import { nodes } from "../../nodeHelpers";
import { app } from "../../app";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { divider } from "../../components/divider";
import { typography } from "../../components/typography";
import { card, cardOverflow } from "../../components/card";
import { Style } from "../../styleTypes";
import { Node } from "../../nodeTypes";
import { pluralize } from "../../utils/inflectors";
import { button } from "../../components/button";
import { SqlExpression } from "../../yom";
import { chip } from "../../components/chip";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay";
import { getAssociationTable } from "../../utils/association";
import { iconButton } from "../../components/iconButton";
import { materialIcon } from "../../components/materialIcon";
import { deleteRecordDialog } from "../../components/deleteRecordDialog";
import { withInsertFormState } from "../../formState";
import { formControl } from "../../components/formControl";
import { formLabel } from "../../components/formLabel";
import { getTableRecordSelect } from "../../components/tableRecordSelect";
import { formHelperText } from "../../components/formHelperText";
import { alert } from "../../components/alert";
import { getUniqueUiId } from "../../components/utils";
import { RecordGridBuilder } from "../recordGrid";

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
  displayValues: TableDisplayValue[];
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

export function content(opts: Opts, ctx: RecordGridBuilder) {
  const otherTable = app.db.tables[opts.table];
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
  const displayValues = opts.displayValues;
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
  return nodes.state({
    procedure: (s) => s.scalar(`adding`, `false`).scalar(`row_count`, `20`),
    children: card({
      variant: "outlined",
      styles: opts.styles,
      children: [
        nodes.element("div", {
          styles: styles.header,
          children: [
            typography({
              level: "h6",
              startDecorator: opts.headerStartDecorator,
              children:
                opts.header ?? stringLiteral(pluralize(otherTable.displayName)),
            }),
            nodes.element("div", { styles: flexGrowStyles }),
            iconButton({
              variant: "soft",
              color: "primary",
              size: "sm",
              children: nodes.if({
                condition: `adding`,
                then: materialIcon("Close"),
                else: materialIcon("Add"),
              }),
              on: { click: (s) => s.setScalar(`adding`, `not adding`) },
            }),
          ],
        }),
        nodes.if(
          `adding`,
          withInsertFormState({
            table: assocTable.name,
            withValues: { [toCurrentField.name]: ctx.recordId },
            afterTransactionCommit: (_, s) =>
              s.statements(ctx.triggerRefresh).setScalar(`adding`, `false`),
            fields: [{ field: toOtherField.name }],
            children: (formState) => {
              const otherFieldHelper = formState.field(toOtherField.name);
              return [
                nodes.element("div", {
                  styles: {
                    mb: 2,
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 2,
                  },
                  children: [
                    formControl({
                      styles: { flexGrow: 1 },
                      error: otherFieldHelper.hasError,
                      children: [
                        formLabel({
                          children: stringLiteral(toOtherField.displayName),
                          required: toOtherField.notNull,
                        }),
                        getTableRecordSelect(otherTable.name, {
                          value: otherFieldHelper.value,
                          onSelectValue: (v) => otherFieldHelper.setValue(v),
                          error: otherFieldHelper.hasError,
                        }),
                        nodes.if(
                          otherFieldHelper.hasError,
                          formHelperText({
                            children: otherFieldHelper.error,
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
                        click: formState.onSubmit,
                      },
                    }),
                  ],
                }),
                nodes.if(
                  formState.hasFormError,
                  alert({
                    styles: { mt: 1 },
                    color: "danger",
                    children: formState.formError,
                  })
                ),
              ];
            },
          })
        ),
        divider(),
        cardOverflow({
          children: nodes.state({
            watch: [ctx.refreshKey, `row_count`],
            procedure: (s) =>
              s
                .record("related", relatedQuery)
                .scalar(`service_row_count`, `row_count`),
            children: nodes.element("ul", {
              styles: styles.list,
              props: {
                id: listScrollId,
              },
              on: {
                scroll: (s) =>
                  s
                    .if(
                      `status != 'received' or (service_row_count is not null and (select count(*) from related) < service_row_count)`,
                      (s) => s.return()
                    )
                    .getElProperty(
                      "scrollHeight",
                      "el_scroll_height",
                      listScrollId
                    )
                    .getBoundingClientRect(listScrollId, "el_rect")
                    .getElProperty("scrollTop", "el_scroll_top", listScrollId)
                    .if(
                      `el_scroll_height - el_scroll_top - el_rect.height < 300`,
                      (s) => s.setScalar(`row_count`, `row_count + 20`)
                    ),
              },
              children: nodes.each({
                table: "related",
                recordName: "record",
                key: "record.assoc_id",
                children: nodes.element("li", {
                  styles: styles.listItem,
                  children: [
                    recordDisplayName
                      ? nodes.element("a", {
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
                    nodes.element("div", { styles: flexGrowStyles }),
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
                          return nodes.if(
                            value,
                            chip({
                              variant: "soft",
                              color: "neutral",
                              size: "sm",
                              children: stringLiteral(field.displayName),
                            })
                          );
                        }
                        const content = nodes.element("div", {
                          styles: styles.itemValueWrapper,
                          children: [
                            nodes.element("p", {
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
                        return nodes.if(value + ` is not null`, content);
                      } else {
                        return nodes.element("div", {
                          styles: styles.itemValueWrapper,
                          children: [
                            nodes.element("p", {
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
                    nodes.state({
                      procedure: (s) => s.scalar(`deleting`, `false`),
                      children: [
                        iconButton({
                          variant: "plain",
                          color: "neutral",
                          size: "sm",
                          children: materialIcon("DeleteOutlined"),
                          on: { click: (s) => s.setScalar(`deleting`, `true`) },
                        }),
                        deleteRecordDialog({
                          open: `deleting`,
                          onClose: (s) => s.setScalar(`deleting`, `false`),
                          recordId: `related.assoc_id`,
                          table: assocTable.name,
                          afterDeleteService: ctx.triggerRefresh,
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
