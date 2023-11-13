import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { app } from "../../app";
import { stringLiteral } from "../../utils/sqlHelpers";
import { button } from "../../components/button";
import { iconButton } from "../../components/iconButton";
import { input } from "../../components/input";
import { materialIcon } from "../../components/materialIcon";
import { popoverMenu } from "../../components/menu";
import { select } from "../../components/select";
import { getTableRecordSelect } from "../../components/tableRecordSelect";
import {
  defaultOpForFieldType,
  eqFilterType,
  FilterType,
} from "./styledDatagrid";
import { checkbox } from "../../components/checkbox";
import { durationInput } from "../../components/durationInput";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { styles as sharedStyles } from "./styles";
import { getUniqueUiId } from "../../components/utils";
import { SuperGridColumn, SuperGridDts } from "./styledDatagrid";
import {
  BasicStatements,
  DomStatements,
  DomStatementsOrFn,
} from "../../statements";
import { lazy } from "../../utils/memoize";
import { dgState, DgStateHelpers } from "./shared";
import * as yom from "../../yom";

const styles = createStyles({
  checkboxWrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "sm",
  },
  checkbox: {
    mx: 3,
  },
  groupHeaderRoot: {
    display: "flex",
    alignItems: "center",
    position: "relative",
  },
  groupHeaderText: {
    p: 0,
    m: 0,
    fontSize: "sm",
    color: "text-secondary",
  },
  termWrapper: { display: "flex", gap: 1 },
  isAnySelectorRoot: {
    width: 72,
    display: "flex",
    alignItems: "start",
    fontSize: "sm",
  },
  isAnyText: { pl: 1 },
  popoverMenu: {
    width: 200,
  },
  filterGroup: {
    backgroundColor: "neutral-100",
    dark: { backgroundColor: "neutral-700" },
    display: "flex",
    flexDirection: "column",
    borderRadius: "xs",
    px: 1.5,
    pb: 1,
    gap: 1,
    "&.leaf": {
      backgroundColor: "neutral-200",
      dark: { backgroundColor: "neutral-600" },
    },
  },
  termsWrapper: {
    py: 1,
    gap: 1,
    display: "flex",
    flexDirection: "column",
  },
  noTermsText: {
    mt: 0,
    mb: 1,
    color: "text-secondary",
    fontSize: "sm",
  },
});

