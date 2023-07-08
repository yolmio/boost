import { each, element, state } from "../../nodeHelpers.js";
import { exit, if_, modify, scalar, setScalar } from "../../procHelpers.js";
import { button } from "../../components/button.js";
import { checkbox } from "../../components/checkbox.js";
import { input } from "../../components/input.js";
import { triggerQueryRefresh } from "./baseDatagrid.js";
import { createStyles } from "../../styleUtils.js";
import { divider } from "../../components/divider.js";
import { styles as sharedStyles } from "./styles.js";
import { SuperGridDts } from "./superGrid.js";

const styles = createStyles({
  columnsWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    maxHeight: 500,
    overflow: "auto",
  },
});

export function columnsPopover(dts: SuperGridDts) {
  return state({
    procedure: [scalar(`filter_text`, `''`)],
    children: [
      input({
        variant: "outlined",
        color: "neutral",
        size: "sm",
        slots: {
          input: {
            props: { value: `filter_text`, placeholder: "'Find a column...'" },
          },
        },
        on: {
          input: [setScalar(`ui.filter_text`, `target_value`)],
        },
      }),
      divider({ styles: sharedStyles.popoverDivider }),
      element("div", {
        styles: styles.columnsWrapper,
        children: each({
          table: "column",
          orderBy: "ordering",
          where: `dt.${dts.idToDisplayName}(id) is not null and (trim(filter_text) = '' or dt.${dts.idToDisplayName}(id) like '%' || filter_text || '%')`,
          key: "id",
          recordName: "column_record",
          children: checkbox({
            variant: "soft",
            size: "sm",
            color: "primary",
            checked: `column_record.displaying`,
            label: `dt.${dts.idToDisplayName}(column_record.id)`,
            on: {
              click: [
                if_(
                  `column_record.displaying and (select count(*) from ui.column where displaying) = 1`,
                  exit()
                ),
                modify(
                  `update ui.column set displaying = not displaying where id = column_record.id`
                ),
                if_(`column_record.displaying`, [triggerQueryRefresh()]),
              ],
            },
          }),
        }),
      }),
      element("div", {
        styles: sharedStyles.popoverButtons,
        children: [
          button({
            variant: "outlined",
            color: "primary",
            children: "'Show all'",
            on: {
              click: [
                modify(`update ui.column set displaying = true`),
                triggerQueryRefresh(),
              ],
            },
          }),
          button({
            variant: "outlined",
            color: "primary",
            children: "'Show none'",
            on: {
              click: [
                modify(`update ui.column set displaying = false where id != 0`),
                triggerQueryRefresh(),
              ],
            },
          }),
        ],
      }),
    ],
  });
}
