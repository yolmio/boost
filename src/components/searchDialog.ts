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
  debugExpr,
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
import { config, model, theme } from "../singleton.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { SequentialIDGenerator } from "../utils/SequentialIdGenerator.js";
import { pluralize } from "../utils/inflectors.js";
import { ident, stringLiteral } from "../utils/sqlHelpers.js";
import {
  BaseStatement,
  ClientProcStatement,
  FieldType,
  ProcTableField,
  RankedSearchTable,
} from "../yom.js";
import { checkbox } from "./checkbox.js";
import { chip } from "./chip.js";
import { divider } from "./divider.js";
import { materialIcon, MaterialIconOpts } from "./materialIcon.js";
import { IconName } from "./materialIconNames.js";
import { modal } from "./modal.js";
import { typography } from "./typography.js";
import { getUniqueUiId } from "./utils.js";

// waiting to polish these

export interface TableSearchDisplay {
  expr: string;
  label: string;
  type: FieldType;
}

export interface TableSearchDialogOpts {
  open: string;
  onClose: ClientProcStatement[];
  table: string;
  displayValues?: TableSearchDisplay[];
}

const styles = createStyles({
  dialog: () => {
    return {
      boxSizing: "border-box",
      boxShadow: theme.shadow.md,
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
  escButton: {
    mr: 1,
    height: 22,
    borderRadius: "5",
    backgroundColor: "neutral-100",
    borderColor: "neutral-400",
    borderWidth: 1,
    borderStyle: "solid",
    color: "neutral-800",
    fontWeight: 700,
    letterSpacing: "0.08rem",
    fontSize: "0.75rem",
    fontFamily: "monospace",
    cursor: "pointer",
    dark: {
      backgroundColor: "neutral-800",
      borderColor: "neutral-500",
      color: "neutral-400",
    },
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
  multiTableOption: {
    py: 1.5,
    px: 3,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    listStyle: "none",
    borderColor: "transparent",
    borderBottomColor: cssVar(`palette-divider`),
    borderWidth: "1px",
    borderStyle: "solid",
    cursor: "pointer",
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

export function tableSearchDialog(opts: TableSearchDialogOpts) {
  // addDeviceDatabaseTable(`recent_${opts.table}_search`, (table) => {
  //   table.string("value", 500);
  // });
  const tableModel = model.database.tables[opts.table];
  if (!tableModel.recordDisplayName) {
    throw new Error("tableSearchDialog expects recordDisplayName to exist");
  }
  const nameExpr = tableModel.recordDisplayName.expr(
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
  );
  const inputId = stringLiteral(getUniqueUiId());
  const listboxId = stringLiteral(getUniqueUiId());
  const optionId = (id: string) => `${inputId} || '-' || ${id}`;
  const fieldNameGenerator = new SequentialIDGenerator();
  const extraValuesIds: string[] = [];
  const tableFields = opts.displayValues?.map((v): ProcTableField => {
    const name = fieldNameGenerator.next();
    extraValuesIds.push(name);
    return { name, type: v.type };
  });
  let extraValuesSelect = ``;
  if (opts.displayValues) {
    extraValuesSelect = `,`;
    extraValuesSelect += opts.displayValues
      .map((v, id) => {
        return v.expr + " as " + extraValuesIds[id];
      })
      .join(",");
  }
  const searchConfig = tableModel.searchConfig;
  if (!searchConfig) {
    throw new Error(`Table ${tableModel.name.name} does not have searchConfig`);
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
                  },
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
                          ...config.defaultFuzzyConfig,
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
                                `id`,
                                `(select id from ui.result where active)`
                              ),
                              if_(`id is not null`, [
                                preventDefault(),
                                navigate(`'/contacts/' || id`),
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
                    element("button", {
                      styles: styles.escButton,
                      children: `'esc'`,
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
                          navigate(`'/contacts/' || record.id`),
                          ...closeModal,
                        ],
                      },
                      children: [
                        element("span", {
                          styles: styles.optionLabel,
                          children: `record.label`,
                        }),
                        opts.displayValues
                          ? element("div", {
                              styles: styles.displayValues,
                              children: opts.displayValues.map((v, i) => {
                                const value = `record.` + extraValuesIds[i];
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
      }),
  });
}

export interface MultiTableSearchDialogTable {
  name: string;
  displayValues?: TableSearchDisplay[];
  icon: IconName;
}

function calcMultiTable(tables: MultiTableSearchDialogTable[]) {
  const extraRecordFields: ProcTableField[] = [];
  let extraValuesSelect = "";
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
          tableModel.name.name
      );
    }
    if (!tableModel.searchConfig) {
      throw new Error(
        `Table ${tableModel.name.name} does not have searchConfig`
      );
    }
    if (table.displayValues) {
      displayValueNames[table.name] = [];
      for (const value of table.displayValues) {
        const name = fieldNameGenerator.next();
        displayValueNames[table.name].push(name);
        extraRecordFields.push({ name, type: value.type });
        extraValuesSelect += `, ${value.expr} as ${name}`;
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
  const {
    extraRecordFields,
    extraValuesSelect,
    joinToTables,
    tableConfigs,
    labelExpr,
    displayValueNames,
    urlExpr,
  } = calcMultiTable(opts.tables);
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
                  },
                  { name: "id", type: { type: "BigInt" } },
                  {
                    name: "table",
                    type: { type: "Enum", enum: "sys_db_table" },
                  },
                  { name: "index", type: { type: "BigInt" } },
                  { name: "active", type: { type: "Bool" } },
                  ...extraRecordFields,
                ]),
                if_(`trim(query) != ''`, [
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
                        ...config.defaultFuzzyConfig,
                      },
                      tables: tableConfigs,
                    },
                  }),
                  modify(`insert into result
                select
                  ${labelExpr} as label, 
                  rank() over () = 1 as active,
                  rank() over () as index,
                  table,
                  record_id as id ${extraValuesSelect}
                from tmp_result ${joinToTables}`),
                ]),
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
                    element("button", {
                      styles: styles.escButton,
                      children: `'esc'`,
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
                                  model.database.tables[t.name].name.displayName
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
                          styles: styles.multiTableOption,
                          on: {
                            click: [navigate(urlExpr), ...closeModal],
                          },
                          children: [
                            element("div", {
                              children: [
                                element("span", {
                                  styles: styles.optionLabel,
                                  children: `record.label`,
                                }),
                                switchNode(
                                  ...opts.tables
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
                                                `record.` + displayValueIds[i];
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
                                                    element("span", {
                                                      children: value,
                                                    }),
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
  // addDeviceDatabaseTable(`recent_${opts.table}_search`, (table) => {
  //   table.string("value", 500);
  // });
  const tableModel = model.database.tables[opts.table];
  if (!tableModel.recordDisplayName) {
    throw new Error("tableSearchDialog expects recordDisplayName to exist");
  }
  const nameExpr = tableModel.recordDisplayName.expr(
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`)
  );
  const inputId = stringLiteral(getUniqueUiId());
  const listboxId = stringLiteral(getUniqueUiId());
  const optionId = (id: string) => `${inputId} || '-' || ${id}`;
  const fieldNameGenerator = new SequentialIDGenerator();
  const extraValuesIds: string[] = [];
  const tableFields = opts.displayValues?.map((v): ProcTableField => {
    const name = fieldNameGenerator.next();
    extraValuesIds.push(name);
    return { name, type: v.type };
  });
  let extraValuesSelect = ``;
  if (opts.displayValues) {
    extraValuesSelect = `,`;
    extraValuesSelect += opts.displayValues
      .map((v, id) => {
        return v.expr + " as " + extraValuesIds[id];
      })
      .join(",");
  }
  const searchConfig = tableModel.searchConfig;
  if (!searchConfig) {
    throw new Error(`Table ${tableModel.name.name} does not have searchConfig`);
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
                        ...config.defaultFuzzyConfig,
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
                  element("button", {
                    styles: styles.escButton,
                    children: `'esc'`,
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
                      opts.displayValues
                        ? element("div", {
                            styles: { display: "flex", gap: 1 },
                            children: opts.displayValues.map((v, i) => {
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