const opsByType = {
  string: [
    nodes.element("option", {
      props: { value: "'str_eq'" },
      children: "'is'",
    }),
    nodes.element("option", {
      props: { value: "'str_ne'" },
      children: "'is not'",
    }),
    nodes.element("option", {
      props: { value: "'str_contains'" },
      children: "'contains'",
    }),
    nodes.element("option", {
      props: { value: "'str_not_contains'" },
      children: "'does not contain'",
    }),
  ],
  number: [
    nodes.element("option", {
      props: { value: "'num_eq'" },
      children: "'='",
    }),
    nodes.element("option", {
      props: { value: "'num_ne'" },
      children: "'≠'",
    }),
    nodes.element("option", {
      props: { value: "'num_lt'" },
      children: "'<'",
    }),
    nodes.element("option", {
      props: { value: "'num_lte'" },
      children: "'≤'",
    }),
    nodes.element("option", {
      props: { value: "'num_gt'" },
      children: "'>'",
    }),
    nodes.element("option", {
      props: { value: "'num_gte'" },
      children: "'≥'",
    }),
  ],
  date: [
    nodes.element("option", {
      props: { value: "'date_eq'" },
      children: "'is'",
    }),
    nodes.element("option", {
      props: { value: "'date_ne'" },
      children: "'is not'",
    }),
    nodes.element("option", {
      props: { value: "'date_lt'" },
      children: "'is before'",
    }),
    nodes.element("option", {
      props: { value: "'date_lte'" },
      children: "'is on or before'",
    }),
    nodes.element("option", {
      props: { value: "'date_gt'" },
      children: "'is after'",
    }),
    nodes.element("option", {
      props: { value: "'date_gte'" },
      children: "'is on or after'",
    }),
  ],
  timestamp: [
    nodes.element("option", {
      props: { value: "'timestamp_eq'" },
      children: "'is'",
    }),
    nodes.element("option", {
      props: { value: "'timestamp_ne'" },
      children: "'is not'",
    }),
    nodes.element("option", {
      props: { value: "'timestamp_lt'" },
      children: "'is before'",
    }),
    nodes.element("option", {
      props: { value: "'timestamp_lte'" },
      children: "'is on or before'",
    }),
    nodes.element("option", {
      props: { value: "'timestamp_gt'" },
      children: "'is after'",
    }),
    nodes.element("option", {
      props: { value: "'timestamp_gte'" },
      children: "'is on or after'",
    }),
  ],
  enum: [
    nodes.element("option", {
      props: { value: "'enum_eq'" },
      children: "'is'",
    }),
    nodes.element("option", {
      props: { value: "'enum_ne'" },
      children: "'is not'",
    }),
  ],
  table: [
    nodes.element("option", {
      props: { value: "'fk_eq'" },
      children: "'is'",
    }),
    nodes.element("option", {
      props: { value: "'fk_ne'" },
      children: "'is not'",
    }),
  ],
  bool: [
    nodes.element("option", {
      props: { value: "'bool_eq'" },
      children: "'is'",
    }),
  ],
  minutes_duration: [
    nodes.element("option", {
      props: { value: "'minute_duration_eq'" },
      children: "'='",
    }),
    nodes.element("option", {
      props: { value: "'minute_duration_ne'" },
      children: "'≠'",
    }),
    nodes.element("option", {
      props: { value: "'minute_duration_lt'" },
      children: "'<'",
    }),
    nodes.element("option", {
      props: { value: "'minute_duration_lte'" },
      children: "'≤'",
    }),
    nodes.element("option", {
      props: { value: "'minute_duration_gt'" },
      children: "'>'",
    }),
    nodes.element("option", {
      props: { value: "'minute_duration_gte'" },
      children: "'≥'",
    }),
  ],
  enum_like_bool: [
    nodes.element("option", {
      props: { value: "'enum_like_bool_eq'" },
      children: "'is'",
    }),
  ],
};

const nullableOpts = [
  nodes.element("option", {
    props: { value: "'empty'" },
    children: "'is empty'",
  }),
  nodes.element("option", {
    props: { value: "'not_empty'" },
    children: "'is not empty'",
  }),
];

function typeSpecificOps(columns: SuperGridColumn[]): Node {
  interface TypeGenInfo {
    type: FilterType;
    notNull: boolean;
    columns: number[];
  }
  const genTypes: TypeGenInfo[] = [];
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (!column.filter || column.filter.type === "custom") {
      continue;
    }
    const prevInfo = genTypes.find((t) => eqFilterType(t.type, column.filter!));
    if (prevInfo) {
      prevInfo.columns.push(i);
      continue;
    }
    genTypes.push({
      type: column.filter,
      columns: [i],
      notNull: column.filter.notNull,
    });
  }
  genTypes.sort((a, b) => a.columns.length - b.columns.length);
  const switchCases: { condition: string; node: Node }[] = [];
  for (let i = 0; i < genTypes.length; i++) {
    const { columns, type, notNull } = genTypes[i];
    const caseExpr =
      i === genTypes.length - 1
        ? `true`
        : `${filterTermHelper.columnId} in (${columns.join(",")})`;
    const opts: Node[] = [];
    if (type.type !== "custom") {
      opts.push(opsByType[type.type]);
    }
    if (!notNull && type.type !== "enum_like_bool") {
      opts.push(nullableOpts);
    }
    switchCases.push({ condition: caseExpr, node: opts });
  }
  return nodes.switch(...switchCases);
}

