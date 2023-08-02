import { TableBuilder, addDeviceDatabaseTable } from "../modelHelpers.js";
import { Table } from "../modelTypes.js";
import {
  each,
  element,
  eventHandlers,
  ifNode,
  mode,
  state,
  switchNode,
} from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import {
  block,
  exit,
  getBoundingClientRect,
  if_,
  modify,
  navigate,
  preventDefault,
  record,
  scalar,
  scrollElIntoView,
  search,
  setScalar,
  stopPropagation,
  table,
} from "../procHelpers.js";
import { model } from "../singleton.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { SequentialIDGenerator } from "../utils/SequentialIdGenerator.js";
import { normalizeCase, pluralize, upcaseFirst } from "../utils/inflectors.js";
import { ident, stringLiteral } from "../utils/sqlHelpers.js";
import {
  ClientProcStatement,
  FieldType,
  ProcTableField,
  RankedSearchTable,
  SqlExpression,
} from "../yom.js";
import { checkbox } from "./checkbox.js";
import { chip } from "./chip.js";
import { divider } from "./divider.js";
import { iconButton } from "./iconButton.js";
import { inlineFieldDisplay } from "./internal/fieldInlineDisplay.js";
import { materialIcon } from "./materialIcon.js";
import { IconName } from "./materialIconNames.js";
import { modal } from "./modal.js";
import { typography } from "./typography.js";
import { getUniqueUiId } from "./utils.js";

// waiting to polish these

export interface TableSearchDisplay {
  expr: (record: string) => SqlExpression;
  name: string;
  label?: string;
  type: FieldType;
}

interface PreparedTableSearchDisplay {
  expr: (record: string) => SqlExpression;
  name: string;
  label: string;
  type: FieldType;
  display: (value: SqlExpression) => Node;
}

export interface TableSearchDialogOpts {
  open: string;
  onClose: ClientProcStatement[];
  table: string;
  displayValues?: (string | TableSearchDisplay)[];
}

const styles = createStyles({
  dialog: () => {
    return {
      boxSizing: "border-box",
      boxShadow: "md",
      fontFamily: cssVar(`font-family-body`),
      lineHeight: cssVar(`line-height-md`),
      padding: 0,
      outline: 0,
      position: "absolute",
      background: cssVar(`palette-background-body`),

      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      border: "none",
      borderRadius: 0,

      zIndex: 1000,
      md: {
        top: "10vh",
        left: "50%",
        right: "unset",
        bottom: "unset",
        width: 700,
        transform: "translate(-50%, 0%)",
        borderRadius: "lg",
        borderColor: cssVar(`palette-divider`),
        borderStyle: "solid",
        borderWidth: 1,
      },
    };
  },
  dialogInner: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  header: {
    display: "flex",
    height: 56,
    minHeight: 56,
    my: 1,
    mx: 2,
    alignItems: "center",
  },
  searchIcon: {
    color: "primary-500",
  },
  input: {
    appearance: "none",
    background: "transparent",
    border: 0,
    flexGrow: 1,
    fontSize: "1.2em",
    pl: 2,
    outline: "none",
    color: cssVar(`palette-neutral-plain-color`),
  },
  listbox: {
    m: 0,
    py: 1,
    px: 1,
    overflowY: "auto",
    maxHeight: "calc(100vh - 59px)",
    md: {
      maxHeight: "70vh",
    },
  },
  multiTableListbox: {
    m: 0,
    px: 1,
  },
  resultsContainer: {
    m: 0,
    py: 1,
    px: 1,
    overflowY: "auto",
    maxHeight: "calc(100vh - 59px)",
    md: {
      maxHeight: "70vh",
    },
  },
  option: {
    py: 1.5,
    px: 3,
    listStyle: "none",
    borderColor: "transparent",
    borderBottomColor: cssVar(`palette-divider`),
    borderWidth: "1px",
    borderStyle: "solid",
    cursor: "pointer",
    display: "flex",
    gap: 1,
    justifyContent: "space-between",
    '&[aria-selected="true"]': {
      backgroundColor: cssVar(`palette-primary-50`),
      borderColor: cssVar(`palette-primary-500`),
      dark: {
        backgroundColor: cssVar(`palette-primary-900`),
      },
      borderRadius: "10px",
      borderWidth: "1px",
      borderStyle: "solid",
    },
  },
  optionLabel: {
    fontSize: "md",
    fontWeight: "md",
  },
  optionLabelContainer: {
    display: "flex",
    flexDirection: "column",
  },
  optionLeft: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  displayValues: {
    display: "flex",
    flexWrap: "wrap",
    gap: 1,
  },
  optionExtraData: {
    display: "flex",
    fontSize: "sm",
  },
  optionExtraDataLabel: {
    mr: 0.5,
    color: "text-secondary",
    my: 0,
    alignSelf: "flex-end",
  },
});

