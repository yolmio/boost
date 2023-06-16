import { each, element, ifNode, state, switchNode } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import {
  debugExpr,
  if_,
  modify,
  scalar,
  setScalar,
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { ClientProcStatement } from "../../yom.js";
import { button } from "../../components/button.js";
import { iconButton } from "../../components/iconButton.js";
import { input } from "../../components/input.js";
import { materialIcon } from "../../components/materialIcon.js";
import { popoverMenu } from "../../components/menu.js";
import { select } from "../../components/select.js";
import { getTableRecordSelect } from "../../components/tableRecordSelect.js";
import {
  defaultOpForFieldType,
  eqFilterType,
  FilterType,
} from "./superGrid.js";
import { triggerQueryRefresh } from "./baseDatagrid.js";
import { checkbox } from "../../components/checkbox.js";
import { durationInput } from "../../components/durationInput.js";
import { createStyles, flexGrowStyles } from "../../styleUtils.js";
import { divider } from "../../components/divider.js";
import { typography } from "../../components/typography.js";
import { styles as sharedStyles } from "./styles.js";
import { getUniqueUiId } from "../../components/utils.js";
import { SuperGridColumn, SuperGridDts } from "./superGrid.js";

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
  leafGroup: {
    backgroundColor: "neutral-200",
    dark: { backgroundColor: "neutral-600" },
    display: "flex",
    flexDirection: "column",
    borderRadius: "xs",
    px: 1.5,
    pb: 1,
    gap: 1,
  },
  rootGroup: {
    backgroundColor: "neutral-100",
    dark: { backgroundColor: "neutral-700" },
    display: "flex",
    flexDirection: "column",
    borderRadius: "xs",
    px: 1.5,
    pb: 1,
    gap: 1,
  },
  termsWrapper: {
    py: 1,
    gap: 1,
    display: "flex",
    flexDirection: "column",
  },
});

function typeSpecificOps(columns: SuperGridColumn[], filterTerm: string): Node {
  interface TypeGenInfo {
    type: FilterType;
    notNull: boolean;
    columns: number[];
  }
  const genTypes: TypeGenInfo[] = [];
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (!column.filter) {
      continue;
    }
    const prevInfo = genTypes.find(
      (t) =>
        t.notNull === column.filter!.notNull &&
        eqFilterType(t.type, column.filter!.type)
    );
    if (prevInfo) {
      prevInfo.columns.push(i);
      continue;
    }
    genTypes.push({
      type: column.filter.type,
      columns: [i],
      notNull: column.filter.notNull,
    });
  }
  genTypes.sort((a, b) => a.columns.length - b.columns.length);
  const switchCases: [string, Node][] = [];
  for (let i = 0; i < genTypes.length; i++) {
    const { columns, type, notNull } = genTypes[i];
    const caseExpr =
      i === genTypes.length - 1
        ? `true`
        : `${filterTerm}.column_id in (${columns.join(",")})`;
    const opts: Node[] = [];
    switch (type.type) {
      case "string":
        opts.push(
          element("option", {
            props: { value: "'str_eq'" },
            children: "'is'",
          }),
          element("option", {
            props: { value: "'str_ne'" },
            children: "'is not'",
          }),
          element("option", {
            props: { value: "'str_contains'" },
            children: "'contains'",
          }),
          element("option", {
            props: { value: "'str_not_contains'" },
            children: "'does not contain'",
          })
        );
        break;
      case "number":
        opts.push(
          element("option", {
            props: { value: "'num_eq'" },
            children: "'='",
          }),
          element("option", {
            props: { value: "'num_ne'" },
            children: "'≠'",
          }),
          element("option", {
            props: { value: "'num_lt'" },
            children: "'<'",
          }),
          element("option", {
            props: { value: "'num_lte'" },
            children: "'≤'",
          }),
          element("option", {
            props: { value: "'num_gt'" },
            children: "'>'",
          }),
          element("option", {
            props: { value: "'num_gte'" },
            children: "'≥'",
          })
        );
        break;
      case "date":
        opts.push(
          element("option", {
            props: { value: "'date_eq'" },
            children: "'is'",
          }),
          element("option", {
            props: { value: "'date_ne'" },
            children: "'is not'",
          }),
          element("option", {
            props: { value: "'date_lt'" },
            children: "'is before'",
          }),
          element("option", {
            props: { value: "'date_lte'" },
            children: "'is on or before'",
          }),
          element("option", {
            props: { value: "'date_gt'" },
            children: "'is after'",
          }),
          element("option", {
            props: { value: "'date_gte'" },
            children: "'is on or after'",
          })
        );
        break;
      case "enum":
        opts.push(
          element("option", {
            props: { value: "'enum_eq'" },
            children: "'is'",
          }),
          element("option", {
            props: { value: "'enum_ne'" },
            children: "'is not'",
          })
        );
        break;
      case "table":
        opts.push(
          element("option", {
            props: { value: "'fk_eq'" },
            children: "'is'",
          }),
          element("option", {
            props: { value: "'fk_ne'" },
            children: "'is not'",
          })
        );
        break;
      case "bool":
        opts.push(
          element("option", {
            props: { value: "'bool_eq'" },
            children: "'is'",
          })
        );
        break;
      case "enum_like_bool":
        opts.push(
          element("option", {
            props: { value: "'enum_like_bool_eq'" },
            children: "'is'",
          })
        );
        break;
      case "duration":
        opts.push(
          element("option", {
            props: { value: "'minute_duration_eq'" },
            children: "'='",
          }),
          element("option", {
            props: { value: "'minute_duration_ne'" },
            children: "'≠'",
          }),
          element("option", {
            props: { value: "'minute_duration_lt'" },
            children: "'<'",
          }),
          element("option", {
            props: { value: "'minute_duration_lte'" },
            children: "'≤'",
          }),
          element("option", {
            props: { value: "'minute_duration_gt'" },
            children: "'>'",
          }),
          element("option", {
            props: { value: "'minute_duration_gte'" },
            children: "'≥'",
          })
        );
        break;
      default:
        throw new Error("ahhh");
    }
    if (notNull && type.type !== "enum_like_bool") {
      opts.push(
        element("option", {
          props: { value: "'empty'" },
          children: "'is empty'",
        })
      );
      opts.push(
        element("option", {
          props: { value: "'not_empty'" },
          children: "'is not empty'",
        })
      );
    }
    switchCases.push([caseExpr, opts]);
  }
  return switchNode(...switchCases);
}