const dateOptions = [
  nodes.element("option", {
    children: "'today'",
    props: { value: "'today'" },
  }),
  nodes.element("option", {
    children: "'tomorrow'",
    props: { value: "'tomorrow'" },
  }),
  nodes.element("option", {
    children: "'yesterday'",
    props: { value: "'yesterday'" },
  }),
  nodes.element("option", {
    children: "'week ago'",
    props: { value: "'week ago'" },
  }),
  nodes.element("option", {
    children: "'week from now'",
    props: { value: "'week from now'" },
  }),
  nodes.element("option", {
    children: "'month ago'",
    props: { value: "'month ago'" },
  }),
  nodes.element("option", {
    children: "'month from now'",
    props: { value: "'month from now'" },
  }),
  nodes.element("option", {
    children: "'number of days ago...'",
    props: { value: "'number of days ago'" },
  }),
  nodes.element("option", {
    children: "'number of days from now...'",
    props: { value: "'number of days from now'" },
  }),
  nodes.element("option", {
    children: "'exact date...'",
    props: { value: "'exact date'" },
  }),
];

function columnFilter(columns: SuperGridColumn[], dts: SuperGridDts) {
  const optGroups = new Map<string | undefined, Node[]>();
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.filterDisplayName) {
      let opts = optGroups.get(col.filterOptGroup);
      if (!opts) {
        opts = [];
        optGroups.set(col.filterOptGroup, opts);
      }
      opts.push(
        nodes.element("option", {
          props: { value: i.toString() },
          children: stringLiteral(col.filterDisplayName),
        })
      );
    }
  }
  const switchCases: { condition: string; node: Node }[] = [];
  if (columns.some((col) => col.filter?.type === "string")) {
    switchCases.push({
      condition: `rfn.is_string_filter_op(${filterTermHelper.op})`,
      node: filterTermHelper.debounceState(
        input({
          size: "sm",
          slots: {
            input: {
              props: { value: filterTermHelper.value1 },
              on: {
                input: (s) =>
                  s.statements(
                    filterTermHelper.setValue1(
                      `case when target_value = '' then null else target_value end`
                    ),
                    filterTermHelper.debounceInputTriggerRefresh
                  ),
                blur: filterTermHelper.debounceBlurHandler,
              },
            },
          },
        })
      ),
    });
  }
  if (columns.some((col) => col.filter?.type === "number")) {
    switchCases.push({
      condition: `rfn.is_number_filter_op(${filterTermHelper.op})`,
      node: filterTermHelper.debounceState(
        input({
          size: "sm",
          slots: {
            input: {
              props: { value: filterTermHelper.value1 },
              on: {
                input: (s) =>
                  s.if("literal.number(target_value) is not null", (s) =>
                    s.statements(
                      filterTermHelper.setValue1(`target_value`),
                      filterTermHelper.debounceInputTriggerRefresh
                    )
                  ),
                blur: filterTermHelper.debounceBlurHandler,
              },
            },
          },
        })
      ),
    });
  }
  if (columns.some((col) => col.filter?.type === "date")) {
    switchCases.push({
      condition: `rfn.is_date_filter_op(${filterTermHelper.op})`,
      node: [
        select({
          size: "sm",
          on: {
            input: (s) =>
              s.if(
                `${filterTermHelper.value1} is null or ${filterTermHelper.value1} != target_value`,
                (s) =>
                  s
                    .scalar(
                      `new_value_2`,
                      `case
                          when ${filterTermHelper.value1} = 'exact date' or target_value = 'exact date' then null
                          when (${filterTermHelper.value1} like 'number%') != (target_value like 'number%') then null
                          else ${filterTermHelper.value2}
                        end`
                    )
                    .statements(
                      filterTermHelper.setValue1("target_value"),
                      filterTermHelper.setValue2("new_value_2"),
                      dgState.triggerRefresh
                    )
              ),
          },
          slots: {
            select: {
              props: {
                value: `coalesce(${filterTermHelper.value1}, 'exact date')`,
              },
            },
          },
          children: dateOptions,
        }),
        nodes.switch(
          {
            condition: `${filterTermHelper.value1} in ('number of days ago', 'number of days from now')`,
            node: input({
              size: "sm",
              slots: {
                input: {
                  props: { value: filterTermHelper.value2 },
                  on: {
                    input: (s) =>
                      s.if(
                        "try_cast(target_value as int) is not null",
                        filterTermHelper.setValue2("target_value")
                      ),
                    blur: dgState.triggerRefresh,
                  },
                },
              },
            }),
          },
          {
            condition: `${filterTermHelper.value1} is null or ${filterTermHelper.value1} = 'exact date'`,
            node: input({
              size: "sm",
              slots: {
                input: {
                  props: { value: filterTermHelper.value2, type: "'date'" },
                  on: {
                    input: (s) =>
                      s.if("literal.date(target_value) is not null", (s) =>
                        s.statements(
                          filterTermHelper.setValue1("'exact date'"),
                          filterTermHelper.setValue2("target_value")
                        )
                      ),
                    blur: dgState.triggerRefresh,
                  },
                },
              },
            }),
          }
        ),
      ],
    });
  }
  if (columns.some((col) => col.filter?.type === "timestamp")) {
    switchCases.push({
      condition: `rfn.is_timestamp_filter_op(${filterTermHelper.op})`,
      node: [
        select({
          size: "sm",
          on: {
            input: (s) =>
              s.if(
                `${filterTermHelper.value1} is null or ${filterTermHelper.value1} != target_value`,
                (s) =>
                  s
                    .scalar(
                      `new_value_2`,
                      `case
                          when ${filterTermHelper.value1} = 'exact date' or target_value = 'exact date' then null
                          when (${filterTermHelper.value1} like 'number%') != (target_value like 'number%') then null
                          else ${filterTermHelper.value2}
                        end`
                    )
                    .statements(
                      filterTermHelper.setValue1("target_value"),
                      filterTermHelper.setValue2("new_value_2"),
                      dgState.triggerRefresh
                    )
              ),
          },
          slots: {
            select: {
              props: {
                value: `coalesce(${filterTermHelper.value1}, 'exact date')`,
              },
            },
          },
          children: dateOptions,
        }),
        nodes.switch(
          {
            condition: `${filterTermHelper.value1} in ('number of days ago', 'number of days from now')`,
            node: input({
              size: "sm",
              slots: {
                input: {
                  props: { value: filterTermHelper.value2 },
                  on: {
                    input: (s) =>
                      s.if(
                        "try_cast(target_value as int) is not null",
                        filterTermHelper.setValue2("target_value")
                      ),
                    blur: dgState.triggerRefresh,
                  },
                },
              },
            }),
          },
          {
            condition: `${filterTermHelper.value1} is null or ${filterTermHelper.value1} = 'exact date'`,
            node: input({
              size: "sm",
              slots: {
                input: {
                  props: {
                    value: `${filterTermHelper.value2}`,
                    type: "'date'",
                  },
                  on: {
                    input: (s) =>
                      s.if("literal.date(target_value) is not null", (s) =>
                        s.statements(
                          filterTermHelper.setValue1("'exact date'"),
                          filterTermHelper.setValue2("target_value")
                        )
                      ),
                    blur: dgState.triggerRefresh,
                  },
                },
              },
            }),
          }
        ),
      ],
    });
  }
  if (columns.some((col) => col.filter?.type === "enum")) {
    switchCases.push({
      condition: `rfn.is_enum_filter_op(${filterTermHelper.op})`,
      node: enumSelect(columns),
    });
  }
  if (columns.some((col) => col.filter?.type === "table")) {
    switchCases.push({
      condition: `rfn.is_fk_filter_op(${filterTermHelper.op})`,
      node: tableInput(columns),
    });
  }
  if (columns.some((col) => col.filter?.type === "bool")) {
    switchCases.push({
      condition: `${filterTermHelper.op} = 'bool_eq'`,
      node: nodes.element("div", {
        styles: styles.checkboxWrapper,
        children: checkbox({
          variant: "outlined",
          styles: styles.checkbox,
          checked: `${filterTermHelper.value1} = 'true'`,
          on: {
            checkboxChange: (s) =>
              s.statements(
                filterTermHelper.setValue1("cast(target_checked as string)"),
                dgState.triggerRefresh
              ),
          },
        }),
      }),
    });
  }
  if (columns.some((col) => col.filter?.type === "enum_like_bool")) {
    switchCases.push({
      condition: `${filterTermHelper.op} = 'enum_like_bool_eq'`,
      node: enumLikeBoolSelect(columns),
    });
  }
  if (columns.some((col) => col.filter?.type === "minutes_duration")) {
    switchCases.push({
      condition: `rfn.is_minute_duration_filter_op(${filterTermHelper.op})`,
      node: nodes.state({
        watch: [`coalesce(try_cast(${filterTermHelper.value1} as bigint), 0)`],
        procedure: (s) =>
          s.scalar(
            `value`,
            `coalesce(sfn.display_minutes_duration(try_cast(${filterTermHelper.value1} as bigint)), '')`
          ),
        children: durationInput({
          durationSize: "minutes",
          size: "sm",
          slots: { input: { props: { value: `value` } } },
          onChange: (value) => (s) =>
            s
              .setScalar(`value`, value)
              .statements(
                filterTermHelper.setValue1(
                  `sfn.parse_minutes_duration(${value})`
                ),
                dgState.triggerRefresh
              ),
        }),
      }),
    });
  }
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.filter?.type === "custom" && col.filter.node) {
      switchCases.push({
        condition: `${filterTermHelper.columnId} = ${i}`,
        node: col.filter.node(filterTermHelper, dgState),
      });
    }
  }
  const columnOptions: Node[] = [];
  if (optGroups.size === 1) {
    columnOptions.push(optGroups.values().next().value);
  } else {
    for (const [optGroup, opts] of optGroups.entries()) {
      if (optGroup) {
        columnOptions.push(
          nodes.element("optgroup", {
            props: { label: stringLiteral(optGroup) },
            children: opts,
          })
        );
      } else {
        columnOptions.push(...opts);
      }
    }
  }
  return [
    select({
      variant: "outlined",
      color: "neutral",
      size: "sm",
      on: {
        input: (s) =>
          s
            .scalar("new_id", "cast(target_value as int)")
            .if(`${filterTermHelper.columnId} != new_id`, (s) =>
              s
                .modify(
                  `update filter_term_record set column_id = new_id, op = rfn.${dts.idToDefaultOp}(new_id), value_1 = null, value_2 = null, value_3 = null`
                )
                .statements(dgState.triggerRefresh)
            ),
      },
      slots: { select: { props: { value: filterTermHelper.columnId } } },
      children: columnOptions,
    }),
    nodes.if(
      `${filterTermHelper.op} != 'custom'`,
      select({
        variant: "outlined",
        color: "neutral",
        size: "sm",
        on: {
          input: (s) =>
            s
              .scalar("new_op", "cast(target_value as enums.dg_filter_op)")
              .if(`${filterTermHelper.op} != new_op`, (s) =>
                s
                  .modify(
                    `update ui.filter_term set op = new_op where id = ${filterTermHelper.id}`
                  )
                  .statements(dgState.triggerRefresh)
              ),
        },
        slots: { select: { props: { value: filterTermHelper.op } } },
        children: typeSpecificOps(columns),
      })
    ),
    nodes.switch(...switchCases),
    iconButton({
      variant: "plain",
      color: "neutral",
      size: "sm",
      children: materialIcon("Delete"),
      on: {
        click: (s) =>
          s
            .modify(`delete from filter_term_record`)
            .statements(dgState.triggerRefresh),
      },
    }),
  ];
}