function prepareDisplayValue(
  table: Table,
  value: string | TableSearchDisplay
): PreparedTableSearchDisplay {
  if (typeof value === "string") {
    const field = table.fields[value];
    if (field.type === "ForeignKey") {
      const toTable = model.database.tables[field.table];
      if (toTable.recordDisplayName) {
        const nameExpr = toTable.recordDisplayName.expr(
          ...toTable.recordDisplayName.fields.map((f) => `other.${f}`)
        );
        return {
          expr: (record) => {
            return `(select ${nameExpr} from db.${field.table} as other where other.id = ${record}.${value})`;
          },
          name: value,
          label: field.displayName,
          type: { type: "String", maxLength: 2000 },
          display: (value) => value,
        };
      }
    }
    let type: FieldType;
    switch (field.type) {
      case "String":
        type = { type: "String", maxLength: field.maxLength };
        break;
      case "Enum":
        type = { type: "Enum", enum: field.enum };
        break;
      case "Tx":
      case "ForeignKey":
        type = { type: "BigUint" };
        break;
      default:
        type = { type: field.type as any };
        break;
    }
    return {
      expr: (record) => `${record}.${value}`,
      name: value,
      label: field.displayName,
      type,
      display: (value) => inlineFieldDisplay(field, value),
    };
  } else {
    return {
      expr: value.expr,
      name: value.name,
      label: value.label ?? upcaseFirst(normalizeCase(value.name).join(" ")),
      type: value.type,
      display: (value) => value,
    };
  }
}

function addDisplayValueToTable(
  table: TableBuilder,
  v: PreparedTableSearchDisplay,
  name: string
) {
  switch (v.type.type) {
    case "String":
      table.string(name, v.type.maxLength);
      break;
    case "Enum":
      table.enum(name, v.type.enum);
      break;
    case "ForeignKey":
    case "Tx":
      table.bigUint(name);
      break;
    case "BigInt":
      table.bigInt(name);
      break;
    case "BigUint":
      table.bigUint(name);
      break;
    case "Int":
      table.int(name);
      break;
    case "Uint":
      table.uint(name);
      break;
    case "SmallInt":
      table.smallInt(name);
      break;
    case "SmallUint":
      table.smallUint(name);
      break;
    case "TinyInt":
      table.tinyInt(name);
      break;
    case "TinyUint":
      table.tinyUint(name);
      break;
    case "Bool":
      table.bool(name);
      break;
    case "Double":
      table.double(name);
      break;
    case "Real":
      table.real(name);
      break;
    case "Date":
      table.date(name);
      break;
    case "Ordering":
      table.ordering(name);
      break;
    case "Time":
      table.time(name);
      break;
    case "Uuid":
      table.uuid(name);
      break;
    case "Decimal":
      table.decimal(name, {
        precision: v.type.precision,
        scale: v.type.scale,
      });
      break;
    case "Timestamp":
      table.timestamp(name);
      break;
  }
}

