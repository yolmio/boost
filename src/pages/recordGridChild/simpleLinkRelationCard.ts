import { each, element, ifNode, state } from "../../nodeHelpers.js";
import { record } from "../../procHelpers.js";
import { app } from "../../singleton.js";
import { createStyles, flexGrowStyles } from "../../styleUtils.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { divider } from "../../components/divider.js";
import { materialIcon } from "../../components/materialIcon.js";
import { typography } from "../../components/typography.js";
import { displayAddressText } from "./displayAddressText.js";
import { card, cardOverflow } from "../../components/card.js";
import { Style } from "../../styleTypes.js";
import { RecordGridContext } from "./shared.js";
import { Node } from "../../nodeTypes.js";
import { pluralize } from "../../utils/inflectors.js";
import { button } from "../../components/button.js";
import { SqlExpression } from "../../yom.js";
import { chip } from "../../components/chip.js";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay.js";

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
    p: 0,
    mt: 1,
    mb: 0,
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
  let selectFields = "";
  for (let i = 0; i < opts.displayValues.length; i++) {
    const value = opts.displayValues[i];
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
  return card({
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
          watch: [ctx.refreshKey],
          procedure: [
            record(
              "related",
              `select id${selectFields} from db.${ident(opts.table)} where ${
                foreignKeyField.name
              } = ${ctx.recordId}`
            ),
          ],
          children: element("ul", {
            styles: styles.list,
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
                  opts.displayValues.map((displayValue, i) => {
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
  });
}