function enumLikeBoolSelect(columns: SuperGridColumn[]) {
  const cols = [];
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].filter?.type === "enum_like_bool") {
      cols.push(i);
    }
  }
  return select({
    variant: "outlined",
    color: "neutral",
    size: "sm",
    on: {
      input: (s) =>
        s.if(
          `${filterTermHelper.value1} is null or ${filterTermHelper.value1} != target_value`,
          (s) =>
            s.statements(
              filterTermHelper.setValue1("target_value"),
              dgState.triggerRefresh
            )
        ),
    },
    slots: { select: { props: { value: filterTermHelper.value1 } } },
    children: nodes.switch(
      ...cols.map((i) => {
        const col = columns[i];
        if (col.filter!.type !== "enum_like_bool") {
          throw new Error("impossible");
        }
        return {
          condition: `${filterTermHelper.columnId} = ${i}`,
          node: [
            nodes.element("option", {
              props: { value: `'true'` },
              children: stringLiteral(col.filter!.config.true),
            }),
            nodes.element("option", {
              props: { value: `'false'` },
              children: stringLiteral(col.filter!.config.false),
            }),
            col.filter!.config.null
              ? nodes.element("option", {
                  props: { value: `''` },
                  children: stringLiteral(col.filter!.config.null),
                })
              : null,
          ],
        };
      })
    ),
  });
}