export function tableSearchDialog(opts: TableSearchDialogOpts) {
  const tableModel = model.database.tables[opts.table];
  if (!tableModel.recordDisplayName) {
    throw new Error("tableSearchDialog expects recordDisplayName to exist");
  }
  if (!tableModel.getHrefToRecord) {
    throw new Error("tableSearchDialog expects getHrefToRecord to exist");
  }
  const displayValues = opts.displayValues?.map((value) =>
    prepareDisplayValue(tableModel, value)
  );
  addDeviceDatabaseTable(`recent_${opts.table}_search`, (table) => {
    table.bigUint("recent_search_id").notNull();
    table.string("recent_search_label", 500).notNull();
    table.timestamp("recent_search_timestamp").notNull();
    if (displayValues) {
      for (const v of displayValues) {
        addDisplayValueToTable(table, v, v.name);
      }
    }
  });
  const nameExpr = tableModel.recordDisplayName.expr(
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
  );
  const inputId = stringLiteral(getUniqueUiId());
  const listboxId = stringLiteral(getUniqueUiId());
  const optionId = (id: string) => `${inputId} || '-' || ${id}`;
  const fieldNameGenerator = new SequentialIDGenerator();
  const extraValuesIds: string[] = [];
  const tableFields = displayValues?.map((v): ProcTableField => {
    const name = fieldNameGenerator.next();
    extraValuesIds.push(name);
    return { name, type: v.type };
  });
  let extraValuesSelect = ``;
  let extraValuesFromDeviceSelect = ``;
  let extraValuesToDeviceSelect = ``;
  if (displayValues) {
    extraValuesSelect = `,`;
    extraValuesSelect += displayValues
      .map((v, id) => {
        return v.expr("record") + " as " + extraValuesIds[id];
      })
      .join(",");
    extraValuesFromDeviceSelect = `,`;
    extraValuesFromDeviceSelect += displayValues
      .map((v, id) => v.name + " as " + extraValuesIds[id])
      .join(",");
    extraValuesToDeviceSelect = `,`;
    extraValuesToDeviceSelect += displayValues
      .map((v, id) => extraValuesIds[id] + " as " + v.name)
      .join(",");
  }
  const searchConfig = tableModel.searchConfig;
  if (!searchConfig) {
    throw new Error(`Table ${tableModel.name} does not have searchConfig`);
  }
  function scrollToItem(alignToTop: boolean) {
    return block([
      getBoundingClientRect(listboxId, `container_rect`),
      getBoundingClientRect(
        optionId(`(select id from ui.result where active)`),
        `item_rect`
      ),
      if_(
        `not (item_rect.top >= container_rect.top and item_rect.bottom <= container_rect.bottom)`,
        scrollElIntoView({
          elementId: optionId(`(select id from ui.result where active)`),
          block: alignToTop ? `'start'` : `'end'`,
        })
      ),
    ]);
  }
  const updateRecentSearch = block([
    scalar(`result_id`, `(select id from ui.result where active)`),
    modify(
      `delete from device.recent_${opts.table}_search where recent_search_id = result_id`
    ),
    modify(
      `insert into device.recent_${opts.table}_search select id as recent_search_id, label as recent_search_label, current_timestamp() as recent_search_timestamp ${extraValuesToDeviceSelect} from ui.result where active`
    ),
    if_(`(select count(*) from device.recent_${opts.table}_search) >= 20`, [
      modify(
        `delete from device.recent_${opts.table}_search where recent_search_id = (select recent_search_id from device.recent_${opts.table}_search order by recent_search_timestamp asc limit 1)`
      ),
    ]),
  ]);
  return modal({
    open: opts.open,
    onClose: opts.onClose,
    children: (closeModal) =>
      element("div", {
        styles: styles.dialog(),
        on: { click: [stopPropagation()] },
        focusLock: {},
        scrollLock: { enabled: `true` },
        children: element("div", {
          styles: styles.dialogInner,
          children: state({
            procedure: [scalar("query", "''")],
            children: state({
              watch: ["query"],
              procedure: [
                table("result", [
                  {
                    name: "label",
                    type: { type: "String", maxLength: 1000 },
                    notNull: true,
                  },
                  { name: "id", type: { type: "BigInt" }, notNull: true },
                  { name: "index", type: { type: "BigInt" }, notNull: true },
                  { name: "active", type: { type: "Bool" }, notNull: true },
                  { name: "is_recent", type: { type: "Bool" }, notNull: true },
                  ...(tableFields ?? []),
                ]),
                if_(
                  `trim(query) = ''`,
                  modify(
                    `insert into result select
                        recent_search_timestamp = (select max(recent_search_timestamp) from device.recent_${opts.table}_search) as active,
                        recent_search_id as id,
                        recent_search_label as label,
                        rank() over (order by recent_search_timestamp desc) as index,
                        true as is_recent
                        ${extraValuesFromDeviceSelect}
                      from device.recent_${opts.table}_search
                      order by recent_search_timestamp desc`
                  ),
                  [
                    search({
                      query: "query",
                      resultTable: `tmp_result`,
                      limit: `10`,
                      config: {
                        tokenizer: {
                          splitter: { type: "Alphanumeric" },
                          filters: [{ type: "Lowercase" }],
                        },
                        style: {
                          type: "Fuzzy",
                          ...model.searchConfig.defaultFuzzyConfig,
                        },
                        tables: [searchConfig],
                      },
                    }),
                    modify(`insert into result
                select
                  ${nameExpr} as label, 
                  rank() over () = 1 as active,
                  rank() over () as index,
                  false as is_recent,
                  record_id as id ${extraValuesSelect}
                from tmp_result
                join db.${opts.table} as record on record_id = id`),
                  ]
                ),
              ],
              children: [
                eventHandlers({
                  document: {
                    keydown: [if_(`event.key = 'Escape'`, closeModal)],
                  },
                }),
                element("header", {
                  styles: styles.header,
                  children: [
                    element("label", {
                      styles: styles.searchIcon,
                      props: { htmlFor: inputId },
                      children: materialIcon({
                        name: "Search",
                        fontSize: "xl3",
                      }),
                    }),
                    mode({
                      render: "'immediate'",
                      children: element("input", {
                        styles: styles.input,
                        props: {
                          id: inputId,
                          placeholder: `'Search…'`,
                          "aria-autocomplete": `'list'`,
                          "aria-haspopup": `'listbox'`,
                          "aria-controls": listboxId,
                          "aria-expanded": `true`,
                          "aria-activedescendant": optionId(
                            `(select id from ui.result where active)`
                          ),
                          type: `'text'`,
                          spellCheck: `'false'`,
                          autoComplete: `'off'`,
                          autoCapitalize: `'off'`,
                          role: `'combobox'`,
                          value: `query`,
                        },
                        on: {
                          input: [
                            setScalar("ui.query", "target_value"),
                            modify(`update ui.result set active = false`),
                          ],
                          keydown: [
                            if_(`event.key = 'Escape'`, closeModal),
                            if_(
                              `event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
                              exit()
                            ),
                            if_(`event.key = 'Enter' or event.key = 'Tab'`, [
                              scalar(
                                `result_id`,
                                `(select id from ui.result where active)`
                              ),
                              if_(`result_id is not null`, [
                                preventDefault(),
                                updateRecentSearch,
                                navigate(
                                  tableModel.getHrefToRecord!("result_id")
                                ),
                                ...closeModal,
                              ]),
                              exit(),
                            ]),
                            if_(`event.key = 'ArrowDown'`, [
                              preventDefault(),
                              if_(
                                `not exists (select id from ui.result)`,
                                exit()
                              ),
                              scalar(
                                `next_index`,
                                `(select index from ui.result where active) + 1`
                              ),
                              modify(`update ui.result set active = false`),
                              if_(
                                `exists (select id from ui.result where index = next_index)`,
                                [
                                  modify(
                                    `update ui.result set active = true where index = next_index`
                                  ),
                                ],
                                [
                                  modify(
                                    `update ui.result set active = true where index = 1`
                                  ),
                                ]
                              ),
                              scrollToItem(false),
                              exit(),
                            ]),
                            if_(`event.key = 'ArrowUp'`, [
                              preventDefault(),
                              if_(
                                `not exists (select index from ui.result)`,
                                exit()
                              ),
                              scalar(
                                `next_index`,
                                `(select index from ui.result where active) - 1`
                              ),
                              modify(`update ui.result set active = false`),
                              if_(
                                `exists (select id from ui.result where index = next_index)`,
                                [
                                  modify(
                                    `update ui.result set active = true where index = next_index`
                                  ),
                                ],
                                [
                                  modify(
                                    `update ui.result set active = true where index = (select max(index) from ui.result)`
                                  ),
                                ]
                              ),
                              scrollToItem(true),
                              exit(),
                            ]),
                          ],
                        },
                      }),
                    }),
                    iconButton({
                      variant: "plain",
                      color: "neutral",
                      children: materialIcon("Close"),
                      on: { click: closeModal },
                    }),
                  ],
                }),
                divider(),
                element("ul", {
                  props: {
                    id: listboxId,
                    role: `'listbox'`,
                  },
                  styles: styles.listbox,
                  children: each({
                    table: "result",
                    recordName: "record",
                    key: "id",
                    children: element("li", {
                      props: {
                        id: optionId(`record.id`),
                        role: `'option'`,
                        "aria-selected": `record.active`,
                        tabIndex: "0",
                      },
                      styles: styles.option,
                      on: {
                        click: [
                          updateRecentSearch,
                          navigate(tableModel.getHrefToRecord!(`record.id`)),
                          ...closeModal,
                        ],
                      },
                      children: [
                        element("div", {
                          styles: styles.optionLeft,
                          children: [
                            ifNode(
                              `record.is_recent`,
                              materialIcon({
                                name: "History",
                                fontSize: "xl2",
                              })
                            ),
                            element("div", {
                              styles: styles.optionLabelContainer,
                              children: [
                                element("span", {
                                  styles: styles.optionLabel,
                                  children: `record.label`,
                                }),
                                displayValues
                                  ? element("div", {
                                      styles: styles.displayValues,
                                      children: displayValues.map((v, i) => {
                                        const value =
                                          `record.` + extraValuesIds[i];
                                        return ifNode(
                                          value + ` is not null`,
                                          element("div", {
                                            styles: styles.optionExtraData,
                                            children: [
                                              element("p", {
                                                styles:
                                                  styles.optionExtraDataLabel,
                                                children: `${stringLiteral(
                                                  v.label
                                                )} || ':'`,
                                              }),
                                              element("span", {
                                                children: v.display(value),
                                              }),
                                            ],
                                          })
                                        );
                                      }),
                                    })
                                  : undefined,
                              ],
                            }),
                          ],
                        }),
                        ifNode(
                          `record.is_recent`,
                          iconButton({
                            variant: "plain",
                            children: materialIcon("Close"),
                            size: "sm",
                            on: {
                              click: [
                                stopPropagation(),
                                modify(
                                  `delete from device.recent_${opts.table}_search where recent_search_id = record.id`
                                ),
                                modify(
                                  `delete from ui.result where id = record.id`
                                ),
                              ],
                            },
                          })
                        ),
                      ],
                    }),
                  }),
                }),
                ,
              ],
            }),
          }),
        }),
      }),
  });
}

export interface MultiTableSearchDialogTable {
  name: string;
  displayValues?: (string | TableSearchDisplay)[];
  icon: IconName;
}

interface PreparedMultiTableSearchDialogTable {
  name: string;
  tableModel: Table;
  icon: IconName;
  displayValues?: PreparedTableSearchDisplay[];
}

function calcMultiTable(tables: PreparedMultiTableSearchDialogTable[]) {
  const extraRecordFields: ProcTableField[] = [];
  let extraValuesSelect = "";
  let extraValuesFromDeviceSelect = ``;
  let extraValuesToDeviceSelect = ``;
  let joinToTables = "";
  const tableConfigs: RankedSearchTable[] = [];
  const fieldNameGenerator = new SequentialIDGenerator();
  const displayValueNames: Record<string, string[]> = {};
  let labelExpr = "case ";
  let urlExpr = "case ";
  for (const table of tables) {
    const tableModel = model.database.tables[table.name];
    if (!tableModel.recordDisplayName) {
      throw new Error(
        "multiTableSearchDialog expects recordDisplayName to exist"
      );
    }
    if (!tableModel.getHrefToRecord) {
      throw new Error(
        "multiTableSearchDialog expects getHrefToRecord to exist, missing on " +
          tableModel.name
      );
    }
    if (!tableModel.searchConfig) {
      throw new Error(`Table ${tableModel.name} does not have searchConfig`);
    }
    if (table.displayValues) {
      displayValueNames[table.name] = [];
      for (const value of table.displayValues) {
        const name = fieldNameGenerator.next();
        displayValueNames[table.name].push(name);
        extraRecordFields.push({ name, type: value.type });
        extraValuesSelect += `, ${value.expr(table.name)} as ${name}`;
        extraValuesFromDeviceSelect += `, ${table.name}_field_${value.name} as ${name}`;
        extraValuesToDeviceSelect += `, ${name} as ${table.name}_field_${value.name}`;
      }
    }
    joinToTables += `left join db.${ident(
      table.name
    )} on table = ${stringLiteral(table.name)} and record_id = ${ident(
      table.name
    )}.id `;
    tableConfigs.push({
      ...tableModel.searchConfig,
      disabled: table.name + "_disabled",
    });
    const nameExpr = tableModel.recordDisplayName.expr(
      ...tableModel.recordDisplayName.fields.map((f) => `${table.name}.${f}`)
    );
    labelExpr += `when table = ${stringLiteral(table.name)} then ${nameExpr} `;
    urlExpr += `when record.table = ${stringLiteral(
      table.name
    )} then ${tableModel.getHrefToRecord(`record.id`)} `;
  }
  labelExpr += `end`;
  urlExpr += `end`;
  return {
    extraRecordFields,
    joinToTables,
    extraValuesSelect,
    tableConfigs,
    labelExpr,
    urlExpr,
    displayValueNames,
    extraValuesFromDeviceSelect,
    extraValuesToDeviceSelect,
  };
}

export interface MultiTableSearchDialogOpts {
  open: string;
  onClose: ClientProcStatement[];
  tables: MultiTableSearchDialogTable[];
}

export function multiTableSearchDialog(opts: MultiTableSearchDialogOpts) {
  const inputId = stringLiteral(getUniqueUiId());
  const listboxId = stringLiteral(getUniqueUiId());
  const containerId = stringLiteral(getUniqueUiId());
  const optionId = (id: string) => `${inputId} || '-' || ${id}`;
  const tables = opts.tables.map((t): PreparedMultiTableSearchDialogTable => {
    const tableModel = model.database.tables[t.name];
    return {
      name: t.name,
      icon: t.icon,
      tableModel,
      displayValues: t.displayValues?.map((v) =>
        prepareDisplayValue(tableModel, v)
      ),
    };
  });
  addDeviceDatabaseTable("recent_multi_table_search", (table) => {
    table.bigUint("recent_search_id").notNull();
    table.string("recent_search_table", 200).notNull();
    table.string("recent_search_label", 500).notNull();
    table.timestamp("recent_search_timestamp").notNull();
    for (const tableOpts of tables) {
      if (tableOpts.displayValues) {
        for (const v of tableOpts.displayValues) {
          addDisplayValueToTable(table, v, tableOpts.name + "_field_" + v.name);
        }
      }
    }
  });
  const {
    extraRecordFields,
    extraValuesSelect,
    extraValuesFromDeviceSelect,
    extraValuesToDeviceSelect,
    joinToTables,
    tableConfigs,
    labelExpr,
    displayValueNames,
    urlExpr,
  } = calcMultiTable(tables);
  const updateRecentSearch = block([
    scalar(`result_id`, `(select id from ui.result where active)`),
    modify(
      `delete from device.recent_multi_table_search where recent_search_id = result_id`
    ),
    modify(
      `insert into device.recent_multi_table_search
        select id as recent_search_id,
        label as recent_search_label,
        cast(table as string) as recent_search_table,
        current_timestamp() as recent_search_timestamp
        ${extraValuesToDeviceSelect} from ui.result where active`
    ),
    if_(`(select count(*) from device.recent_multi_table_search) >= 20`, [
      modify(
        `delete from device.recent_multi_table_search where recent_search_id = (select recent_search_id from device.recent_multi_table_search order by recent_search_timestamp asc limit 1)`
      ),
    ]),
  ]);
  function scrollToItem(alignToTop: boolean) {
    return block([
      getBoundingClientRect(containerId, `container_rect`),
      scalar(
        `option_id`,
        optionId(
          `(select table from ui.result where active) || '_' || (select id from ui.result where active)`
        )
      ),
      getBoundingClientRect(`option_id`, `item_rect`),
      if_(
        `not (item_rect.top >= container_rect.top and item_rect.bottom <= container_rect.bottom)`,
        [
          scrollElIntoView({
            elementId: `option_id`,
            block: alignToTop ? `'start'` : `'end'`,
          }),
        ]
      ),
    ]);
  }
  return modal({
    open: opts.open,
    onClose: opts.onClose,
    children: (closeModal) =>
      element("div", {
        styles: styles.dialog(),
        on: { click: [stopPropagation()] },
        focusLock: {},
        scrollLock: { enabled: `true` },
        children: element("div", {
          styles: styles.dialogInner,
          children: state({
            procedure: [
              scalar("query", "''"),
              ...opts.tables.map((t) => scalar(`${t.name}_disabled`, "false")),
            ],
            children: state({
              watch: ["query", ...opts.tables.map((t) => `${t.name}_disabled`)],
              procedure: [
                table("result", [
                  {
                    name: "label",
                    type: { type: "String", maxLength: 1000 },
                    notNull: true,
                  },
                  { name: "id", type: { type: "BigInt" }, notNull: true },
                  {
                    name: "table",
                    type: { type: "Enum", enum: "sys_db_table" },
                    notNull: true,
                  },
                  { name: "index", type: { type: "BigInt" }, notNull: true },
                  { name: "active", type: { type: "Bool" }, notNull: true },
                  { name: "is_recent", type: { type: "Bool" }, notNull: true },
                  ...extraRecordFields,
                ]),
                if_(
                  `trim(query) = ''`,
                  [
                    modify(
                      `insert into result select
                        recent_search_timestamp = (select max(recent_search_timestamp) from device.recent_multi_table_search) as active,
                        recent_search_id as id,
                        recent_search_label as label,
                        rank() over (order by recent_search_timestamp desc) as index,
                        cast(recent_search_table as enums.sys_db_table) as table,
                        true as is_recent
                        ${extraValuesFromDeviceSelect}
                      from device.recent_multi_table_search
                      where try_cast(recent_search_table as enums.sys_db_table) is not null
                      order by recent_search_timestamp desc`
                    ),
                  ],
                  [
                    search({
                      query: "query",
                      resultTable: `tmp_result`,
                      limit: `20`,
                      config: {
                        tokenizer: {
                          splitter: { type: "Alphanumeric" },
                          filters: [{ type: "Lowercase" }],
                        },
                        style: {
                          type: "Fuzzy",
                          ...model.searchConfig.defaultFuzzyConfig,
                        },
                        tables: tableConfigs,
                      },
                    }),
                    modify(`insert into result
                select
                  ${labelExpr} as label,
                  rank() over () = 1 as active,
                  rank() over () as index,
                  false as is_recent,
                  table,
                  record_id as id ${extraValuesSelect}
                from tmp_result ${joinToTables}`),
                  ]
                ),
              ],
              children: [
                eventHandlers({
                  document: {
                    keydown: [if_(`event.key = 'Escape'`, closeModal)],
                  },
                }),
                element("header", {
                  styles: styles.header,
                  children: [
                    element("label", {
                      styles: styles.searchIcon,
                      props: { htmlFor: inputId },
                      children: materialIcon({
                        name: "Search",
                        fontSize: "xl3",
                      }),
                    }),
                    mode({
                      render: "'immediate'",
                      children: element("input", {
                        styles: styles.input,
                        props: {
                          id: inputId,
                          placeholder: `'Search…'`,
                          "aria-autocomplete": `'list'`,
                          "aria-haspopup": `'listbox'`,
                          "aria-controls": listboxId,
                          "aria-expanded": `true`,
                          "aria-activedescendant": optionId(
                            `(select id from ui.result where active)`
                          ),
                          type: `'text'`,
                          spellCheck: `'false'`,
                          autoComplete: `'off'`,
                          autoCapitalize: `'off'`,
                          role: `'combobox'`,
                          value: `query`,
                        },
                        on: {
                          input: [
                            setScalar("ui.query", "target_value"),
                            modify(`update ui.result set active = false`),
                          ],
                          keydown: [
                            if_(`event.key = 'Escape'`, closeModal),
                            if_(
                              `event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
                              exit()
                            ),
                            if_(`event.key = 'Enter' or event.key = 'Tab'`, [
                              record(
                                `record`,
                                `select id, table from ui.result where active`
                              ),
                              if_(`record.id is not null`, [
                                preventDefault(),
                                updateRecentSearch,
                                navigate(urlExpr),
                                ...closeModal,
                              ]),
                              exit(),
                            ]),
                            if_(`event.key = 'ArrowDown'`, [
                              preventDefault(),
                              if_(
                                `not exists (select id from ui.result)`,
                                exit()
                              ),
                              scalar(
                                `next_index`,
                                `(select index from ui.result where active) + 1`
                              ),
                              modify(`update ui.result set active = false`),
                              if_(
                                `exists (select id from ui.result where index = next_index)`,
                                [
                                  modify(
                                    `update ui.result set active = true where index = next_index`
                                  ),
                                ],
                                [
                                  modify(
                                    `update ui.result set active = true where index = 1`
                                  ),
                                ]
                              ),
                              scrollToItem(false),
                              exit(),
                            ]),
                            if_(`event.key = 'ArrowUp'`, [
                              preventDefault(),
                              if_(
                                `not exists (select index from ui.result)`,
                                exit()
                              ),
                              scalar(
                                `next_index`,
                                `(select index from ui.result where active) - 1`
                              ),
                              modify(`update ui.result set active = false`),
                              if_(
                                `exists (select id from ui.result where index = next_index)`,
                                [
                                  modify(
                                    `update ui.result set active = true where index = next_index`
                                  ),
                                ],
                                [
                                  modify(
                                    `update ui.result set active = true where index = (select max(index) from ui.result)`
                                  ),
                                ]
                              ),
                              scrollToItem(true),
                              exit(),
                            ]),
                          ],
                        },
                      }),
                    }),
                    iconButton({
                      variant: "plain",
                      color: "neutral",
                      children: materialIcon("Close"),
                      on: { click: closeModal },
                    }),
                  ],
                }),
                divider(),
                element("div", {
                  styles: styles.resultsContainer,
                  props: { id: containerId },
                  children: [
                    element("div", {
                      styles: {
                        display: "flex",
                        p: 1,
                        gap: 1,
                        flexWrap: "wrap",
                      },
                      children: [
                        typography({
                          level: "body2",
                          children: `'Filter results:'`,
                        }),
                        ...opts.tables.map((t) => {
                          return chip({
                            color: "neutral",
                            variant: "plain",
                            size: "sm",
                            selected: {
                              variant: "soft",
                              color: "primary",
                              isSelected: `not ${t.name}_disabled`,
                            },
                            startDecorator: ifNode(
                              `not ${t.name}_disabled`,
                              materialIcon("Check")
                            ),
                            children: checkbox({
                              size: "sm",
                              checked: `not ${t.name}_disabled`,
                              label: stringLiteral(
                                pluralize(
                                  model.database.tables[t.name].displayName
                                )
                              ),
                              color: "neutral",
                              variant: "outlined",
                              checkedVariation: {
                                color: "primary",
                                variant: "outlined",
                              },
                              disableIcon: true,
                              overlay: true,
                              on: {
                                checkboxChange: [
                                  setScalar(
                                    `${t.name}_disabled`,
                                    `not ${t.name}_disabled`
                                  ),
                                ],
                              },
                            }),
                          });
                        }),
                      ],
                    }),
                    element("ul", {
                      props: {
                        id: listboxId,
                        role: `'listbox'`,
                      },
                      styles: styles.multiTableListbox,
                      children: each({
                        table: "result",
                        recordName: "record",
                        key: "table || '_' || id",
                        children: element("li", {
                          props: {
                            id: optionId(`record.table || '_' || record.id`),
                            role: `'option'`,
                            "aria-selected": `record.active`,
                            tabIndex: "0",
                          },
                          styles: styles.option,
                          on: {
                            click: [
                              navigate(urlExpr),
                              updateRecentSearch,
                              ...closeModal,
                            ],
                          },
                          children: [
                            element("div", {
                              styles: styles.optionLeft,
                              children: [
                                ifNode(
                                  `record.is_recent`,
                                  materialIcon({
                                    name: "History",
                                    fontSize: "xl2",
                                  })
                                ),
                                element("div", {
                                  styles: styles.optionLabelContainer,
                                  children: [
                                    element("span", {
                                      styles: styles.optionLabel,
                                      children: `record.label`,
                                    }),
                                    switchNode(
                                      ...tables
                                        .filter((t) => t.displayValues)
                                        .map((t) => {
                                          const displayValueIds =
                                            displayValueNames[t.name];
                                          return [
                                            `record.table = ${stringLiteral(
                                              t.name
                                            )}`,
                                            element("div", {
                                              styles: styles.displayValues,
                                              children: t.displayValues!.map(
                                                (v, i) => {
                                                  const value =
                                                    `record.` +
                                                    displayValueIds[i];
                                                  return ifNode(
                                                    value + ` is not null`,
                                                    element("div", {
                                                      styles:
                                                        styles.optionExtraData,
                                                      children: [
                                                        element("p", {
                                                          styles:
                                                            styles.optionExtraDataLabel,
                                                          children: `${stringLiteral(
                                                            v.label
                                                          )} || ':'`,
                                                        }),
                                                        v.display(value),
                                                      ],
                                                    })
                                                  );
                                                }
                                              ),
                                            }),
                                          ] as [string, Node];
                                        })
                                    ),
                                  ],
                                }),
                              ],
                            }),
                            element("div", {
                              styles: {
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                              },
                              children: [
                                switchNode(
                                  ...opts.tables.map((t) => {
                                    return [
                                      `record.table = ${stringLiteral(t.name)}`,
                                      materialIcon({
                                        name: t.icon,
                                        fontSize: "xl",
                                      }),
                                    ] as [string, Node];
                                  })
                                ),
                                ifNode(
                                  `record.is_recent`,
                                  iconButton({
                                    variant: "plain",
                                    children: materialIcon("Close"),
                                    size: "sm",
                                    on: {
                                      click: [
                                        stopPropagation(),
                                        modify(
                                          `delete from device.recent_multi_table_search where recent_search_id = record.id`
                                        ),
                                        modify(
                                          `delete from ui.result where id = record.id`
                                        ),
                                      ],
                                    },
                                  })
                                ),
                              ],
                            }),
                          ],
                        }),
                      }),
                    }),
                  ],
                }),
                ,
              ],
            }),
          }),
        }),
      }),
  });
}

