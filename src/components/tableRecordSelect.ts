import { TableControlOpts } from "../appTypes.js";
import { each, element, ifNode, state } from "../nodeHelpers.js";
import {
  if_,
  modify,
  scalar,
  search,
  setScalar,
  table,
} from "../procHelpers.js";
import { app } from "../singleton.js";
import { circularProgress } from "./circularProgress.js";
import { queryCombobox } from "./searchSelect.js";
import { select } from "./select.js";

export function getTableRecordSelect(
  tableName: string,
  opts: TableControlOpts
) {
  const tableModel = app.database.tables[tableName];
  let selectInfo = tableModel.control ?? { type: "Combobox" };
  switch (selectInfo.type) {
    case "Combobox": {
      if (!tableModel.recordDisplayName) {
        throw new Error(
          "Tried getting a table record select when table does not have recordDisplayName"
        );
      }
      const searchConfig = tableModel.searchConfig;
      if (!searchConfig) {
        throw new Error(`Table ${tableName} does not have searchConfig`);
      }
      const nameExpr = tableModel.recordDisplayName.expr(
        ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
      );
      const selectPart = `select ${nameExpr} as label, rank() over () - 1 as index, id `;
      let emptyQuery = `${selectPart} from db.${tableModel.name} as record limit 10 order by id desc`;
      if (opts.emptyQuery) {
        emptyQuery = `${selectPart} ${opts.emptyQuery}`;
      }
      return state({
        procedure: [
          scalar(`initial_text`, `''`),
          if_(opts.value + ` is not null`, [
            setScalar(
              `initial_text`,
              `(select ${nameExpr} from db.${tableModel.name} as record where id = ${opts.value})`
            ),
          ]),
        ],
        children: queryCombobox({
          immediateFocus: opts.immediateFocus,
          populateResultTable: (query, resultTable) => [
            if_(
              `trim(${query}) = ''`,
              modify(`insert into ${resultTable} ${emptyQuery}`),
              [
                search({
                  query,
                  resultTable: `tmp_result`,
                  limit: `10`,
                  config: {
                    tokenizer: {
                      splitter: { type: "Alphanumeric" },
                      filters: [{ type: "Lowercase" }],
                    },
                    style: {
                      type: "Fuzzy",
                      ...app.searchConfig.defaultFuzzyConfig,
                    },
                    tables: [searchConfig],
                  },
                }),
                modify(
                  `insert into ${resultTable} ${selectPart} from tmp_result join db.${tableModel.name} as record on record_id = id`
                ),
              ]
            ),
          ],
          id: opts.id,
          onBlur: [],
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
          "Tried getting a table record select when table does not have recordDisplayName"
        );
      }
      const searchConfig = tableModel.searchConfig;
      if (!searchConfig) {
        throw new Error(`Table ${tableName} does not have searchConfig`);
      }
      const nameExpr = tableModel.recordDisplayName.expr(
        ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
      );
      const selectPart = `select ${nameExpr} as label, id `;
      const emptyQuery = `${selectPart} from db.${tableModel.name} as record order by id desc`;
      return state({
        procedure: [table(`record`, emptyQuery)],
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
          children: each({
            recordName: `record`,
            table: `record`,
            children: element("option", {
              props: { value: `record.id` },
              children: `record.label`,
            }),
          }),
          endDecorator: ifNode(
            `select_query_status = 'fallback_triggered'`,
            circularProgress({ size: "sm" })
          ),
        }),
      });
    }
    case "Custom":
      return selectInfo.f(opts);
  }
}