function enumSelect(columns: SuperGridColumn[]) {
  const columnsByEnum: Record<string, number[]> = {};
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.filter?.type === "enum") {
      const enumName = column.filter.enum;
      if (!columnsByEnum[enumName]) {
        columnsByEnum[enumName] = [];
      }
      columnsByEnum[enumName].push(i);
    }
  }
  return select({
    variant: "outlined",
    color: "neutral",
    size: "sm",
    on: {
      input: (s) =>
        s.if(
          `${filterTermHelper.value1} is null or ${filterTermHelper.value1} != target_value`,
          (s) =>
            s.statements(
              filterTermHelper.setValue1("target_value"),
              dgState.triggerRefresh
            )
        ),
    },
    slots: { select: { props: { value: filterTermHelper.value1 } } },
    children: nodes.switch(
      ...Object.entries(columnsByEnum).map(([enumName, columns]) => {
        const opts = Object.values(app.enums[enumName].values).map((v) =>
          nodes.element("option", {
            children: stringLiteral(v.displayName),
            props: { value: stringLiteral(v.name) },
          })
        );
        return {
          condition: `${filterTermHelper.columnId} in (${columns.join(",")})`,
          node: opts,
        };
      })
    ),
  });
}

const filterIdPrefix = stringLiteral(getUniqueUiId());

