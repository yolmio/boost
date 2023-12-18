import { TableBuilder } from "../hub";
import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { hub, Table } from "../hub";
import { DomStatements, DomStatementsOrFn } from "../statements";
import { createStyles, cssVar } from "../styleUtils";
import { SequentialIDGenerator } from "../utils/SequentialIdGenerator";
import { normalizeCase, pluralize, upcaseFirst } from "../utils/inflectors";
import { ident, stringLiteral } from "../utils/sqlHelpers";
import * as yom from "../yom";
import { checkbox } from "./checkbox";
import { chip } from "./chip";
import { divider } from "./divider";
import { iconButton } from "./iconButton";
import { inlineFieldDisplay } from "./internal/fieldInlineDisplay";
import { materialIcon } from "./materialIcon";
import { IconName } from "./materialIconNames";
import { addDialogViewTransitionStyles, modal } from "./modal";
import { typography } from "./typography";
import { getUniqueUiId } from "./utils";

// waiting to polish these

export interface TableSearchDisplay {
  expr: (record: string) => yom.SqlExpression;
  name: string;
  label?: string;
  type: yom.FieldType;
}

interface PreparedTableSearchDisplay {
  expr: (record: string) => yom.SqlExpression;
  name: string;
  label: string;
  type: yom.FieldType;
  display: (value: yom.SqlExpression) => Node;
}

export interface TableSearchDialogOpts {
  open: string;
  onClose: DomStatementsOrFn;
  table: string;
  displayValues?: (string | TableSearchDisplay)[];
}

