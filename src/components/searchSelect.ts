import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { Style, StyleObject } from "../styleTypes";
import { createStyles, cssVar } from "../styleUtils";
import { getUniqueUiId, mergeEls, SingleElementComponentOpts } from "./utils";
import { styles as iconButtonStyles } from "./iconButton";
import { input } from "./input";
import { listItemButton, styles as listStyles } from "./list";
import { materialIcon } from "./materialIcon";
import { svgIcon } from "./svgIcon";
import { Color, ComponentOpts, Size, Variant } from "./types";
import { stringLiteral } from "../utils/sqlHelpers";
import { circularProgress } from "./circularProgress";
import {
  DomStatements,
  DomStatementsOrFn,
  StateStatementsOrFn,
} from "../statements";
import * as yom from "../yom";
import { lazyPerApp } from "../utils/memoize";

const styles = createStyles({
  root: { position: "relative" },
  arrowIconButton: (_, size: Size, color: Color) => [
    iconButtonStyles.root(size, "plain", color),
    {
      marginLeft: "calc(var(--input-padding-y) / 2)",
      marginRight: "calc(var(--input-decorator-child-offset) * -1)",
      "&.showing-list": {
        transform: `rotate(180deg)`,
      },
    },
  ],
  clearIconButton: (_, size: Size, color: Color) => [
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
    _,
    size: Size | undefined,
    variant: Variant,
    color: Color,
    isNested: boolean,
  ): StyleObject => {
    const styles = listStyles.list(size, variant, color, isNested, "vertical");
    Object.assign(styles as any, {
      "--focus-outline-offset": `calc(${cssVar(`focus-thickness`)} * -1)`, // to prevent the focus outline from being cut by overflow
      "--list-radius": cssVar(`radius-sm`),
      "--list-item-sticky-top":
        "calc(var(--list-padding, var(--list-divider-gap)) * -1)", // negative amount of the List's padding block
      boxShadow: "md",
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

  loading?: yom.SqlExpression;
  immediateFocus?: boolean;
  styles?: Style;

  onSelect: (result: string) => DomStatementsOrFn;
  onClear: DomStatementsOrFn;
  onBlur: DomStatementsOrFn;

  populateResultTable: (
    query: string,
    resultTable: string,
  ) => StateStatementsOrFn;

  initialInputText?: string;
}

function withComboboxState(opts: QueryComboboxOpts, children: Node) {
  return nodes.state({
    procedure: (s) =>
      s
        .scalar("showing_list", `false`)
        .scalar("clicking_on_list", `false`)
        .scalar(
          "input_focus_key",
          { type: "BigInt" },
          opts.immediateFocus ? `0` : `null`,
        )
        .scalar(
          "query",
          { type: "String", maxLength: 2000 },
          opts.initialInputText ? `null` : `''`,
        )
        .scalar("active_descendant", { type: "String", maxLength: 100 })
        .scalar(
          "last_valid_query",
          { type: "String", maxLength: 2000 },
          opts.initialInputText ? `null` : `''`,
        )
        .scalar(`combobox_width`, "0"),
    children: nodes.state({
      watch: opts.initialInputText
        ? ["query", `showing_list`, opts.initialInputText]
        : ["query", `showing_list`],
      statusScalar: `combobox_query_status`,
      procedure: (s) =>
        s
          .table("result", [
            { name: "label", type: { type: "String", maxLength: 1000 } },
            { name: "index", type: { type: "BigInt" } },
            { name: "id", type: { type: "BigInt" } },
          ])
          .if(`not showing_list`, (s) => s.return())
          .statements(
            opts.populateResultTable(
              opts.initialInputText
                ? `coalesce(query, ${opts.initialInputText}, '')`
                : `query`,
              `ui.result`,
            ),
          )
          .scalar(`selected_index`, { type: "BigInt" }),
      children,
    }),
  });
}

const arrowIcon = lazyPerApp(() =>
  svgIcon({
    children: nodes.element("path", { props: { d: "'M7 10l5 5 5-5z'" } }),
  }),
);

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
  const doSelection = new DomStatements()
    .record(
      `result`,
      `select id, index, label from ui.result where index = ui.selected_index`,
    )
    .statements(opts.onSelect(`result`))
    .setScalar(`ui.showing_list`, `false`)
    .setScalar(`ui.query`, `result.label`)
    .setScalar(`ui.last_valid_query`, `result.label`)
    .setScalar(`ui.active_descendant`, `null`)
    .setScalar(`ui.input_focus_key`, `null`);
  const updateComboboxWidth = new DomStatements()
    .getBoundingClientRect(inputWrapperId, `rect`)
    .setScalar(`ui.combobox_width`, `rect.width`);
  const content = nodes.element("div", {
    styles: opts.styles ? [styles.root, opts.styles] : styles.root,
    children: [
      nodes.mode({
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
                input: (s) =>
                  s
                    .setScalar("ui.query", "target_value")
                    .setScalar(`ui.showing_list`, `true`)
                    .setScalar(`ui.active_descendant`, `null`),
                focus: (s) =>
                  s
                    .if(`ui.showing_list`, (s) =>
                      s.triggerViewTransition("next_not_immediate"),
                    )
                    .setScalar("ui.showing_list", "true")
                    .statements(updateComboboxWidth),
                blur: (s) =>
                  s
                    .if(`clicking_on_list`, (s) => s.return())
                    .setScalar("ui.showing_list", "false")
                    .scalar(
                      `return_to`,
                      opts.initialInputText
                        ? `coalesce(${opts.initialInputText}, last_valid_query, '')`
                        : `coalesce(last_valid_query, '')`,
                    )
                    .if(`ui.query is not null and ui.query != return_to`, (s) =>
                      s.setScalar(`ui.query`, `ui.last_valid_query`),
                    ),
                keydown: (s) =>
                  s
                    .if(
                      `not ui.showing_list or event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
                      (s) => s.return(),
                    )
                    .if(`event.key in ('Enter', 'Tab')`, (s) =>
                      s
                        .if(`ui.active_descendant is not null`, (s) =>
                          s.preventDefault().statements(doSelection),
                        )
                        .return(),
                    )
                    .if(`event.key = 'ArrowDown'`, (s) =>
                      s
                        .preventDefault()
                        .if(`not exists (select index from ui.result)`, (s) =>
                          s.return(),
                        )
                        .setScalar(
                          `ui.selected_index`,
                          `case
                        when ui.selected_index is null or ui.selected_index = (select count(*) from ui.result) - 1
                            then 0
                        else ui.selected_index + 1
                    end`,
                        )
                        .setScalar(
                          `ui.active_descendant`,
                          optionId(`ui.selected_index`),
                        )
                        .return(),
                    )
                    .if(`event.key = 'ArrowUp'`, (s) =>
                      s
                        .preventDefault()
                        .if(`not exists (select index from ui.result)`, (s) =>
                          s.return(),
                        )
                        .setScalar(
                          `ui.selected_index`,
                          `case
                        when ui.selected_index is null or ui.selected_index = 0
                            then (select count(*) from ui.result)
                        else ui.selected_index - 1
                    end`,
                        )
                        .setScalar(
                          `ui.active_descendant`,
                          optionId(`ui.selected_index`),
                        )
                        .return(),
                    )
                    .setScalar(`ui.active_descendant`, `null`),
              },
            },
          },
          endDecorator: [
            nodes.element("button", {
              styles: styles.clearIconButton(
                opts.size ?? "md",
                opts.color ?? "neutral",
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
                click: (s) =>
                  s
                    .setScalar(`ui.query`, `''`)
                    .setScalar(`ui.last_valid_query`, `''`)
                    .statements(opts.onClear)
                    .if(`not ui.showing_list`, (s) =>
                      s.setScalar(
                        `ui.input_focus_key`,
                        `coalesce(ui.input_focus_key + 1, 0)`,
                      ),
                    ),
              },
              children: materialIcon({ fontSize: "md", name: "Clear" }),
            }),
            nodes.if(
              opts.loading
                ? `${opts.loading} or combobox_query_status = 'fallback_triggered'`
                : `combobox_query_status = 'fallback_triggered'`,
              circularProgress({ size: "sm" }),
            ),
            nodes.element("button", {
              styles: styles.arrowIconButton(
                opts.size ?? "md",
                opts.color ?? "neutral",
              ),
              dynamicClasses: [
                {
                  classes: "showing_list",
                  condition: "showing_list",
                },
              ],
              props: { tabIndex: `-1` },
              children: arrowIcon(),
              on: {
                click: (s) =>
                  s
                    .if(`not ui.showing_list`, (s) =>
                      s
                        .setScalar(
                          `ui.input_focus_key`,
                          `coalesce(ui.input_focus_key + 1, 0)`,
                        )
                        .statements(updateComboboxWidth),
                    )
                    .setScalar(`ui.showing_list`, `not ui.showing_list`),
              },
            }),
          ],
        }),
      }),
      nodes.portal(
        comboboxListbox({
          anchorEl: inputWrapperId,
          props: { id: listboxId },
          style: { width: `ui.combobox_width || 'px'` },
          size: opts.size,
          children: nodes.each({
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
                click: (s) =>
                  s
                    .setScalar(`ui.selected_index`, `record.iteration_index`)
                    .statements(doSelection),
              },
              children: "record.label",
            }),
          }),
        }),
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
    opts.variant ?? "outlined",
    opts.color ?? "neutral",
    false,
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
        mouseDown: (s) => s.setScalar("ui.clicking_on_list", "true"),
        mouseUp: (s) => s.setScalar("ui.clicking_on_list", "false"),
      },
      children: opts.children,
    },
    opts,
  );
}
