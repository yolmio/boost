import { Field } from "../../modelTypes.js";
import { element, state } from "../../nodeHelpers.js";
import { scalar } from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { createStyles } from "../../styleUtils.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";

const styles = createStyles({
  link: {
    color: "primary-500",
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
});

export function inlineFieldDisplay(field: Field, expr: string) {
  switch (field.type) {
    case "Date": {
      const formatString = stringLiteral(field.formatString ?? "%-d %b %Y");
      return `format.date(${expr}, ${formatString})`;
    }
    case "ForeignKey": {
      const toTable = model.database.tables[field.table];
      if (toTable.inlineRecordDisplay) {
        return toTable.inlineRecordDisplay(expr);
      }
      if (!toTable.recordDisplayName) {
        throw new Error(
          `Table ${field.table} does not have a recordDisplayName`
        );
      }
      const nameExpr = toTable.recordDisplayName.expr(
        ...toTable.recordDisplayName.fields.map((f) => `other.${f}`)
      );
      let innerDisplay;
      if (toTable.getHrefToRecord) {
        innerDisplay = element("a", {
          styles: styles.link,
          props: {
            href: toTable.getHrefToRecord(expr),
          },
          children: `name`,
        });
      } else {
        innerDisplay = `name`;
      }
      return state({
        watch: [expr],
        procedure: [
          scalar(
            `name`,
            `(select ${nameExpr} from db.${field.table} as other where other.id = ${expr})`
          ),
        ],
        children: innerDisplay,
      });
    }
    case "Decimal": {
      if (field.usage) {
        switch (field.usage.type) {
          case "Money": {
            return `format.currency(${expr}, 'usd')`;
          }
          case "Percentage": {
            return `format.percent(${expr})`;
          }
        }
      } else {
        expr = `format.decimal(${expr})`;
      }
      break;
    }
    case "BigInt":
    case "BigUint":
    case "Uint":
    case "Int":
    case "SmallInt":
    case "SmallUint": {
      if (field.usage) {
        switch (field.usage.type) {
          case "Money": {
            return `format.currency(${expr}, 'usd')`;
          }
          case "Duration": {
            if (field.usage.size === "minutes") {
              return `sfn.display_minutes_duration(${expr})`;
            }
            throw new Error("Only minutes duration is supported");
          }
        }
      }
      expr = `format.decimal(${expr})`;
      break;
    }
    case "Enum": {
      expr = `dt.display_${field.enum}(${expr})`;
      break;
    }
    case "Bool": {
      if (field.enumLike) {
        const trueStr = stringLiteral(field.enumLike.true);
        const falseStr = stringLiteral(field.enumLike.false);
        if (field.enumLike.null) {
          const nullStr = stringLiteral(field.enumLike.null);
          expr = `case when ${expr} is null then ${nullStr} when ${expr} then ${trueStr} else ${falseStr} end`;
        } else {
          expr = `case when ${expr} then ${trueStr} else ${falseStr} end`;
        }
      }
    }
  }
  return expr;
}