const dateOptions = [
  element("option", {
    children: "'today'",
    props: { value: "'today'" },
  }),
  element("option", {
    children: "'tomorrow'",
    props: { value: "'tomorrow'" },
  }),
  element("option", {
    children: "'yesterday'",
    props: { value: "'yesterday'" },
  }),
  element("option", {
    children: "'week ago'",
    props: { value: "'week ago'" },
  }),
  element("option", {
    children: "'week from now'",
    props: { value: "'week from now'" },
  }),
  element("option", {
    children: "'month ago'",
    props: { value: "'month ago'" },
  }),
  element("option", {
    children: "'month from now'",
    props: { value: "'month from now'" },
  }),
  element("option", {
    children: "'number of days ago...'",
    props: { value: "'number of days ago'" },
  }),
  element("option", {
    children: "'number of days from now...'",
    props: { value: "'number of days from now'" },
  }),
  element("option", {
    children: "'exact date...'",
    props: { value: "'exact date'" },
  }),
];

function columnFilter(
  filterTerm: string,
  columns: SuperGridColumn[],
  dts: SuperGridDts
) {
  const options: Node[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.displayName) {
      options.push(
        element("option", {
          props: { value: i.toString() },
          children: stringLiteral(col.displayName!),
        })
      );
    }
  }
  const switchCases: [string, Node][] = [];
  if (columns.some((col) => col.filter?.type?.type === "string")) {
    switchCases.push([
      `dt.is_string_filter_op(${filterTerm}.op)`,
      input({
        size: "sm",
        slots: {
          input: {
            props: { value: `${filterTerm}.value_1` },
            on: {
              input: [
                modify(
                  `update ui.filter_term set value_1 = target_value where id = ${filterTerm}.id`
                ),
              ],
              blur: [triggerQueryRefresh()],
            },
          },
        },
      }),
    ]);
  }
  if (columns.some((col) => col.filter?.type?.type === "number")) {
    switchCases.push([
      `dt.is_number_filter_op(${filterTerm}.op)`,
      input({
        size: "sm",
        slots: {
          input: {
            props: { value: `${filterTerm}.value_1` },
            on: {
              input: [
                if_("literal.number(target_value) is not null", [
                  modify(
                    `update ui.filter_term set value_1 = target_value where id = ${filterTerm}.id`
                  ),
                ]),
              ],
              blur: [triggerQueryRefresh()],
            },
          },
        },
      }),
    ]);
  }
  if (columns.some((col) => col.filter?.type?.type === "date")) {
    switchCases.push([
      `dt.is_date_filter_op(${filterTerm}.op)`,
      [
        select({
          size: "sm",
          on: {
            input: [
              if_(
                `${filterTerm}.value_1 is null or ${filterTerm}.value_1 != target_value`,
                [
                  scalar(
                    `new_value_2`,
                    `case
                          when ${filterTerm}.value_1 = 'exact date' or target_value = 'exact date' then null
                          when (${filterTerm}.value_1 like 'number%') != (target_value like 'number%') then null
                          else ${filterTerm}.value_2
                        end`
                  ),
                  modify(
                    `update ui.filter_term set value_1 = target_value, value_2 = new_value_2 where id = ${filterTerm}.id`
                  ),
                  triggerQueryRefresh(),
                ]
              ),
            ],
          },
          slots: {
            select: {
              props: {
                value: `coalesce(${filterTerm}.value_1, 'exact date')`,
              },
            },
          },
          children: dateOptions,
        }),
        switchNode(
          [
            `${filterTerm}.value_1 in ('number of days ago', 'number of days from now')`,
            input({
              size: "sm",
              slots: {
                input: {
                  props: { value: `${filterTerm}.value_2` },
                  on: {
                    input: [
                      if_("try_cast(target_value as int) is not null", [
                        modify(
                          `update ui.filter_term set value_2 = target_value where id = ${filterTerm}.id`
                        ),
                      ]),
                    ],
                    blur: [triggerQueryRefresh()],
                  },
                },
              },
            }),
          ],
          [
            `${filterTerm}.value_1 is null or ${filterTerm}.value_1 = 'exact date'`,
            input({
              size: "sm",
              slots: {
                input: {
                  props: { value: `${filterTerm}.value_2`, type: "'date'" },
                  on: {
                    input: [
                      if_("literal.date(target_value) is not null", [
                        modify(
                          `update ui.filter_term set value_1 = 'exact date', value_2 = target_value where id = ${filterTerm}.id`
                        ),
                      ]),
                    ],
                    blur: [triggerQueryRefresh()],
                  },
                },
              },
            }),
          ]
        ),
      ],
    ]);
  }
  if (columns.some((col) => col.filter?.type?.type === "enum")) {
    switchCases.push([
      `dt.is_enum_filter_op(${filterTerm}.op)`,
      enumSelect(filterTerm, columns),
    ]);
  }
  if (columns.some((col) => col.filter?.type?.type === "table")) {
    switchCases.push([
      `dt.is_fk_filter_op(${filterTerm}.op)`,
      tableInput(filterTerm, columns),
    ]);
  }
  if (columns.some((col) => col.filter?.type?.type === "bool")) {
    switchCases.push([
      `${filterTerm}.op = 'bool_eq'`,
      element("div", {
        styles: styles.checkboxWrapper,
        children: checkbox({
          variant: "outlined",
          styles: styles.checkbox,
          checked: `${filterTerm}.value_1 = 'true'`,
          on: {
            checkboxChange: [
              modify(
                `update ui.filter_term set value_1 = cast(target_checked as string) where id = ${filterTerm}.id`
              ),
              triggerQueryRefresh(),
            ],
          },
        }),
      }),
    ]);
  }
  if (columns.some((col) => col.filter?.type?.type === "enum_like_bool")) {
    switchCases.push([
      `${filterTerm}.op = 'enum_like_bool_eq'`,
      enumLikeBoolSelect(filterTerm, columns),
    ]);
  }
  if (columns.some((col) => col.filter?.type?.type === "duration")) {
    switchCases.push([
      `dt.is_minute_duration_filter_op(${filterTerm}.op)`,
      state({
        watch: [`coalesce(try_cast(${filterTerm}.value_1 as bigint), 0)`],
        procedure: [
          scalar(
            `value`,
            `coalesce(sfn.display_minutes_duration(try_cast(${filterTerm}.value_1 as bigint)), '')`
          ),
        ],
        children: durationInput({
          durationSize: "minutes",
          size: "sm",
          slots: { input: { props: { value: `value` } } },
          onChange: (value) => [
            debugExpr(value),
            setScalar(`value`, value),
            modify(
              `update ui.filter_term set value_1 = sfn.parse_minutes_duration(${value}) where id = ${filterTerm}.id`
            ),
            triggerQueryRefresh(),
          ],
        }),
      }),
    ]);
  }
  return [
    select({
      variant: "outlined",
      color: "neutral",
      size: "sm",
      on: {
        input: [
          scalar("new_id", "cast(target_value as int)"),
          if_(`${filterTerm}.column_id != new_id`, [
            modify(
              `update ui.filter_term set column_id = new_id, op = dt.${dts.idToDefaultOp}(new_id), value_1 = null, value_2 = null, value_3 = null where id = ${filterTerm}.id`
            ),
            triggerQueryRefresh(),
          ]),
        ],
      },
      slots: { select: { props: { value: `${filterTerm}.column_id` } } },
      children: options,
    }),
    select({
      variant: "outlined",
      color: "neutral",
      size: "sm",
      on: {
        input: [
          scalar("new_op", "cast(target_value as enums.dg_filter_op)"),
          if_(`${filterTerm}.op != new_op`, [
            modify(
              `update ui.filter_term set op = new_op where id = ${filterTerm}.id`
            ),
            triggerQueryRefresh(),
          ]),
        ],
      },
      slots: { select: { props: { value: `${filterTerm}.op` } } },
      children: typeSpecificOps(columns, filterTerm),
    }),
    switchNode(...switchCases),
    iconButton({
      variant: "plain",
      color: "neutral",
      size: "sm",
      children: materialIcon("Delete"),
      on: {
        click: [
          modify(`delete from ui.filter_term where id = ${filterTerm}.id`),
          triggerQueryRefresh(),
        ],
      },
    }),
  ];
}