export interface RecordSelectDialog {
  table: string;
  displayValues?: TableSearchDisplay[];
  onSelect: (id: string, label: string) => ClientProcStatement[];
  open: string;
  onClose: ClientProcStatement[];
  placeholder?: string;
}

export function recordSelectDialog(opts: RecordSelectDialog) {
  const tableModel = model.database.tables[opts.table];
  if (!tableModel.recordDisplayName) {
    throw new Error("tableSearchDialog expects recordDisplayName to exist");
  }
  const displayValues = opts.displayValues?.map((value) =>
    prepareDisplayValue(tableModel, value)
  );
  const nameExpr = tableModel.recordDisplayName.expr(
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
  );
  const inputId = stringLiteral(getUniqueUiId());
  const listboxId = stringLiteral(getUniqueUiId());
  const optionId = (id: string) => `${inputId} || '-' || ${id}`;
  const fieldNameGenerator = new SequentialIDGenerator();
  const extraValuesIds: string[] = [];
  const tableFields = displayValues?.map((v): ProcTableField => {
    const name = fieldNameGenerator.next();
    extraValuesIds.push(name);
    return { name, type: v.type };
  });
  let extraValuesSelect = ``;
  if (displayValues) {
    extraValuesSelect = `,`;
    extraValuesSelect += displayValues
      .map((v, id) => {
        return v.expr + " as " + extraValuesIds[id];
      })
      .join(",");
  }
  const searchConfig = tableModel.searchConfig;
  if (!searchConfig) {
    throw new Error(`Table ${tableModel.name} does not have searchConfig`);
  }
  function scrollToItem(alignToTop: boolean) {
    return block([
      getBoundingClientRect(listboxId, `container_rect`),
      getBoundingClientRect(
        optionId(`(select id from ui.result where active)`),
        `item_rect`
      ),
      if_(
        `not (item_rect.top >= container_rect.top and item_rect.bottom <= container_rect.bottom)`,
        scrollElIntoView({
          elementId: optionId(`(select id from ui.result where active)`),
          block: alignToTop ? `'start'` : `'end'`,
        })
      ),
    ]);
  }
  return modal({
    open: opts.open,
    onClose: opts.onClose,
    children: (closeModal) =>
      element("div", {
        styles: styles.dialog(),
        on: { click: [stopPropagation()] },
        focusLock: {},
        scrollLock: { enabled: `true` },
        children: state({
          procedure: [scalar("query", "''")],
          children: state({
            watch: ["query"],
            procedure: [
              table("result", [
                { name: "label", type: { type: "String", maxLength: 1000 } },
                { name: "id", type: { type: "BigInt" } },
                { name: "index", type: { type: "BigInt" } },
                { name: "active", type: { type: "Bool" } },
                ...(tableFields ?? []),
              ]),
              if_(
                `trim(query) = ''`,
                modify(`insert into result
                select
                  ${nameExpr} as label, 
                  rank() over () = 1 as active,
                  rank() over () as index,
                  record.id as id ${extraValuesSelect}
                from db.${opts.table} as record
                limit 15`),
                [
                  search({
                    query: "query",
                    resultTable: `tmp_result`,
                    limit: `10`,
                    config: {
                      tokenizer: {
                        splitter: { type: "Alphanumeric" },
                        filters: [{ type: "Lowercase" }],
                      },
                      style: {
                        type: "Fuzzy",
                        ...model.searchConfig.defaultFuzzyConfig,
                      },
                      tables: [searchConfig],
                    },
                  }),
                  modify(`insert into result
                select
                  ${nameExpr} as label, 
                  rank() over () = 1 as active,
                  rank() over () as index,
                  record_id as id ${extraValuesSelect}
                from tmp_result
                join db.${opts.table} as record on record_id = id`),
                ]
              ),
            ],
            children: [
              eventHandlers({
                document: {
                  keydown: [if_(`event.key = 'Escape'`, closeModal)],
                },
              }),
              element("header", {
                styles: styles.header,
                children: [
                  element("label", {
                    styles: styles.searchIcon,
                    props: { htmlFor: inputId },
                    children: materialIcon({
                      name: "Search",
                      fontSize: "xl3",
                    }),
                  }),
                  mode({
                    render: "'immediate'",
                    children: element("input", {
                      styles: styles.input,
                      props: {
                        id: inputId,
                        placeholder: opts.placeholder ?? `'Select a record…'`,
                        "aria-autocomplete": `'list'`,
                        "aria-haspopup": `'listbox'`,
                        "aria-controls": listboxId,
                        "aria-expanded": `true`,
                        "aria-activedescendant": optionId(
                          `(select id from ui.result where active)`
                        ),
                        type: `'text'`,
                        spellCheck: `'false'`,
                        autoComplete: `'off'`,
                        autoCapitalize: `'off'`,
                        role: `'combobox'`,
                        value: `query`,
                      },
                      on: {
                        input: [
                          setScalar("ui.query", "target_value"),
                          modify(`update ui.result set active = false`),
                        ],
                        keydown: {
                          detachedFromNode: true,
                          procedure: [
                            if_(`event.key = 'Escape'`, closeModal),
                            if_(
                              `event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
                              exit()
                            ),
                            if_(`event.key = 'Enter' or event.key = 'Tab'`, [
                              record(
                                `selected_record`,
                                `select id, label from ui.result where active`
                              ),
                              if_(`selected_record.id is not null`, [
                                preventDefault(),
                                ...opts.onSelect(
                                  `selected_record.id`,
                                  `selected_record.label`
                                ),
                              ]),
                              exit(),
                            ]),
                            if_(`event.key = 'ArrowDown'`, [
                              preventDefault(),
                              if_(
                                `not exists (select id from ui.result)`,
                                exit()
                              ),
                              scalar(
                                `next_index`,
                                `(select index from ui.result where active) + 1`
                              ),
                              modify(`update ui.result set active = false`),
                              if_(
                                `exists (select id from ui.result where index = next_index)`,
                                [
                                  modify(
                                    `update ui.result set active = true where index = next_index`
                                  ),
                                ],
                                [
                                  modify(
                                    `update ui.result set active = true where index = 1`
                                  ),
                                ]
                              ),
                              scrollToItem(false),
                              exit(),
                            ]),
                            if_(`event.key = 'ArrowUp'`, [
                              preventDefault(),
                              if_(
                                `not exists (select index from ui.result)`,
                                exit()
                              ),
                              scalar(
                                `next_index`,
                                `(select index from ui.result where active) - 1`
                              ),
                              modify(`update ui.result set active = false`),
                              if_(
                                `exists (select id from ui.result where index = next_index)`,
                                [
                                  modify(
                                    `update ui.result set active = true where index = next_index`
                                  ),
                                ],
                                [
                                  modify(
                                    `update ui.result set active = true where index = (select max(index) from ui.result)`
                                  ),
                                ]
                              ),
                              scrollToItem(true),
                              exit(),
                            ]),
                          ],
                        },
                      },
                    }),
                  }),
                  iconButton({
                    variant: "plain",
                    color: "neutral",
                    children: materialIcon("Close"),
                    on: { click: closeModal },
                  }),
                ],
              }),
              divider(),
              element("ul", {
                props: {
                  id: listboxId,
                  role: `'listbox'`,
                },
                styles: styles.listbox,
                children: each({
                  table: "result",
                  recordName: "search_record",
                  key: "id",
                  children: element("li", {
                    props: {
                      id: optionId(`search_record.id`),
                      role: `'option'`,
                      "aria-selected": `search_record.active`,
                      tabIndex: "0",
                    },
                    styles: styles.option,
                    on: {
                      click: {
                        detachedFromNode: true,
                        procedure: opts.onSelect(
                          `search_record.id`,
                          `search_record.label`
                        ),
                      },
                    },
                    children: [
                      element("span", {
                        styles: styles.optionLabel,
                        children: `search_record.label`,
                      }),
                      displayValues
                        ? element("div", {
                            styles: { display: "flex", gap: 1 },
                            children: displayValues.map((v, i) => {
                              const value =
                                `search_record.` + extraValuesIds[i];
                              return ifNode(
                                value + ` is not null`,
                                element("div", {
                                  styles: styles.optionExtraData,
                                  children: [
                                    element("p", {
                                      styles: styles.optionExtraDataLabel,
                                      children: `${stringLiteral(
                                        v.label
                                      )} || ':'`,
                                    }),
                                    element("span", {
                                      children: value,
                                    }),
                                  ],
                                })
                              );
                            }),
                          })
                        : undefined,
                    ],
                  }),
                }),
              }),
            ],
          }),
        }),
      }),
  });
}