function tableInput(columns: SuperGridColumn[]) {
  const columnsByTable: Record<string, number[]> = {};
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.filter?.type === "table") {
      const tableName = column.filter.table;
      if (!columnsByTable[tableName]) {
        columnsByTable[tableName] = [];
      }
      columnsByTable[tableName].push(i);
    }
  }
  return nodes.switch(
    ...Object.entries(columnsByTable).map(([tableName, columns]) => {
      return {
        condition: `${filterTermHelper.columnId} in (${columns.join(",")})`,
        node: getTableRecordSelect(tableName, {
          variant: "outlined",
          color: "neutral",
          size: "sm",
          id: `${filterIdPrefix} || '-' || ${filterTermHelper.id}`,
          onComboboxSelectValue: (id, label) => (s) =>
            s.if(
              `${filterTermHelper.value1} is null or ${filterTermHelper.value1} != cast(${id} as string) or ${id} is null`,
              (s) =>
                s.statements(
                  filterTermHelper.setValue1(`cast(${id} as string)`),
                  filterTermHelper.setValue2(label),
                  dgState.triggerRefresh
                )
            ),
          onSelectValue: (value) => (s) =>
            s.if(
              `${filterTermHelper.value1} is null or ${filterTermHelper.value1} != cast(${value} as string)`,
              (s) =>
                s.statements(
                  filterTermHelper.setValue1(`cast(${value} as string)`),
                  dgState.triggerRefresh
                )
            ),
          value: `cast(${filterTermHelper.value1} as bigint)`,
          initialInputText: `coalesce(${filterTermHelper.value2}, '')`,
        }),
      };
    })
  );
}

const groupBaseId = getUniqueUiId();

const isAnySelector = lazy(() => {
  const isAny = `case
    when filter_term_record.recursion_depth = 0
      then ui.root_filter_is_any
    else (select is_any from filter_term where id = filter_term_record.group) end`;
  return nodes.element("div", {
    styles: styles.isAnySelectorRoot,
    children: nodes.switch(
      {
        condition: `filter_term_record.iteration_index = 0`,
        node: nodes.element("span", {
          styles: styles.isAnyText,
          children: "'Where'",
        }),
      },
      {
        condition: `filter_term_record.iteration_index = 1`,
        node: select({
          variant: "outlined",
          color: "neutral",
          size: "sm",
          on: {
            input: (s) =>
              s
                .if({
                  condition: `filter_term_record.recursion_depth = 0`,
                  then: (s) =>
                    s.setScalar(
                      `ui.root_filter_is_any`,
                      `target_value= 'true'`
                    ),
                  else: (s) =>
                    s.modify(
                      `update filter_term set is_any = target_value= 'true' where id = filter_term_record.group`
                    ),
                })
                .setScalar(`ui.dg_refresh_key`, `ui.dg_refresh_key + 1`),
          },
          slots: { select: { props: { value: isAny } } },
          children: [
            nodes.element("option", {
              props: { value: "'false'" },
              children: "'and'",
            }),
            nodes.element("option", {
              props: { value: "'true'" },
              children: "'or'",
            }),
          ],
        }),
      },
      {
        condition: "true",
        node: nodes.element("span", {
          styles: styles.isAnyText,
          children: `case when ${isAny} then 'or' else 'and' end`,
        }),
      }
    ),
  });
});