function enumLikeBoolSelect(filterTerm: string, columns: SuperGridColumn[]) {
  const cols = [];
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].filter?.type?.type === "enum_like_bool") {
      cols.push(i);
    }
  }
  return select({
    variant: "outlined",
    color: "neutral",
    size: "sm",
    on: {
      input: [
        if_(
          `${filterTerm}.value_1 is null or ${filterTerm}.value_1 != target_value`,
          [
            modify(
              `update ui.filter_term set value_1 = target_value where id = ${filterTerm}.id`
            ),
            triggerQueryRefresh(),
          ]
        ),
      ],
    },
    slots: { select: { props: { value: `${filterTerm}.value_1` } } },
    children: switchNode(
      ...cols.map((i) => {
        const col = columns[i];
        if (col.filter!.type.type !== "enum_like_bool") {
          throw new Error("impossible");
        }
        return [
          `${filterTerm}.column_id = ${i}`,
          [
            element("option", {
              props: { value: `'true'` },
              children: stringLiteral(col.filter!.type.config.true),
            }),
            element("option", {
              props: { value: `'false'` },
              children: stringLiteral(col.filter!.type.config.false),
            }),
            col.filter!.type.config.null
              ? element("option", {
                  props: { value: `''` },
                  children: stringLiteral(col.filter!.type.config.null),
                })
              : null,
          ],
        ] as [string, Node];
      })
    ),
  });
}

