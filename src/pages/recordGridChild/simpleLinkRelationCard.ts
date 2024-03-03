import { nodes } from "../../nodeHelpers";
import { system } from "../../system";
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
  const otherTable = system.db.tables[opts.table];
  const listScrollId = stringLiteral(getUniqueUiId());
  if (!otherTable) {
    throw new Error(`Table ${opts.table} not found`);
  }
  if (!otherTable.getHrefToRecord) {
    throw new Error(`Table ${opts.table} does not have getHrefToRecord`);
  }
  const foreignKeyField = Object.values(otherTable.fields).find(
    (f) => f.type === "ForeignKey" && f.table === ctx.table.name,
  );
  if (!foreignKeyField) {
    throw new Error(
      `No foreign key field found for ${ctx.table.name} to ${opts.table}`,
    );
  }
  const displayValues = opts.displayValues;
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
      ...recordDisplayName.fields.map(
        (f) => `${ident(opts.table)}.${ident(f)}`,
      ),
    )} as display_name`;
  }
  return nodes.state({
    procedure: (s) => s.scalar(`row_count`, `20`),
    children: card({
      variant: "outlined",
      styles: opts.styles,
      children: [
        nodes.element("div", {
          styles: styles.header,
          children: [
            typography({
              level: "body-lg",
              startDecorator: opts.headerStartDecorator,
              children:
                opts.header ?? stringLiteral(pluralize(otherTable.displayName)),
            }),
          ],
        }),
        divider(),
        cardOverflow({
          children: nodes.state({
            watch: [ctx.refreshKey, `row_count`],
            procedure: (s) =>
              s
                .record(
                  "related",
                  `select id${selectFields} from db.${ident(
                    opts.table,
                  )} where ${foreignKeyField.name} = ${
                    ctx.recordId
                  } order by id desc limit row_count`,
                )
                .scalar(`service_row_count`, `row_count`),
            children: nodes.element("ul", {
              styles: styles.list,
              props: { id: listScrollId },
              on: {
                scroll: (s) =>
                  s
                    .if(
                      `status != 'received' or (service_row_count is not null and (select count(*) from related) < service_row_count)`,
                      (s) => s.return(),
                    )
                    .getElProperty(
                      "scrollHeight",
                      "el_scroll_height",
                      listScrollId,
                    )
                    .getBoundingClientRect(listScrollId, "el_rect")
                    .getElProperty("scrollTop", "el_scroll_top", listScrollId)
                    .if(
                      `el_scroll_height - el_scroll_top - el_rect.height < 300`,
                      (s) => s.setScalar(`row_count`, `row_count + 20`),
                    ),
              },
              children: nodes.each({
                table: "related",
                recordName: "record",
                key: "record.id",
                children: nodes.element("li", {
                  styles: styles.listItem,
                  children: [
                    recordDisplayName
                      ? nodes.element("a", {
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
                    nodes.element("div", { styles: flexGrowStyles }),
                    displayValues.map((displayValue, i) => {
                      if (typeof displayValue === "string") {
                        const field = otherTable.fields[displayValue];
                        if (!field) {
                          throw new Error(
                            `Field ${displayValue} does not exist in table ${otherTable.name}`,
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
                            }),
                          );
                        }
                        const content = nodes.element("div", {
                          styles: styles.itemValueWrapper,
                          children: [
                            nodes.element("p", {
                              styles: styles.itemValue,
                              children: `${stringLiteral(
                                field.displayName,
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
                                displayValue.label,
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