export function filterPopover(columns: SuperGridColumn[], dts: SuperGridDts) {
  return [
    nodes.if({
      condition: `exists (select 1 from ui.filter_term)`,
      then: nodes.recursive({
        table: "filter_term",
        where: "group is null",
        key: "id",
        recordName: "filter_term_record",
        orderBy: "ordering",
        children: nodes.element("div", {
          styles: styles.termWrapper,
          children: [
            isAnySelector(),
            nodes.if({
              condition: `filter_term_record.is_any is null`,
              then: columnFilter(columns, dts),
              else: nodes.element("div", {
                styles: styles.filterGroup,
                dynamicClasses: [
                  {
                    condition: `filter_term_record.recursion_depth = 1`,
                    classes: "leaf",
                  },
                ],
                children: [
                  nodes.element("div", {
                    styles: styles.groupHeaderRoot,
                    children: [
                      nodes.element("p", {
                        styles: styles.groupHeaderText,
                        children: `case when filter_term_record.is_any then 'Any' else 'All' end || ' of the following are true...'`,
                      }),
                      nodes.element("div", { styles: flexGrowStyles }),
                      nodes.if({
                        condition: `filter_term_record.recursion_depth = 0`,
                        then: popoverMenu({
                          menuListOpts: {
                            styles: styles.popoverMenu,
                          },
                          id: `${stringLiteral(
                            groupBaseId
                          )} || '-' || filter_term_record.id`,
                          button: ({ buttonProps, onButtonClick }) =>
                            iconButton({
                              variant: "plain",
                              color: "neutral",
                              size: "sm",
                              props: buttonProps,
                              children: materialIcon("Add"),
                              on: { click: onButtonClick },
                            }),
                          items: [
                            {
                              onClick: insertFilter(
                                columns,
                                `filter_term_record.id`
                              ),
                              children: `'Add condition'`,
                            },
                            {
                              onClick: insertFilterGroup(
                                columns,
                                `filter_term_record.id`
                              ),
                              children: `'Add condition group'`,
                            },
                          ],
                        }),
                        else: iconButton({
                          variant: "plain",
                          color: "neutral",
                          size: "sm",
                          children: materialIcon("Add"),
                          on: {
                            click: insertFilter(
                              columns,
                              `filter_term_record.id`
                            ),
                          },
                        }),
                      }),
                      iconButton({
                        variant: "plain",
                        color: "neutral",
                        size: "sm",
                        children: materialIcon("Delete"),
                        on: {
                          click: (s) =>
                            s
                              .table(
                                "all_filters",
                                "select id from filter_term where group = filter_term_record.id union select filter_term_record.id"
                              )
                              .modify(
                                `delete from filter_term where id in (select id from all_filters) or group in (select id from all_filters)`
                              )
                              .statements(dgState.triggerRefresh),
                        },
                      }),
                    ],
                  }),
                  nodes.recurse("recurse_record.group = filter_term_record.id"),
                ],
              }),
            }),
          ],
        }),
      }),
      else: nodes.element("p", {
        styles: styles.noTermsText,
        children: "'No filters'",
      }),
    }),
    nodes.element("div", {
      styles: sharedStyles.popoverButtons,
      children: [
        button({
          variant: "outlined",
          color: "primary",
          size: "sm",
          children: "'Add condition'",
          on: {
            click: insertFilter(columns),
          },
        }),
        button({
          variant: "outlined",
          color: "primary",
          size: "sm",
          children: "'Add condition group'",
          on: {
            click: insertFilterGroup(columns),
          },
        }),
      ],
    }),
  ];
}

