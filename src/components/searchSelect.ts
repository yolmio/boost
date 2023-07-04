import { each, element, ifNode, mode, portal, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import {
  exit,
  getBoundingClientRect,
  if_,
  modify,
  preventDefault,
  record,
  scalar,
  setScalar,
  table,
} from "../procHelpers.js";
import { theme } from "../singleton.js";
import { Style, StyleObject } from "../styleTypes.js";
import { createStyles, cssVar, visibilityHidden } from "../styleUtils.js";
import { ClientProcStatement, StateStatement } from "../yom.js";
import {
  getUniqueUiId,
  mergeEls,
  SingleElementComponentOpts,
} from "./utils.js";
import { styles as iconButtonStyles } from "./iconButton.js";
import { input } from "./input.js";
import { listItemButton, styles as listStyles } from "./list.js";
import { materialIcon } from "./materialIcon.js";
import { svgIcon } from "./svgIcon.js";
import { Color, ComponentOpts, Size, Variant } from "./types.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { circularProgress } from "./circularProgress.js";

const styles = createStyles({
  root: { position: "relative" },
  arrowIconButton: (size: Size, color: Color) => [
    iconButtonStyles.root(size, "plain", color),
    {
      marginLeft: "calc(var(--input-padding-y) / 2)",
      marginRight: "calc(var(--input-decorator-child-offset) * -1)",
      "&.showing-list": {
        transform: `rotate(180deg)`,
      },
    },
  ],
  clearIconButton: (size: Size, color: Color) => [
    iconButtonStyles.root(size, "plain", color),
    {
      marginLeft: "calc(var(--input-padding-y) / 2)",

      "&.hide": {
        visibility: "hidden",
      },
    },
    ,
  ],
  listbox: (
    size: Size | undefined,
    variant: Variant,
    color: Color,
    isNested: boolean
  ): StyleObject => {
    const styles = listStyles.list(size, variant, color, isNested, "vertical");
    Object.assign(styles as any, {
      "--focus-outline-offset": `calc(${cssVar(`focus-thickness`)} * -1)`, // to prevent the focus outline from being cut by overflow
      "--list-radius": cssVar(`radius-sm`),
      "--list-item-sticky-top":
        "calc(var(--list-padding, var(--list-divider-gap)) * -1)", // negative amount of the List's padding block
      boxShadow: theme.shadow.md,
      overflow: "auto",
      maxHeight: "40vh",
      width: "100%",
      zIndex: 1300, // the same value as Material UI Menu. TODO: revisit the appropriate value later.
      "&:empty": {
        visibility: "hidden",
      },
    });
    if (variant === "outlined" || variant === "plain") {
      (styles as any).backgroundColor = cssVar(`palette-background-popup`);
    }
    (styles as any)["--list-item-sticky-background"] = (
      styles as any
    ).backgroundColor;
    return styles;
  },
  listboxItem: {
    "&[aria-selected='true']": {
      backgroundColor: "neutral-100",
      dark: {
        backgroundColor: "neutral-700",
      },
    },
  },
});

export interface QueryComboboxOpts extends ComponentOpts {
  id?: string;
  error?: string;

  loading?: string;
  immediateFocus?: boolean;
  styles?: Style;

  onSelect: (result: string) => ClientProcStatement[];
  onClear: ClientProcStatement[];
  onBlur: ClientProcStatement[];

  populateResultTable: (query: string, resultTable: string) => StateStatement[];

  initialInputText?: string;
}

function withComboboxState(opts: QueryComboboxOpts, children: Node) {
  return state({
    procedure: [
      scalar("showing_list", `false`),
      scalar("clicking_on_list", `false`),
      scalar(
        "input_focus_key",
        { type: "BigInt" },
        opts.immediateFocus ? `0` : `null`
      ),
      scalar(
        "query",
        { type: "String", maxLength: 2000 },
        opts.initialInputText ? `null` : `''`
      ),
      scalar("active_descendant", { type: "String", maxLength: 100 }),
      scalar(
        "last_valid_query",
        { type: "String", maxLength: 2000 },
        opts.initialInputText ? `null` : `''`
      ),
      scalar(`combobox_width`, "0"),
    ],
    children: state({
      watch: opts.initialInputText
        ? ["query", `showing_list`, opts.initialInputText]
        : ["query", `showing_list`],
      statusScalar: `combobox_query_status`,
      procedure: [
        table("result", [
          { name: "label", type: { type: "String", maxLength: 1000 } },
          { name: "index", type: { type: "BigInt" } },
          { name: "id", type: { type: "BigInt" } },
        ]),
        if_(`not showing_list`, [exit()]),
        ...opts.populateResultTable(
          opts.initialInputText
            ? `coalesce(query, ${opts.initialInputText}, '')`
            : `query`,
          `ui.result`
        ),
        scalar(`selected_index`, { type: "BigInt" }),
      ],
      children,
    }),
  });
}

const arrowIcon = svgIcon({
  children: element("path", { props: { d: "'M7 10l5 5 5-5z'" } }),
});

/**
 * Combobox that gets its data from a query, the query can also be dependent on the input in the textbox.
 *
 * The query can go to the database.
 */
export function queryCombobox(opts: QueryComboboxOpts) {
  const id = opts.id ?? stringLiteral(getUniqueUiId());
  const inputWrapperId = `${id} || '-input-wrapper'`;
  const listboxId = `${id} || '-listbox'`;
  const optionId = (itemId: string) => `${id} || '-opt-' || ${itemId}`;
  const doSelection = [
    record(
      `result`,
      `select id, index, label from ui.result where index = ui.selected_index`
    ),
    ...opts.onSelect(`result`),
    setScalar(`ui.showing_list`, `false`),
    setScalar(`ui.query`, `result.label`),
    setScalar(`ui.last_valid_query`, `result.label`),
    setScalar(`ui.active_descendant`, `null`),
    setScalar(`ui.input_focus_key`, `null`),
  ];
  const updateComboboxWidth = [
    getBoundingClientRect(inputWrapperId, `rect`),
    setScalar(`ui.combobox_width`, `rect.width`),
  ];
  const content = element("div", {
    styles: opts.styles ? [styles.root, opts.styles] : styles.root,
    children: [
      mode({
        render: "'immediate'",
        children: input({
          size: opts.size,
          color: opts.color,
          variant: opts.variant,
          error: opts.error,
          props: { id: inputWrapperId },
          slots: {
            input: {
              props: {
                id,
                "aria-autocomplete": `'list'`,
                "aria-haspopup": `'listbox'`,
                "aria-controls": listboxId,
                "aria-expanded": `showing_list`,
                "aria-activedescendant": `active_descendant`,
                type: `'text'`,
                spellCheck: `'false'`,
                autoComplete: `'off'`,
                autoCapitalize: `'off'`,
                role: `'combobox'`,
                value: opts.initialInputText
                  ? `coalesce(query, ${opts.initialInputText}, '')`
                  : `query`,
                yolmFocusKey: `input_focus_key`,
              },
              on: {
                input: [
                  setScalar("ui.query", "target_value"),
                  setScalar(`ui.showing_list`, `true`),
                  setScalar(`ui.active_descendant`, `null`),
                ],
                focus: [
                  setScalar("ui.showing_list", "true"),
                  ...updateComboboxWidth,
                ],
                blur: [
                  if_(
                    "not ui.clicking_on_list",
                    setScalar("ui.showing_list", "false")
                  ),
                  scalar(
                    `return_to`,
                    opts.initialInputText
                      ? `coalesce(${opts.initialInputText}, last_valid_query, '')`
                      : `coalesce(last_valid_query, '')`
                  ),
                  if_<ClientProcStatement>(
                    `ui.query is not null and ui.query != return_to`,
                    [setScalar(`ui.query`, `ui.last_valid_query`)]
                  ),
                ],
                keydown: [
                  if_(
                    `not ui.showing_list or event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
                    exit()
                  ),
                  if_(`event.key in ('Enter', 'Tab')`, [
                    if_(`ui.active_descendant is not null`, [
                      preventDefault(),
                      ...doSelection,
                    ]),
                    exit(),
                  ]),
                  if_(`event.key = 'ArrowDown'`, [
                    preventDefault(),
                    if_(`not exists (select index from ui.result)`, exit()),
                    setScalar(
                      `ui.selected_index`,
                      `case
                        when ui.selected_index is null or ui.selected_index = (select count(*) from ui.result) - 1
                            then 0
                        else ui.selected_index + 1
                    end`
                    ),
                    setScalar(
                      `ui.active_descendant`,
                      optionId(`ui.selected_index`)
                    ),
                    exit(),
                  ]),
                  if_(`event.key = 'ArrowUp'`, [
                    preventDefault(),
                    if_(`not exists (select index from ui.result)`, exit()),
                    setScalar(
                      `ui.selected_index`,
                      `case
                        when ui.selected_index is null or ui.selected_index = 0
                            then (select count(*) from ui.result)
                        else ui.selected_index - 1
                    end`
                    ),
                    setScalar(
                      `ui.active_descendant`,
                      optionId(`ui.selected_index`)
                    ),
                    exit(),
                  ]),
                  setScalar(`ui.active_descendant`, `null`),
                ],
              },
            },
          },
          endDecorator: [
            element("button", {
              styles: styles.clearIconButton(
                opts.size ?? "md",
                opts.color ?? "neutral"
              ),
              dynamicClasses: [
                {
                  classes: "hide",
                  condition: opts.initialInputText
                    ? `(${opts.initialInputText} is null or ${opts.initialInputText} = '') and (last_valid_query is null or ui.last_valid_query = '')`
                    : "last_valid_query is null or ui.last_valid_query = ''",
                },
              ],
              props: { tabIndex: `-1` },
              on: {
                click: [
                  setScalar(`ui.query`, `''`),
                  setScalar(`ui.last_valid_query`, `''`),
                  ...opts.onClear,
                  if_(
                    `not ui.showing_list`,
                    setScalar(
                      `ui.input_focus_key`,
                      `coalesce(ui.input_focus_key + 1, 0)`
                    )
                  ),
                ],
              },
              children: materialIcon({ fontSize: "md", name: "Clear" }),
            }),
            ifNode(
              opts.loading
                ? `${opts.loading} or combobox_query_status = 'fallback_triggered'`
                : `combobox_query_status = 'fallback_triggered'`,
              circularProgress({ size: "sm" })
            ),
            element("button", {
              styles: styles.arrowIconButton(
                opts.size ?? "md",
                opts.color ?? "neutral"
              ),
              dynamicClasses: [
                {
                  classes: "showing_list",
                  condition: "showing_list",
                },
              ],
              props: { tabIndex: `-1` },
              children: arrowIcon,
              on: {
                click: [
                  if_(`not ui.showing_list`, [
                    setScalar(
                      `ui.input_focus_key`,
                      `coalesce(ui.input_focus_key + 1, 0)`
                    ),
                    ...updateComboboxWidth,
                  ]),
                  setScalar(`ui.showing_list`, `not ui.showing_list`),
                ],
              },
            }),
          ],
        }),
      }),
      portal(
        comboboxListbox({
          anchorEl: inputWrapperId,
          props: { id: listboxId },
          style: { width: `ui.combobox_width || 'px'` },
          size: opts.size,
          children: each({
            table: "result",
            recordName: "record",
            key: "id",
            children: listItemButton({
              styles: styles.listboxItem,
              props: {
                id: optionId(`record.iteration_index`),
                role: `'option'`,
                "aria-selected": `record.iteration_index = selected_index`,
                tabIndex: `-1`,
              },
              on: {
                click: [
                  setScalar(`ui.selected_index`, `record.iteration_index `),
                  ...doSelection,
                ],
              },
              children: "record.label",
            }),
          }),
        })
      ),
    ],
  });
  return withComboboxState(opts, content);
}

export interface ComboboxListboxOpts
  extends ComponentOpts,
    SingleElementComponentOpts {
  anchorEl: string;
  children: Node;
}

export function comboboxListbox(opts: ComboboxListboxOpts) {
  const rootStyles = styles.listbox(
    opts.size,
    opts.variant ?? "plain",
    opts.color ?? "neutral",
    false
  );
  return mergeEls(
    {
      tag: "div",
      styles: rootStyles,
      props: {
        hidden: `not showing_list`,
        role: `'listbox'`,
      },
      floating: {
        anchorEl: opts.anchorEl,
        placement: `'bottom'`,
        strategy: `'absolute'`,
        offset: {
          mainAxis: `4`,
          crossAxis: `0`,
        },
        flip: {
          crossAxis: `false`,
          mainAxis: `true`,
        },
      },
      on: {
        mouseDown: [setScalar("ui.clicking_on_list", "true")],
        mouseUp: [setScalar("ui.clicking_on_list", "false")],
      },
      children: opts.children,
    },
    opts
  );
}