function enumSelect(filterTerm: string, columns: SuperGridColumn[]) {
  const columnsByEnum: Record<string, number[]> = {};
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.filter?.type?.type === "enum") {
      const enumName = column.filter.type.enum;
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
      input: [
        if_(
          `${filterTerm}.value_1 is null or ${filterTerm}.value_1 != target_value`,
          [
            modify(
              `update ui.filter_term set value_1 = target_value where id = ${filterTerm}.id`
            ),
            triggerQueryRefresh(),
          ]
        ),
      ],
    },
    slots: { select: { props: { value: `${filterTerm}.value_1` } } },
    children: switchNode(
      ...Object.entries(columnsByEnum).map(([enumName, columns]) => {
        const opts = model.enums[enumName].values.map((v) =>
          element("option", {
            children: stringLiteral(v.name.displayName),
            props: { value: stringLiteral(v.name.name) },
          })
        );
        return [`${filterTerm}.column_id in (${columns.join(",")})`, opts] as [
          string,
          Node
        ];
      })
    ),
  });
}

const filterIdPrefix = stringLiteral(getUniqueUiId());

function tableInput(filterTerm: string, columns: SuperGridColumn[]) {
  const columnsByTable: Record<string, number[]> = {};
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.filter?.type?.type === "table") {
      const tableName = column.filter.type.table;
      if (!columnsByTable[tableName]) {
        columnsByTable[tableName] = [];
      }
      columnsByTable[tableName].push(i);
    }
  }
  return switchNode(
    ...Object.entries(columnsByTable).map(([tableName, columns]) => {
      return [
        `${filterTerm}.column_id in (${columns.join(",")})`,
        getTableRecordSelect(tableName, {
          variant: "outlined",
          color: "neutral",
          size: "sm",
          id: `${filterIdPrefix} || '-' || ${filterTerm}.id`,
          onComboboxSelectValue: (id, label) => [
            if_(
              `${filterTerm}.value_1 is null or ${filterTerm}.value_1 != cast(${id} as string) or ${id} is null`,
              [
                modify(
                  `update ui.filter_term set value_1 = cast(${id} as string), value_2 = ${label} where id = ${filterTerm}.id`
                ),
                triggerQueryRefresh(),
              ]
            ),
          ],
          onSelectValue: (value) => [
            if_(
              `${filterTerm}.value_1 is null or ${filterTerm}.value_1 != cast(${value} as string)`,
              [
                modify(
                  `update ui.filter_term set value_1 = cast(${value} as string) where id = ${filterTerm}.id`
                ),
                triggerQueryRefresh(),
              ]
            ),
          ],
          value: `cast(${filterTerm}.value_1 as bigint)`,
          initialInputText: `coalesce(${filterTerm}.value_2, '')`,
        }),
      ] as [string, Node];
    })
  );
}

