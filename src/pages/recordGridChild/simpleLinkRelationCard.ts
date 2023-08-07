import { each, element, ifNode, state } from "../../nodeHelpers";
import {
  exit,
  getBoundingClientRect,
  getElProperty,
  if_,
  record,
  scalar,
  setScalar,
} from "../../procHelpers";
import { app } from "../../singleton";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { divider } from "../../components/divider";
import { materialIcon } from "../../components/materialIcon";
import { typography } from "../../components/typography";
import { displayAddressText } from "./displayAddressText";
import { card, cardOverflow } from "../../components/card";
import { Style } from "../../styleTypes";
import { RecordGridContext } from "./shared";
import { Node } from "../../nodeTypes";
import { pluralize } from "../../utils/inflectors";
import { button } from "../../components/button";
import { SqlExpression } from "../../yom";
import { chip } from "../../components/chip";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay";
import { getUniqueUiId } from "../../components/utils";

export const name = "simpleLinkRelationCard";

export type TableDisplayValue =
  | string
  | {
      expr: SqlExpression;
      label: string;
      display: (e: SqlExpression) => Node;
    };

export interface Opts {
  table: string;
  fkField?: string;
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
  const otherTable = app.db.tables[opts.table];
  const listScrollId = stringLiteral(getUniqueUiId());
  if (!otherTable) {
    throw new Error(`Table ${opts.table} not found`);
  }
  if (!otherTable.getHrefToRecord) {
    throw new Error(`Table ${opts.table} does not have getHrefToRecord`);
  }
  const foreignKeyField = Object.values(otherTable.fields).find(
    (f) => f.type === "ForeignKey" && f.table === ctx.table.name
  );
  if (!foreignKeyField) {
    throw new Error(
      `No foreign key field found for ${ctx.table.name} to ${opts.table}`
    );
  }
  const displayValues = opts.displayValues(ctx);
  let selectFields = "";
  for (let i = 0; i < displayValues.length; i++) {
    const value = displayValues[i];
    selectFields += ", ";
    if (typeof value === "string") {
      selectFields += ident(value);
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
  return state({
    procedure: [scalar(`row_count`, `20`)],
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
          ],
        }),
        divider(),
        cardOverflow({
          children: state({
            watch: [ctx.refreshKey, `row_count`],
            procedure: [
              record(
                "related",
                `select id${selectFields} from db.${ident(opts.table)} where ${
                  foreignKeyField.name
                } = ${ctx.recordId} order by id desc limit row_count`
              ),
              scalar(`service_row_count`, `row_count`),
            ],
            children: element("ul", {
              styles: styles.list,
              props: { id: listScrollId },
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
                key: "record.id",
                children: element("li", {
                  styles: styles.listItem,
                  children: [
                    recordDisplayName
                      ? element("a", {
                          props: {
                            href: otherTable.getHrefToRecord("record.id"),
                          },
                          styles: styles.link,
                          children: `record.display_name`,
                        })
                      : button({
                          variant: "soft",
                          children: `'View'`,
                          href: otherTable.getHrefToRecord("record.id"),
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
