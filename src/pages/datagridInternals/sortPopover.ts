import { each, element, ifNode, state, switchNode } from "../../nodeHelpers.js";
import { if_, modify, scalar, setScalar } from "../../procHelpers.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { button } from "../../components/button.js";
import { iconButton } from "../../components/iconButton.js";
import { materialIcon } from "../../components/materialIcon.js";
import { select } from "../../components/select.js";
import { triggerQueryRefresh } from "./baseDatagrid.js";
import { typography } from "../../components/typography.js";
import { divider } from "../../components/divider.js";
import { styles as sharedStyles } from "./styles.js";
import { createStyles } from "../../styleUtils.js";
import { SortConfig, SuperGridColumn } from "./superGrid.js";
import { Node, SwitchNodeCase } from "../../nodeTypes.js";

const styles = createStyles({
  columns: {
    display: "flex",
    gap: 1,
  },
});

export function sortPopover(columns: SuperGridColumn[]) {
  const sorts = new Map<SortConfig, number[]>();
  const options: Node[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.displayName && col.sort) {
      if (!sorts.has(col.sort)) {
        sorts.set(col.sort, []);
      }
      sorts.get(col.sort)!.push(i);
      options.push(
        element("option", {
          props: { value: i.toString() },
          children: stringLiteral(col.displayName!),
        })
      );
    }
  }
  const ascNodeCases: SwitchNodeCase[] = [];
  const descNodeCases: SwitchNodeCase[] = [];
  for (const [sort, indices] of sorts.entries()) {
    ascNodeCases.push({
      condition: `column_record.id in (${indices.join(", ")})`,
      node: stringLiteral(sort.ascText),
    });
    descNodeCases.push({
      condition: `column_record.id in (${indices.join(", ")})`,
      node: stringLiteral(sort.descText),
    });
  }
  return [
    typography({
      level: "body2",
      children: `'Sort by'`,
    }),
    divider({ styles: sharedStyles.popoverDivider }),
    each({
      table: "column",
      key: "id",
      recordName: "column_record",
      where: "sort_index is not null",
      orderBy: "sort_index",
      children: element("div", {
        styles: styles.columns,
        children: [
          select({
            variant: "outlined",
            color: "info",
            size: "sm",
            on: {
              input: [
                scalar("new_id", "cast(target_value as int)"),
                if_("column_record.id != new_id", [
                  modify(
                    `update ui.column set sort_index = column_record.sort_index, sort_asc = column_record.sort_asc where id = new_id`
                  ),
                  modify(
                    `update ui.column set sort_index = null where id = column_record.id`
                  ),
                  triggerQueryRefresh(),
                ]),
              ],
            },
            slots: { select: { props: { value: "column_record.id" } } },
            children: options,
          }),
          select({
            variant: "outlined",
            color: "info",
            size: "sm",
            on: {
              input: [
                modify(
                  `update ui.column set sort_asc = target_value = 'asc' where id = column_record.id`
                ),
                triggerQueryRefresh(),
              ],
            },
            slots: {
              select: {
                props: {
                  value:
                    "case when column_record.sort_asc then 'asc' else 'desc' end",
                },
              },
            },
            children: [
              element("option", {
                props: { value: "'asc'" },
                children: { t: "Switch", cases: ascNodeCases },
              }),
              element("option", {
                props: { value: "'desc'" },
                children: { t: "Switch", cases: descNodeCases },
              }),
            ],
          }),
          iconButton({
            variant: "plain",
            color: "info",
            size: "sm",
            children: materialIcon("Close"),
            on: {
              click: [
                modify(
                  `update ui.column set sort_index = null where id = column_record.id`
                ),
                triggerQueryRefresh(),
              ],
            },
          }),
        ],
      }),
    }),
    state({
      procedure: [scalar("adding", "false")],
      children: ifNode(
        "adding or not exists (select id from column where sort_index is not null)",
        select({
          variant: "outlined",
          color: "info",
          size: "sm",
          on: {
            input: [
              setScalar(`ui.adding`, `false`),
              modify(
                `update ui.column set sort_index = 0, sort_asc = true where id = try_cast(target_value as int)`
              ),
              triggerQueryRefresh(),
            ],
          },
          slots: {
            select: { props: { value: "'default'", yolmFocusKey: `adding` } },
          },
          children: [
            element("option", {
              props: { value: "'default'" },
              children:
                "case when exists (select id from column where sort_index is not null) then 'Select another field...' else 'Select field...' end",
            }),
            options,
          ],
        }),
        button({
          variant: "outlined",
          color: "info",
          size: "sm",
          startDecorator: materialIcon("Add"),
          on: {
            click: [setScalar(`ui.adding`, "true")],
          },
          children: "'Add another field'",
        })
      ),
    }),
  ];
}