function groupHeader(filterTerm: string, addButton: Node) {
  return element("div", {
    styles: styles.groupHeaderRoot,
    children: [
      element("p", {
        styles: styles.groupHeaderText,
        children: `case when ${filterTerm}.is_any then 'Any' else 'All' end || ' of the following are true...'`,
      }),
      element("div", { styles: flexGrowStyles }),
      addButton,
      iconButton({
        variant: "plain",
        color: "neutral",
        size: "sm",
        children: materialIcon("Delete"),
        on: {
          click: [
            modify(`delete from ui.filter_term where id = ${filterTerm}.id`),
            triggerQueryRefresh(),
          ],
        },
      }),
    ],
  });
}

function termWrapper(children: Node) {
  return element("div", {
    styles: styles.termWrapper,
    children,
  });
}

function isAnySelector({
  isAny,
  setIsAny,
  iterIdx,
}: {
  isAny: string;
  setIsAny: (v: string) => ClientProcStatement;
  iterIdx: string;
}) {
  return element("div", {
    styles: styles.isAnySelectorRoot,
    children: switchNode(
      [
        `${iterIdx} = 0`,
        element("span", {
          styles: styles.isAnyText,
          children: "'Where'",
        }),
      ],
      [
        `${iterIdx} = 1`,
        select({
          variant: "outlined",
          color: "neutral",
          size: "sm",
          on: {
            input: [setIsAny(`target_value= 'true'`), triggerQueryRefresh()],
          },
          slots: { select: { props: { value: isAny } } },
          children: [
            element("option", {
              props: { value: "'false'" },
              children: "'and'",
            }),
            element("option", {
              props: { value: "'true'" },
              children: "'or'",
            }),
          ],
        }),
      ],
      [
        "true",
        element("span", {
          styles: styles.isAnyText,
          children: `case when ${isAny} then 'or' else 'and' end`,
        }),
      ]
    ),
  });
}

const groupBaseId = getUniqueUiId();

