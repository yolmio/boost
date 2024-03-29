import { TableControlOpts } from "../system";
import { nodes } from "../nodeHelpers";
import { system } from "../system";
import { circularProgress } from "./circularProgress";
import { queryCombobox } from "./searchSelect";
import { select } from "./select";
import { DomStatements } from "../statements";

export function getTableRecordSelect(
  tableName: string,
  opts: TableControlOpts,
) {
  const tableModel = system.db.tables[tableName];
  let selectInfo = tableModel.control ?? { type: "Combobox" };
  switch (selectInfo.type) {
    case "Combobox": {
      if (!tableModel.recordDisplayName) {
        throw new Error(
          "Tried getting a table record select when table does not have recordDisplayName",
        );
      }
      const searchConfig = tableModel.searchConfig;
      if (!searchConfig) {
        throw new Error(`Table ${tableName} does not have searchConfig`);
      }
      const nameExpr = tableModel.recordDisplayName.expr(
        ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`),
      );
      const selectPart = `select ${nameExpr} as label, rank() over () - 1 as index, id `;
      let emptyQuery = `${selectPart} from db.${tableModel.name} as record order by id desc limit 10`;
      if (opts.emptyQuery) {
        emptyQuery = `${selectPart} ${opts.emptyQuery}`;
      }
      return nodes.state({
        procedure: (s) =>
          s
            .scalar(`initial_text`, `''`)
            .if(opts.value + ` is not null`, (s) =>
              s.setScalar(
                `initial_text`,
                `(select ${nameExpr} from db.${tableModel.name} as record where id = ${opts.value})`,
              ),
            ),
        children: queryCombobox({
          immediateFocus: opts.immediateFocus,
          populateResultTable: (query, resultTable) => (s) =>
            s.if({
              condition: `trim(${query}) = ''`,
              then: (s) => s.modify(`insert into ${resultTable} ${emptyQuery}`),
              else: (s) =>
                s
                  .search({
                    query,
                    resultTable: `tmp_result`,
                    limit: `10`,
                    config: {
                      tokenizer: {
                        splitter: { type: "Alphanumeric" },
                        filters: [{ type: "AsciiFold" }, { type: "Lowercase" }],
                      },
                      style: {
                        type: "Fuzzy",
                        ...system.searchConfig.defaultFuzzyConfig,
                      },
                      tables: [searchConfig],
                    },
                  })
                  .modify(
                    `insert into ${resultTable} ${selectPart} from tmp_result join db.${tableModel.name} as record on record_id = id`,
                  ),
            }),
          id: opts.id,
          onBlur: new DomStatements(),
          onClear: opts.onComboboxSelectValue
            ? opts.onComboboxSelectValue(`null`, `null`)
            : opts.onSelectValue(`null`),
          onSelect: opts.onComboboxSelectValue
            ? (result) =>
                opts.onComboboxSelectValue!(`${result}.id`, `${result}.label`)
            : (result) => opts.onSelectValue(`${result}.id`),
          size: opts.size,
          color: opts.color,
          variant: opts.variant,
          initialInputText: `initial_text`,
          styles: opts.styles,
          error: opts.error,
        }),
      });
    }
    case "Select": {
      if (!tableModel.recordDisplayName) {
        throw new Error(
          "Tried getting a table record select when table does not have recordDisplayName",
        );
      }
      const searchConfig = tableModel.searchConfig;
      if (!searchConfig) {
        throw new Error(`Table ${tableName} does not have searchConfig`);
      }
      const nameExpr = tableModel.recordDisplayName.expr(
        ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`),
      );
      const selectPart = `select ${nameExpr} as label, id `;
      const emptyQuery = `${selectPart} from db.${tableModel.name} as record order by id desc`;
      return nodes.state({
        procedure: (s) => s.table(`record`, emptyQuery),
        statusScalar: `select_query_status`,
        children: select({
          slots: {
            select: {
              props: { value: opts.value },
              on: {
                change: opts.onSelectValue(`cast(target_value as bigint)`),
              },
            },
          },
          children: nodes.each({
            recordName: `record`,
            table: `record`,
            children: nodes.element("option", {
              props: { value: `record.id` },
              children: `record.label`,
            }),
          }),
          endDecorator: nodes.if(
            `select_query_status = 'fallback_triggered'`,
            circularProgress({ size: "sm" }),
          ),
        }),
      });
    }
    case "Custom":
      return selectInfo.f(opts);
  }
}
