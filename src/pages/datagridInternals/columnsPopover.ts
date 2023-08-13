import { nodes } from "../../nodeHelpers";
import { button } from "../../components/button";
import { checkbox } from "../../components/checkbox";
import { input } from "../../components/input";
import { triggerQueryRefresh } from "./shared";
import { createStyles } from "../../styleUtils";
import { divider } from "../../components/divider";
import { styles as sharedStyles } from "./styles";
import { SuperGridDts } from "./styledDatagrid";

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
  return nodes.state({
    procedure: (s) => s.scalar(`filter_text`, `''`),
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
          input: (s) => s.setScalar(`ui.filter_text`, `target_value`),
        },
      }),
      divider({ styles: sharedStyles.popoverDivider }),
      nodes.element("div", {
        styles: styles.columnsWrapper,
        children: nodes.each({
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
              click: (s) =>
                s
                  .if(
                    `column_record.displaying and (select count(*) from ui.column where displaying) = 1`,
                    (s) => s.return()
                  )
                  .modify(
                    `update ui.column set displaying = not displaying where id = column_record.id`
                  )
                  .if(`column_record.displaying`, triggerQueryRefresh()),
            },
          }),
        }),
      }),
      nodes.element("div", {
        styles: sharedStyles.popoverButtons,
        children: [
          button({
            variant: "outlined",
            color: "primary",
            children: "'Show all'",
            on: {
              click: (s) =>
                s
                  .modify(`update ui.column set displaying = true`)
                  .statements(triggerQueryRefresh()),
            },
          }),
          button({
            variant: "outlined",
            color: "primary",
            children: "'Show none'",
            on: {
              click: (s) =>
                s
                  .modify(
                    `update ui.column set displaying = false where id != 0`
                  )
                  .statements(triggerQueryRefresh()),
            },
          }),
        ],
      }),
    ],
  });
}