const styles = createStyles({
  dialog: () => {
    addDialogViewTransitionStyles("fullscreenOnMobile");
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
      viewTransitionName: "dialog-fullscreenOnMobile",
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
  value: string | TableSearchDisplay,
): PreparedTableSearchDisplay {
  if (typeof value === "string") {
    const field = table.fields[value];
    if (!field) {
      throw new Error(`Field ${value} does not exist on table ${table.name}`);
    }
    if (field.type === "ForeignKey") {
      const toTable = hub.db.tables[field.table];
      if (toTable.recordDisplayName) {
        const nameExpr = toTable.recordDisplayName.expr(
          ...toTable.recordDisplayName.fields.map((f) => `other.${f}`),
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
    let type: yom.FieldType;
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
  name: string,
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
  const tableModel = hub.db.tables[opts.table];
  if (!tableModel.recordDisplayName) {
    throw new Error("tableSearchDialog expects recordDisplayName to exist");
  }
  if (!tableModel.getHrefToRecord) {
    throw new Error("tableSearchDialog expects getHrefToRecord to exist");
  }
  const displayValues = opts.displayValues?.map((value) =>
    prepareDisplayValue(tableModel, value),
  );
  hub.currentApp!.deviceDb.addTable(`recent_${opts.table}_search`, (table) => {
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
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`),
  );
  const inputId = stringLiteral(getUniqueUiId());
  const listboxId = stringLiteral(getUniqueUiId());
  const optionId = (id: string) => `${inputId} || '-' || ${id}`;
  const fieldNameGenerator = new SequentialIDGenerator();
  const extraValuesIds: string[] = [];
  const tableFields = displayValues?.map((v): yom.ProcTableField => {
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
  function scrollToItem(alignToTop: boolean, s: DomStatements) {
    return s.block((s) =>
      s
        .getBoundingClientRect(listboxId, `container_rect`)
        .getBoundingClientRect(
          optionId(`(select id from ui.result where active)`),
          `item_rect`,
        )
        .if(
          `not (item_rect.top >= container_rect.top and item_rect.bottom <= container_rect.bottom)`,
          (s) =>
            s.scrollElIntoView({
              elementId: optionId(`(select id from ui.result where active)`),
              block: alignToTop ? `'start'` : `'end'`,
            }),
        ),
    );
  }
  const updateRecentSearch = new DomStatements().block((s) =>
    s
      .scalar(`result_id`, `(select id from ui.result where active)`)
      .modify(
        `delete from device.recent_${opts.table}_search where recent_search_id = result_id`,
      )
      .modify(
        `insert into device.recent_${opts.table}_search select id as recent_search_id, label as recent_search_label, current_timestamp() as recent_search_timestamp ${extraValuesToDeviceSelect} from ui.result where active`,
      )
      .if(
        `(select count(*) from device.recent_${opts.table}_search) >= 20`,
        (s) =>
          s.modify(
            `delete from device.recent_${opts.table}_search where recent_search_id = (select recent_search_id from device.recent_${opts.table}_search order by recent_search_timestamp asc limit 1)`,
          ),
      ),
  );
  return modal({
    open: opts.open,
    onClose: opts.onClose,
    children: (closeModal) =>
      nodes.element("div", {
        styles: styles.dialog(),
        on: { click: (s) => s.stopPropagation() },
        focusLock: {},
        scrollLock: { enabled: `true` },
        children: nodes.element("div", {
          styles: styles.dialogInner,
          children: nodes.state({
            procedure: (s) => s.scalar("query", "''"),
            children: nodes.state({
              watch: ["query"],
              procedure: (s) =>
                s
                  .table("result", [
                    {
                      name: "label",
                      type: { type: "String", maxLength: 1000 },
                      notNull: true,
                    },
                    { name: "id", type: { type: "BigInt" }, notNull: true },
                    { name: "index", type: { type: "BigInt" }, notNull: true },
                    { name: "active", type: { type: "Bool" }, notNull: true },
                    {
                      name: "is_recent",
                      type: { type: "Bool" },
                      notNull: true,
                    },
                    ...(tableFields ?? []),
                  ])
                  .if({
                    condition: `trim(query) = ''`,
                    then: (s) =>
                      s.modify(
                        `insert into result select
                        recent_search_timestamp = (select max(recent_search_timestamp) from device.recent_${opts.table}_search) as active,
                        recent_search_id as id,
                        recent_search_label as label,
                        rank() over (order by recent_search_timestamp desc) as index,
                        true as is_recent
                        ${extraValuesFromDeviceSelect}
                      from device.recent_${opts.table}_search
                      order by recent_search_timestamp desc`,
                      ),
                    else: (s) =>
                      s.search({
                        query: "query",
                        resultTable: `tmp_result`,
                        limit: `10`,
                        config: {
                          tokenizer: {
                            splitter: { type: "Alphanumeric" },
                            filters: [
                              { type: "AsciiFold" },
                              { type: "Lowercase" },
                            ],
                          },
                          style: {
                            type: "Fuzzy",
                            ...hub.searchConfig.defaultFuzzyConfig,
                          },
                          tables: [searchConfig],
                        },
                      }).modify(`insert into result
                select
                  ${nameExpr} as label, 
                  rank() over () = 1 as active,
                  rank() over () as index,
                  false as is_recent,
                  record_id as id ${extraValuesSelect}
                from tmp_result
                join db.${opts.table} as record on record_id = id`),
                  }),
              children: [
                nodes.eventHandlers({
                  document: {
                    keydown: (s) => s.if(`event.key = 'Escape'`, closeModal),
                  },
                }),
                nodes.element("header", {
                  styles: styles.header,
                  children: [
                    nodes.element("label", {
                      styles: styles.searchIcon,
                      props: { htmlFor: inputId },
                      children: materialIcon({
                        name: "Search",
                        fontSize: "xl3",
                      }),
                    }),
                    nodes.mode({
                      render: "'immediate'",
                      children: nodes.element("input", {
                        styles: styles.input,
                        props: {
                          id: inputId,
                          placeholder: `'Search…'`,
                          "aria-autocomplete": `'list'`,
                          "aria-haspopup": `'listbox'`,
                          "aria-controls": listboxId,
                          "aria-expanded": `true`,
                          "aria-activedescendant": optionId(
                            `(select id from ui.result where active)`,
                          ),
                          type: `'text'`,
                          spellCheck: `'false'`,
                          autoComplete: `'off'`,
                          autoCapitalize: `'off'`,
                          role: `'combobox'`,
                          value: `query`,
                        },
                        on: {
                          input: (s) =>
                            s
                              .setScalar("ui.query", "target_value")
                              .modify(`update ui.result set active = false`),
                          keydown: (s) =>
                            s
                              .if(`event.key = 'Escape'`, closeModal)
                              .if(
                                `event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
                                (s) => s.return(),
                              )
                              .if(
                                `event.key = 'Enter' or event.key = 'Tab'`,
                                (s) =>
                                  s
                                    .scalar(
                                      `result_id`,
                                      `(select id from ui.result where active)`,
                                    )
                                    .if(`result_id is not null`, (s) =>
                                      s
                                        .preventDefault()
                                        .statements(updateRecentSearch)
                                        .navigate(
                                          tableModel.getHrefToRecord!(
                                            "result_id",
                                          ),
                                        )
                                        .triggerViewTransition(
                                          "all",
                                          "'navigate close-modal'",
                                        )
                                        .statements(closeModal),
                                    )
                                    .return(),
                              )
                              .if(`event.key = 'ArrowDown'`, (s) =>
                                s
                                  .preventDefault()
                                  .if(
                                    `not exists (select id from ui.result)`,
                                    (s) => s.return(),
                                  )
                                  .scalar(
                                    `next_index`,
                                    `(select index from ui.result where active) + 1`,
                                  )
                                  .modify(`update ui.result set active = false`)
                                  .if({
                                    condition: `exists (select id from ui.result where index = next_index)`,
                                    then: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = next_index`,
                                      ),
                                    else: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = 1`,
                                      ),
                                  })
                                  .statements((s) => scrollToItem(false, s))
                                  .return(),
                              )
                              .if(`event.key = 'ArrowUp'`, (s) =>
                                s
                                  .preventDefault()
                                  .if(
                                    `not exists (select index from ui.result)`,
                                    (s) => s.return(),
                                  )
                                  .scalar(
                                    `next_index`,
                                    `(select index from ui.result where active) - 1`,
                                  )
                                  .modify(`update ui.result set active = false`)
                                  .if({
                                    condition: `exists (select id from ui.result where index = next_index)`,
                                    then: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = next_index`,
                                      ),
                                    else: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = (select max(index) from ui.result)`,
                                      ),
                                  })
                                  .statements((s) => scrollToItem(true, s))
                                  .return(),
                              ),
                        },
                      }),
                    }),
                    iconButton({
                      variant: "plain",
                      color: "neutral",
                      children: materialIcon("Close"),
                      on: { click: closeModal },
                      ariaLabel: `'Close search dialog'`,
                    }),
                  ],
                }),
                divider(),
                nodes.element("ul", {
                  props: {
                    id: listboxId,
                    role: `'listbox'`,
                  },
                  styles: styles.listbox,
                  children: nodes.each({
                    table: "result",
                    recordName: "record",
                    key: "id",
                    children: nodes.element("li", {
                      props: {
                        id: optionId(`record.id`),
                        role: `'option'`,
                        "aria-selected": `record.active`,
                        tabIndex: "0",
                      },
                      styles: styles.option,
                      on: {
                        click: (s) =>
                          s
                            .statements(updateRecentSearch)
                            .navigate(tableModel.getHrefToRecord!(`record.id`))
                            .triggerViewTransition("all")
                            .statements(closeModal),
                      },
                      children: [
                        nodes.element("div", {
                          styles: styles.optionLeft,
                          children: [
                            nodes.if(
                              `record.is_recent`,
                              materialIcon({
                                name: "History",
                                fontSize: "xl2",
                              }),
                            ),
                            nodes.element("div", {
                              styles: styles.optionLabelContainer,
                              children: [
                                nodes.element("span", {
                                  styles: styles.optionLabel,
                                  children: `record.label`,
                                }),
                                displayValues
                                  ? nodes.element("div", {
                                      styles: styles.displayValues,
                                      children: displayValues.map((v, i) => {
                                        const value =
                                          `record.` + extraValuesIds[i];
                                        return nodes.if(
                                          value + ` is not null`,
                                          nodes.element("div", {
                                            styles: styles.optionExtraData,
                                            children: [
                                              nodes.element("p", {
                                                styles:
                                                  styles.optionExtraDataLabel,
                                                children: `${stringLiteral(
                                                  v.label,
                                                )} || ':'`,
                                              }),
                                              nodes.element("span", {
                                                children: v.display(value),
                                              }),
                                            ],
                                          }),
                                        );
                                      }),
                                    })
                                  : undefined,
                              ],
                            }),
                          ],
                        }),
                        nodes.if(
                          `record.is_recent`,
                          iconButton({
                            variant: "plain",
                            children: materialIcon("Close"),
                            size: "sm",
                            on: {
                              click: (s) =>
                                s
                                  .stopPropagation()
                                  .modify(
                                    `delete from device.recent_${opts.table}_search where recent_search_id = record.id`,
                                  )
                                  .modify(
                                    `delete from ui.result where id = record.id`,
                                  ),
                            },
                            ariaLabel: `'Remove recent search'`,
                          }),
                        ),
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
  const extraRecordFields: yom.ProcTableField[] = [];
  let extraValuesSelect = "";
  let extraValuesFromDeviceSelect = ``;
  let extraValuesToDeviceSelect = ``;
  let joinToTables = "";
  const tableConfigs: yom.RankedSearchTable[] = [];
  const fieldNameGenerator = new SequentialIDGenerator();
  const displayValueNames: Record<string, string[]> = {};
  let labelExpr = "case ";
  let urlExpr = "case ";
  for (const table of tables) {
    const tableModel = hub.db.tables[table.name];
    if (!tableModel.recordDisplayName) {
      throw new Error(
        "multiTableSearchDialog expects recordDisplayName to exist",
      );
    }
    if (!tableModel.getHrefToRecord) {
      throw new Error(
        "multiTableSearchDialog expects getHrefToRecord to exist, missing on " +
          tableModel.name,
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
      table.name,
    )} on table = ${stringLiteral(table.name)} and record_id = ${ident(
      table.name,
    )}.id `;
    tableConfigs.push({
      ...tableModel.searchConfig,
      disabled: table.name + "_disabled",
    });
    const nameExpr = tableModel.recordDisplayName.expr(
      ...tableModel.recordDisplayName.fields.map((f) => `${table.name}.${f}`),
    );
    labelExpr += `when table = ${stringLiteral(table.name)} then ${nameExpr} `;
    urlExpr += `when record.table = ${stringLiteral(
      table.name,
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
  onClose: DomStatementsOrFn;
  tables: MultiTableSearchDialogTable[];
}

export function multiTableSearchDialog(opts: MultiTableSearchDialogOpts) {
  const inputId = stringLiteral(getUniqueUiId());
  const listboxId = stringLiteral(getUniqueUiId());
  const containerId = stringLiteral(getUniqueUiId());
  const optionId = (id: yom.SqlExpression): yom.SqlExpression =>
    `${inputId} || '-' || ${id}`;
  const tables = opts.tables.map((t): PreparedMultiTableSearchDialogTable => {
    const tableModel = hub.db.tables[t.name];
    if (!tableModel) {
      throw new Error(`Table ${t.name} does not exist`);
    }
    return {
      name: t.name,
      icon: t.icon,
      tableModel,
      displayValues: t.displayValues?.map((v) =>
        prepareDisplayValue(tableModel, v),
      ),
    };
  });
  hub.currentApp!.deviceDb.addTable("recent_multi_table_search", (table) => {
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
  const updateRecentSearch = new DomStatements().block((s) =>
    s
      .scalar(`result_id`, `(select id from ui.result where active)`)
      .modify(
        `delete from device.recent_multi_table_search where recent_search_id = result_id`,
      )
      .modify(
        `insert into device.recent_multi_table_search
        select id as recent_search_id,
        label as recent_search_label,
        cast(table as string) as recent_search_table,
        current_timestamp() as recent_search_timestamp
        ${extraValuesToDeviceSelect} from ui.result where active`,
      )
      .if(
        `(select count(*) from device.recent_multi_table_search) >= 20`,
        (s) =>
          s.modify(
            `delete from device.recent_multi_table_search where recent_search_id = (select recent_search_id from device.recent_multi_table_search order by recent_search_timestamp asc limit 1)`,
          ),
      ),
  );
  function scrollToItem(alignToTop: boolean, s: DomStatements) {
    return s.block((s) =>
      s
        .getBoundingClientRect(containerId, `container_rect`)
        .scalar(
          `option_id`,
          optionId(
            `(select table from ui.result where active) || '_' || (select id from ui.result where active)`,
          ),
        )
        .getBoundingClientRect(`option_id`, `item_rect`)
        .if(
          `not (item_rect.top >= container_rect.top and item_rect.bottom <= container_rect.bottom)`,
          (s) =>
            s.scrollElIntoView({
              elementId: `option_id`,
              block: alignToTop ? `'start'` : `'end'`,
            }),
        ),
    );
  }
  return modal({
    open: opts.open,
    onClose: opts.onClose,
    children: (closeModal) => {
      const tableFilters = nodes.element("div", {
        styles: {
          display: "flex",
          p: 1,
          gap: 1,
          flexWrap: "wrap",
        },
        children: [
          typography({
            level: "body-sm",
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
              startDecorator: nodes.if(
                `not ${t.name}_disabled`,
                materialIcon("Check"),
              ),
              children: checkbox({
                size: "sm",
                checked: `not ${t.name}_disabled`,
                label: stringLiteral(
                  pluralize(hub.db.tables[t.name].displayName),
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
                  checkboxChange: (s) =>
                    s.setScalar(`${t.name}_disabled`, `not ${t.name}_disabled`),
                },
              }),
            });
          }),
        ],
      });
      return nodes.element("div", {
        styles: styles.dialog(),
        on: { click: (s) => s.stopPropagation() },
        focusLock: {},
        scrollLock: { enabled: `true` },
        children: nodes.element("div", {
          styles: styles.dialogInner,
          children: nodes.state({
            procedure: (s) =>
              s
                .scalar("query", "''")
                .mapArrayToStatements(opts.tables, (table, s) =>
                  s.scalar(`${table.name}_disabled`, "false"),
                ),
            children: nodes.state({
              watch: ["query", ...opts.tables.map((t) => `${t.name}_disabled`)],
              procedure: (s) =>
                s
                  .table("result", [
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
                    {
                      name: "is_recent",
                      type: { type: "Bool" },
                      notNull: true,
                    },
                    ...extraRecordFields,
                  ])
                  .if({
                    condition: `trim(query) = ''`,
                    then: (s) =>
                      s.modify(
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
                      order by recent_search_timestamp desc`,
                      ),
                    else: (s) =>
                      s.search({
                        query: "query",
                        resultTable: `tmp_result`,
                        limit: `20`,
                        config: {
                          tokenizer: {
                            splitter: { type: "Alphanumeric" },
                            filters: [
                              { type: "AsciiFold" },
                              { type: "Lowercase" },
                            ],
                          },
                          style: {
                            type: "Fuzzy",
                            ...hub.searchConfig.defaultFuzzyConfig,
                          },
                          tables: tableConfigs,
                        },
                      }).modify(`insert into result
                select
                  ${labelExpr} as label,
                  rank() over () = 1 as active,
                  rank() over () as index,
                  false as is_recent,
                  table,
                  record_id as id ${extraValuesSelect}
                from tmp_result ${joinToTables}`),
                  }),
              children: [
                nodes.eventHandlers({
                  document: {
                    keydown: (s) => s.if(`event.key = 'Escape'`, closeModal),
                  },
                }),
                nodes.element("header", {
                  styles: styles.header,
                  children: [
                    nodes.element("label", {
                      styles: styles.searchIcon,
                      props: { htmlFor: inputId },
                      children: materialIcon({
                        name: "Search",
                        fontSize: "xl3",
                      }),
                    }),
                    nodes.mode({
                      render: "'immediate'",
                      children: nodes.element("input", {
                        styles: styles.input,
                        props: {
                          id: inputId,
                          placeholder: `'Search…'`,
                          "aria-autocomplete": `'list'`,
                          "aria-haspopup": `'listbox'`,
                          "aria-controls": listboxId,
                          "aria-expanded": `true`,
                          "aria-activedescendant": optionId(
                            `(select id from ui.result where active)`,
                          ),
                          type: `'text'`,
                          spellCheck: `'false'`,
                          autoComplete: `'off'`,
                          autoCapitalize: `'off'`,
                          role: `'combobox'`,
                          value: `query`,
                        },
                        on: {
                          input: (s) =>
                            s
                              .setScalar("ui.query", "target_value")
                              .modify(`update ui.result set active = false`),
                          keydown: (s) =>
                            s
                              .if(`event.key = 'Escape'`, closeModal)
                              .if(
                                `event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
                                (s) => s.return(),
                              )
                              .if(
                                `event.key = 'Enter' or event.key = 'Tab'`,
                                (s) =>
                                  s
                                    .record(
                                      `record`,
                                      `select id, table from ui.result where active`,
                                    )
                                    .if(`record.id is not null`, (s) =>
                                      s
                                        .preventDefault()
                                        .statements(updateRecentSearch)
                                        .navigate(urlExpr)
                                        .statements(closeModal),
                                    )
                                    .return(),
                              )
                              .if(`event.key = 'ArrowDown'`, (s) =>
                                s
                                  .preventDefault()
                                  .if(
                                    `not exists (select id from ui.result)`,
                                    (s) => s.return(),
                                  )
                                  .scalar(
                                    `next_index`,
                                    `(select index from ui.result where active) + 1`,
                                  )
                                  .modify(`update ui.result set active = false`)
                                  .if({
                                    condition: `exists (select id from ui.result where index = next_index)`,
                                    then: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = next_index`,
                                      ),
                                    else: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = 1`,
                                      ),
                                  })
                                  .statements((s) => scrollToItem(false, s))
                                  .return(),
                              )
                              .if(`event.key = 'ArrowUp'`, (s) =>
                                s
                                  .preventDefault()
                                  .if(
                                    `not exists (select index from ui.result)`,
                                    (s) => s.return(),
                                  )
                                  .scalar(
                                    `next_index`,
                                    `(select index from ui.result where active) - 1`,
                                  )
                                  .modify(`update ui.result set active = false`)
                                  .if({
                                    condition: `exists (select id from ui.result where index = next_index)`,
                                    then: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = next_index`,
                                      ),
                                    else: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = (select max(index) from ui.result)`,
                                      ),
                                  })
                                  .statements((s) => scrollToItem(true, s))
                                  .return(),
                              ),
                        },
                      }),
                    }),
                    iconButton({
                      variant: "plain",
                      color: "neutral",
                      children: materialIcon("Close"),
                      on: { click: closeModal },
                      ariaLabel: `'Close search dialog'`,
                    }),
                  ],
                }),
                divider(),
                nodes.element("div", {
                  styles: styles.resultsContainer,
                  props: { id: containerId },
                  children: [
                    tableFilters,
                    nodes.element("ul", {
                      props: {
                        id: listboxId,
                        role: `'listbox'`,
                      },
                      styles: styles.multiTableListbox,
                      children: nodes.each({
                        table: "result",
                        recordName: "record",
                        key: "table || '_' || id",
                        children: nodes.element("li", {
                          props: {
                            id: optionId(`record.table || '_' || record.id`),
                            role: `'option'`,
                            "aria-selected": `record.active`,
                            tabIndex: "0",
                          },
                          styles: styles.option,
                          on: {
                            click: (s) =>
                              s
                                .navigate(urlExpr)
                                .statements(updateRecentSearch)
                                .statements(closeModal),
                          },
                          children: [
                            nodes.element("div", {
                              styles: styles.optionLeft,
                              children: [
                                nodes.if(
                                  `record.is_recent`,
                                  materialIcon({
                                    name: "History",
                                    fontSize: "xl2",
                                  }),
                                ),
                                nodes.element("div", {
                                  styles: styles.optionLabelContainer,
                                  children: [
                                    nodes.element("span", {
                                      styles: styles.optionLabel,
                                      children: `record.label`,
                                    }),
                                    nodes.switch(
                                      ...tables
                                        .filter((t) => t.displayValues)
                                        .map((t) => {
                                          const displayValueIds =
                                            displayValueNames[t.name];
                                          return {
                                            condition: `record.table = ${stringLiteral(
                                              t.name,
                                            )}`,
                                            node: nodes.element("div", {
                                              styles: styles.displayValues,
                                              children: t.displayValues!.map(
                                                (v, i) => {
                                                  const value =
                                                    `record.` +
                                                    displayValueIds[i];
                                                  return nodes.if(
                                                    value + ` is not null`,
                                                    nodes.element("div", {
                                                      styles:
                                                        styles.optionExtraData,
                                                      children: [
                                                        nodes.element("p", {
                                                          styles:
                                                            styles.optionExtraDataLabel,
                                                          children: `${stringLiteral(
                                                            v.label,
                                                          )} || ':'`,
                                                        }),
                                                        v.display(value),
                                                      ],
                                                    }),
                                                  );
                                                },
                                              ),
                                            }),
                                          };
                                        }),
                                    ),
                                  ],
                                }),
                              ],
                            }),
                            nodes.element("div", {
                              styles: {
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                              },
                              children: [
                                nodes.switch(
                                  ...opts.tables.map((t) => {
                                    return {
                                      condition: `record.table = ${stringLiteral(
                                        t.name,
                                      )}`,
                                      node: materialIcon({
                                        name: t.icon,
                                        fontSize: "xl",
                                      }),
                                    };
                                  }),
                                ),
                                nodes.if(
                                  `record.is_recent`,
                                  iconButton({
                                    variant: "plain",
                                    children: materialIcon("Close"),
                                    size: "sm",
                                    on: {
                                      click: (s) =>
                                        s
                                          .stopPropagation()
                                          .modify(
                                            `delete from device.recent_multi_table_search where recent_search_id = record.id`,
                                          )
                                          .modify(
                                            `delete from ui.result where id = record.id`,
                                          ),
                                    },
                                    ariaLabel: `'Remove recent search'`,
                                  }),
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
      });
    },
  });
}

export interface RecordSelectDialog {
  table: string;
  displayValues?: TableSearchDisplay[];
  onSelect: (id: string, label: string) => DomStatementsOrFn;
  open: string;
  onClose: DomStatementsOrFn;
  placeholder?: string;
}

export function recordSelectDialog(opts: RecordSelectDialog) {
  const tableModel = hub.db.tables[opts.table];
  if (!tableModel.recordDisplayName) {
    throw new Error("tableSearchDialog expects recordDisplayName to exist");
  }
  const displayValues = opts.displayValues?.map((value) =>
    prepareDisplayValue(tableModel, value),
  );
  const nameExpr = tableModel.recordDisplayName.expr(
    ...tableModel.recordDisplayName.fields.map((f) => `record.${f}`),
  );
  const inputId = stringLiteral(getUniqueUiId());
  const listboxId = stringLiteral(getUniqueUiId());
  const optionId = (id: string) => `${inputId} || '-' || ${id}`;
  const fieldNameGenerator = new SequentialIDGenerator();
  const extraValuesIds: string[] = [];
  const tableFields = displayValues?.map((v): yom.ProcTableField => {
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
    return new DomStatements().block((s) =>
      s
        .getBoundingClientRect(listboxId, `container_rect`)
        .getBoundingClientRect(
          optionId(`(select id from ui.result where active)`),
          `item_rect`,
        )
        .if(
          `not (item_rect.top >= container_rect.top and item_rect.bottom <= container_rect.bottom)`,
          (s) =>
            s.scrollElIntoView({
              elementId: optionId(`(select id from ui.result where active)`),
              block: alignToTop ? `'start'` : `'end'`,
            }),
        ),
    );
  }
  return modal({
    open: opts.open,
    onClose: opts.onClose,
    children: (closeModal) =>
      nodes.element("div", {
        styles: styles.dialog(),
        on: { click: (s) => s.stopPropagation() },
        focusLock: {},
        scrollLock: { enabled: `true` },
        children: nodes.state({
          procedure: (s) => s.scalar("query", "''"),
          children: nodes.state({
            watch: ["query"],
            procedure: (s) =>
              s
                .table("result", [
                  { name: "label", type: { type: "String", maxLength: 1000 } },
                  { name: "id", type: { type: "BigInt" } },
                  { name: "index", type: { type: "BigInt" } },
                  { name: "active", type: { type: "Bool" } },
                  ...(tableFields ?? []),
                ])
                .if({
                  condition: `trim(query) = ''`,
                  then: (s) =>
                    s.modify(`insert into result
                select
                  ${nameExpr} as label,
                  rank() over () = 1 as active,
                  rank() over () as index,
                  record.id as id ${extraValuesSelect}
                from db.${opts.table} as record
                limit 15`),
                  else: (s) =>
                    s.search({
                      query: "query",
                      resultTable: `tmp_result`,
                      limit: `10`,
                      config: {
                        tokenizer: {
                          splitter: { type: "Alphanumeric" },
                          filters: [
                            { type: "AsciiFold" },
                            { type: "Lowercase" },
                          ],
                        },
                        style: {
                          type: "Fuzzy",
                          ...hub.searchConfig.defaultFuzzyConfig,
                        },
                        tables: [searchConfig],
                      },
                    }).modify(`insert into result
                select
                  ${nameExpr} as label,
                  rank() over () = 1 as active,
                  rank() over () as index,
                  record_id as id ${extraValuesSelect}
                from tmp_result
                join db.${opts.table} as record on record_id = id`),
                }),
            children: [
              nodes.eventHandlers({
                document: {
                  keydown: (s) => s.if(`event.key = 'Escape'`, closeModal),
                },
              }),
              nodes.element("header", {
                styles: styles.header,
                children: [
                  nodes.element("label", {
                    styles: styles.searchIcon,
                    props: { htmlFor: inputId },
                    children: materialIcon({
                      name: "Search",
                      fontSize: "xl3",
                    }),
                  }),
                  nodes.mode({
                    render: "'immediate'",
                    children: nodes.element("input", {
                      styles: styles.input,
                      props: {
                        id: inputId,
                        placeholder: opts.placeholder ?? `'Select a record…'`,
                        "aria-autocomplete": `'list'`,
                        "aria-haspopup": `'listbox'`,
                        "aria-controls": listboxId,
                        "aria-expanded": `true`,
                        "aria-activedescendant": optionId(
                          `(select id from ui.result where active)`,
                        ),
                        type: `'text'`,
                        spellCheck: `'false'`,
                        autoComplete: `'off'`,
                        autoCapitalize: `'off'`,
                        role: `'combobox'`,
                        value: `query`,
                      },
                      on: {
                        input: (s) =>
                          s
                            .setScalar("ui.query", "target_value")
                            .modify(`update ui.result set active = false`),
                        keydown: {
                          detachedFromNode: true,
                          procedure: (s) =>
                            s
                              .if(`event.key = 'Escape'`, closeModal)
                              .if(
                                `event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
                                (s) => s.return(),
                              )
                              .if(
                                `event.key = 'Enter' or event.key = 'Tab'`,
                                (s) =>
                                  s
                                    .record(
                                      `selected_record`,
                                      `select id, label from ui.result where active`,
                                    )
                                    .if(`selected_record.id is not null`, (s) =>
                                      s
                                        .preventDefault()
                                        .statements(
                                          opts.onSelect(
                                            `selected_record.id`,
                                            `selected_record.label`,
                                          ),
                                        ),
                                    )
                                    .return(),
                              )
                              .if(`event.key = 'ArrowDown'`, (s) =>
                                s
                                  .preventDefault()
                                  .if(
                                    `not exists (select id from ui.result)`,
                                    (s) => s.return(),
                                  )
                                  .scalar(
                                    `next_index`,
                                    `(select index from ui.result where active) + 1`,
                                  )
                                  .modify(`update ui.result set active = false`)
                                  .if({
                                    condition: `exists (select id from ui.result where index = next_index)`,
                                    then: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = next_index`,
                                      ),
                                    else: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = 1`,
                                      ),
                                  })
                                  .statements(scrollToItem(false))
                                  .return(),
                              )
                              .if(`event.key = 'ArrowUp'`, (s) =>
                                s
                                  .preventDefault()
                                  .if(
                                    `not exists (select index from ui.result)`,
                                    (s) => s.return(),
                                  )
                                  .scalar(
                                    `next_index`,
                                    `(select index from ui.result where active) - 1`,
                                  )
                                  .modify(`update ui.result set active = false`)
                                  .if({
                                    condition: `exists (select id from ui.result where index = next_index)`,
                                    then: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = next_index`,
                                      ),
                                    else: (s) =>
                                      s.modify(
                                        `update ui.result set active = true where index = (select max(index) from ui.result)`,
                                      ),
                                  })
                                  .statements(scrollToItem(true))
                                  .return(),
                              ),
                        },
                      },
                    }),
                  }),
                  iconButton({
                    variant: "plain",
                    color: "neutral",
                    children: materialIcon("Close"),
                    on: { click: closeModal },
                    ariaLabel: `'Close search dialog'`,
                  }),
                ],
              }),
              divider(),
              nodes.element("ul", {
                props: {
                  id: listboxId,
                  role: `'listbox'`,
                },
                styles: styles.listbox,
                children: nodes.each({
                  table: "result",
                  recordName: "search_record",
                  key: "id",
                  children: nodes.element("li", {
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
                          `search_record.label`,
                        ),
                      },
                    },
                    children: [
                      nodes.element("span", {
                        styles: styles.optionLabel,
                        children: `search_record.label`,
                      }),
                      displayValues
                        ? nodes.element("div", {
                            styles: { display: "flex", gap: 1 },
                            children: displayValues.map((v, i) => {
                              const value =
                                `search_record.` + extraValuesIds[i];
                              return nodes.if(
                                value + ` is not null`,
                                nodes.element("div", {
                                  styles: styles.optionExtraData,
                                  children: [
                                    nodes.element("p", {
                                      styles: styles.optionExtraDataLabel,
                                      children: `${stringLiteral(
                                        v.label,
                                      )} || ':'`,
                                    }),
                                    nodes.element("span", {
                                      children: value,
                                    }),
                                  ],
                                }),
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