export function filterPopover(columns: SuperGridColumn[], dts: SuperGridDts) {
  const rootGroupHeader = groupHeader(
    "root_filter_term",
    popoverMenu({
      menuListOpts: {
        styles: styles.popoverMenu,
      },
      id: `${stringLiteral(groupBaseId)} || '-' || root_filter_term.id`,
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
          onClick: insertFilter(columns, `root_filter_term.id`),
          children: `'Add condition'`,
        },
        {
          onClick: insertFilterGroup(columns, `root_filter_term.id`),
          children: `'Add condition group'`,
        },
      ],
    })
  );
  const leafGroupHeader = groupHeader(
    `sub_filter_term`,
    iconButton({
      variant: "plain",
      color: "neutral",
      size: "sm",
      children: materialIcon("Add"),
      on: {
        click: insertFilter(columns, `sub_filter_term.id`),
      },
    })
  );
  const leafGroup = element("div", {
    styles: styles.leafGroup,
    children: [
      leafGroupHeader,
      each({
        table: "filter_term",
        where: "group = sub_filter_term.id",
        key: "id",
        recordName: "leaf_filter_term",
        orderBy: "ordering",
        children: termWrapper([
          isAnySelector({
            isAny: `sub_filter_term.is_any`,
            iterIdx: `leaf_filter_term.iteration_index`,
            setIsAny: (e) =>
              modify(
                `update ui.filter_term set is_any = ${e} where id = sub_filter_term.id`
              ),
          }),
          columnFilter(`leaf_filter_term`, columns, dts),
        ]),
      }),
    ],
  });
  const rootGroup = element("div", {
    styles: styles.rootGroup,
    children: [
      rootGroupHeader,
      each({
        table: "filter_term",
        where: "group = root_filter_term.id",
        key: "id",
        recordName: "sub_filter_term",
        orderBy: "ordering",
        children: termWrapper([
          isAnySelector({
            isAny: `root_filter_term.is_any`,
            iterIdx: `sub_filter_term.iteration_index`,
            setIsAny: (e) =>
              modify(
                `update ui.filter_term set is_any = ${e} where id = root_filter_term.id`
              ),
          }),
          ifNode(
            `sub_filter_term.is_any is not null`,
            leafGroup,
            columnFilter(`sub_filter_term`, columns, dts)
          ),
        ]),
      }),
    ],
  });
  return [
    typography({
      level: "body2",
      children: `'Filter'`,
    }),
    divider({ styles: sharedStyles.popoverDivider }),
    element("div", {
      styles: styles.termsWrapper,
      children: each({
        table: "filter_term",
        where: "group is null",
        key: "id",
        recordName: "root_filter_term",
        orderBy: "ordering",
        children: termWrapper([
          isAnySelector({
            isAny: `ui.root_filter_is_any`,
            iterIdx: `root_filter_term.iteration_index`,
            setIsAny: (v) => setScalar(`ui.root_filter_is_any`, v),
          }),
          ifNode(
            `root_filter_term.is_any is not null`,
            rootGroup,
            columnFilter(`root_filter_term`, columns, dts)
          ),
        ]),
      }),
    }),
    element("div", {
      styles: sharedStyles.popoverButtons,
      children: [
        button({
          variant: "outlined",
          color: "info",
          size: "sm",
          children: "'Add condition'",
          on: {
            click: insertFilter(columns),
          },
        }),
        button({
          variant: "outlined",
          color: "info",
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
  return [
    modify(
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
          defaultOpForFieldType(columns.find((col) => col.filter)!.filter!.type)
        )}
      )`
    ),
    setScalar(`ui.next_filter_id`, `ui.next_filter_id + 1`),
  ];
}

function insertFilterGroup(
  columns: SuperGridColumn[],
  parentGroup?: string
): ClientProcStatement[] {
  const groupOrdering = `(select ordering.new(max(ordering)) from ui.filter_term where ${
    parentGroup ? `group = ${parentGroup}` : "group is null"
  })`;
  return [
    modify(
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
    ),
    modify(
      `insert into ui.filter_term (group, id, ordering, column_id, op)
          values
        (
          ui.next_filter_id,
          ui.next_filter_id + 1,
          ordering.new(),
          ${columns.findIndex((col) => Boolean(col.filter))},
          'not_empty'
        )`
    ),
    setScalar(`ui.next_filter_id`, `ui.next_filter_id + 2`),
  ];
}