function insertFilter(columns: SuperGridColumn[], parentGroup?: string) {
  const ordering = `(select ordering.new(max(ordering)) from ui.filter_term where ${
    parentGroup ? `group = ${parentGroup}` : "group is null"
  })`;
  return new DomStatements()
    .modify(
      `insert into ui.filter_term (
        id,
        column_id,
        ${parentGroup ? "group," : ""}
        ordering,
        op
      )
        values
      (
        ui.next_filter_id,
        ${columns.findIndex((col) => Boolean(col.filter))},
        ${parentGroup ? parentGroup + "," : ""}
        ${ordering},
        ${stringLiteral(
          defaultOpForFieldType(columns.find((col) => col.filter)!.filter!)
        )}
      )`
    )
    .setScalar(`ui.next_filter_id`, `ui.next_filter_id + 1`);
}

function insertFilterGroup(columns: SuperGridColumn[], parentGroup?: string) {
  const groupOrdering = `(select ordering.new(max(ordering)) from ui.filter_term where ${
    parentGroup ? `group = ${parentGroup}` : "group is null"
  })`;
  return new DomStatements()
    .modify(
      `insert into ui.filter_term (
        id,
        ${parentGroup ? "group," : ""}
        ordering,
        is_any
      )
        values
      (
        ui.next_filter_id,
        ${parentGroup ? parentGroup + "," : ""}
        ${groupOrdering},
        true
      )`
    )
    .modify(
      `insert into ui.filter_term (group, id, ordering, column_id, op)
          values
        (
          ui.next_filter_id,
          ui.next_filter_id + 1,
          ordering.new(),
          ${columns.findIndex((col) => Boolean(col.filter))},
          'not_empty'
        )`
    )
    .setScalar(`ui.next_filter_id`, `ui.next_filter_id + 2`);
}

export class FilterTermHelper {
  id = "filter_term_record.id";
  columnId = "filter_term_record.column_id";
  op = "filter_term_record.op";
  value1 = "filter_term_record.value_1";
  value2 = "filter_term_record.value_2";
  value3 = "filter_term_record.value_3";

  setOp(value: yom.SqlExpression) {
    return new BasicStatements().modify(
      `update filter_term_record set op = ${value}`
    );
  }

  setColumnId(value: yom.SqlExpression) {
    return new BasicStatements().modify(
      `update filter_term_record set column_id = ${value}`
    );
  }

  setValue1(value: yom.SqlExpression) {
    return new BasicStatements().modify(
      `update filter_term_record set value_1 = ${value}`
    );
  }

  setValue2(value: yom.SqlExpression) {
    return new BasicStatements().modify(
      `update filter_term_record set value_2 = ${value}`
    );
  }

  setValue3(value: yom.SqlExpression) {
    return new BasicStatements().modify(
      `update filter_term_record set value_3 = ${value}`
    );
  }

  debounceState(children: Node) {
    return nodes.state({
      procedure: (s) =>
        s
          .scalar(`debounce_handle`, { type: "BigUint" })
          .scalar(`did_trigger_refresh`, `false`),
      children,
    });
  }

  get debounceInputTriggerRefresh() {
    return new DomStatements()
      .setScalar(`did_trigger_refresh`, `false`)
      .if("debounce_handle is not null", (s) => s.abortTask(`debounce_handle`))
      .spawn({
        detached: true,
        handleScalar: "task_handle",
        procedure: (s) =>
          s
            .delay(`500`)
            .statements(dgState.triggerRefresh)
            .setScalar(`did_trigger_refresh`, `true`)
            .setScalar(`debounce_handle`, `null`)
            .commitUiTreeChanges(),
      })
      .setScalar(`debounce_handle`, `task_handle`);
  }

  get debounceBlurHandler() {
    return new DomStatements()
      .if(`did_trigger_refresh`, (s) => s.return())
      .if("debounce_handle is not null", (s) =>
        s
          .abortTask(`debounce_handle`)
          .setScalar(`debounce_handle`, `null`)
          .statements(dgState.triggerRefresh)
      );
  }
}

export const filterTermHelper = new FilterTermHelper();
