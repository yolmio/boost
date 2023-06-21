import { Field } from "../../modelTypes.js";
import { element, state } from "../../nodeHelpers.js";
import { scalar } from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { typography } from "../typography.js";

export function inlineFieldDisplay(field: Field, expr: string) {
  switch (field.type) {
    case "Date": {
      const formatString = stringLiteral(field.formatString ?? "%-d %b %Y");
      return typography({
        level: "body1",
        children: `format.date(record.${field.name.name}, ${formatString})`,
      });
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
          styles: {
            color: "primary-500",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          },
          props: {
            href: toTable.getHrefToRecord(`record.${field.name.name}`),
          },
          children: `name`,
        });
      } else {
        innerDisplay = typography({
          level: "body1",
          children: `name`,
        });
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
            return typography({
              level: "body1",
              children: `format.currency(${expr}, 'usd')`,
            });
          }
          case "Percentage": {
            return typography({
              level: "body1",
              children: `format.percent(${expr})`,
            });
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
  return typography({
    level: "body1",
    children: expr,
  });
}
