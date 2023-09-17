import { nodes } from "../../nodeHelpers";
import { stringLiteral } from "../../utils/sqlHelpers";
import { button } from "../../components/button";
import { iconButton } from "../../components/iconButton";
import { materialIcon } from "../../components/materialIcon";
import { select } from "../../components/select";
import { createStyles } from "../../styleUtils";
import {
  SortConfig,
  SuperGridColumn,
  getSortAscText,
  getSortDescText,
} from "./styledDatagrid";
import { Node, SwitchNodeCase } from "../../nodeTypes";
import { DgStateHelpers } from "./shared";

const styles = createStyles({
  columns: {
    display: "flex",
    gap: 1,
  },
});

type SortAggregated =
  | {
      type: "string" | "numeric" | "checkbox";
      cols: number[];
    }
  | {
      type: "custom";
      col: number;
      config: SortConfig;
    };

export function sortPopover(state: DgStateHelpers, columns: SuperGridColumn[]) {
  const aggregatedSorts: SortAggregated[] = [];
  const options: Node[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.sort) {
      if (col.sort.type === "custom") {
        aggregatedSorts.push({ type: "custom", col: i, config: col.sort });
      } else {
        const existingSort = aggregatedSorts.find(
          (s) => s.type === col.sort!.type
        );
        if (existingSort) {
          (existingSort as any).cols.push(i);
        } else {
          aggregatedSorts.push({ type: col.sort!.type, cols: [i] });
        }
      }
      options.push(
        nodes.element("option", {
          props: { value: i.toString() },
          children: stringLiteral(col.sort.displayName),
        })
      );
    }
  }
  const ascNodeCases: SwitchNodeCase[] = [];
  const descNodeCases: SwitchNodeCase[] = [];
  for (const agg of aggregatedSorts) {
    if (agg.type === "custom") {
      ascNodeCases.push({
        condition: `column_record.id = ${agg.col}`,
        node: getSortAscText(agg.config),
      });
      descNodeCases.push({
        condition: `column_record.id = ${agg.col}`,
        node: getSortDescText(agg.config),
      });
    } else {
      ascNodeCases.push({
        condition: `column_record.id in (${agg.cols.join(", ")})`,
        node: getSortAscText({ type: agg.type, displayName: "" }),
      });
      descNodeCases.push({
        condition: `column_record.id in (${agg.cols.join(", ")})`,
        node: getSortDescText({ type: agg.type, displayName: "" }),
      });
    }
  }
  return [
    nodes.each({
      table: "column",
      key: "id",
      recordName: "column_record",
      where: "sort_index is not null",
      orderBy: "sort_index",
      children: nodes.element("div", {
        styles: styles.columns,
        children: [
          select({
            variant: "outlined",
            color: "primary",
            size: "sm",
            on: {
              input: (s) =>
                s
                  .scalar("new_id", "cast(target_value as int)")
                  .if("column_record.id != new_id", (s) =>
                    s
                      .modify(
                        `update ui.column set sort_index = column_record.sort_index, sort_asc = column_record.sort_asc where id = new_id`
                      )
                      .modify(
                        `update ui.column set sort_index = null where id = column_record.id`
                      )
                      .statements(state.triggerRefresh)
                  ),
            },
            slots: { select: { props: { value: "column_record.id" } } },
            children: options,
          }),
          select({
            variant: "outlined",
            color: "primary",
            size: "sm",
            on: {
              input: (s) =>
                s
                  .modify(
                    `update ui.column set sort_asc = target_value = 'asc' where id = column_record.id`
                  )
                  .statements(state.triggerRefresh),
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
              nodes.element("option", {
                props: { value: "'asc'" },
                children: { t: "Switch", cases: ascNodeCases },
              }),
              nodes.element("option", {
                props: { value: "'desc'" },
                children: { t: "Switch", cases: descNodeCases },
              }),
            ],
          }),
          iconButton({
            variant: "plain",
            color: "primary",
            size: "sm",
            children: materialIcon("Close"),
            on: {
              click: (s) =>
                s
                  .modify(
                    `update ui.column set sort_index = null where id = column_record.id`
                  )
                  .statements(state.triggerRefresh),
            },
          }),
        ],
      }),
    }),
    nodes.state({
      procedure: (s) => s.scalar("adding", "false"),
      children: nodes.if({
        condition:
          "adding or not exists (select id from column where sort_index is not null)",
        then: select({
          variant: "outlined",
          color: "primary",
          size: "sm",
          on: {
            input: (s) =>
              s
                .setScalar(`ui.adding`, `false`)
                .modify(
                  `update ui.column set sort_index = 0, sort_asc = true where id = try_cast(target_value as int)`
                )
                .statements(state.triggerRefresh),
          },
          slots: {
            select: { props: { value: "'default'", yolmFocusKey: `adding` } },
          },
          children: [
            nodes.element("option", {
              props: { value: "'default'" },
              children:
                "case when exists (select id from column where sort_index is not null) then 'Select another field...' else 'Select field...' end",
            }),
            options,
          ],
        }),
        else: button({
          variant: "outlined",
          color: "primary",
          size: "sm",
          startDecorator: materialIcon("Add"),
          on: {
            click: (s) => s.setScalar(`ui.adding`, "true"),
          },
          children: "'Add another field'",
        }),
      }),
    }),
  ];
}
