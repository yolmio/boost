import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { DomStatements, DomStatementsOrFn } from "../statements";
import { StyleObject } from "../styleTypes";
import { createStyles, cssVar } from "../styleUtils";
import { Variant } from "../theme";
import { deepmerge } from "../utils/deepmerge";
import * as yom from "../yom";
import { listItemButton, ListOpts, styles as listStyles } from "./list";
import { Color, Size } from "./types";
import { mergeEls } from "./utils";

export interface MenuListOpts extends ListOpts {
  getItemId: (id: string) => string;
  itemCount: string;
  onItemSelect: (index: string) => DomStatementsOrFn;
}

const styles = createStyles({
  menuList: (
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
      zIndex: 1300, // the same value as Material UI Menu. TODO: revisit the appropriate value later.
    });
    if (variant === "outlined" || variant === "plain") {
      (styles as any).backgroundColor = cssVar(`palette-background-popup`);
    }
    (styles as any)["--list-item-sticky-background"] = (
      styles as any
    ).backgroundColor;
    return styles;
  },
});

export function menuList(opts: MenuListOpts) {
  const onClose = new DomStatements()
    .setScalar("ui.showing_list", "false")
    .setScalar("ui.active_descendant", "null")
    .setScalar("ui.selected_index", "null");
  return mergeEls(
    {
      tag: "div",
      styles: styles.menuList(
        opts.size,
        opts.variant ?? "outlined",
        opts.color ?? "neutral",
        typeof opts.nestedIn === "string",
      ),
      children: opts.children,
      on: {
        clickAway: onClose,
        focusAway: onClose,
        keydown: (s) =>
          s
            .if(
              `event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
              (s) => s.return(),
            )
            .if(`event.key in ('Enter', ' ')`, (s) =>
              s
                .if(`ui.active_descendant is not null`, (s) =>
                  s
                    .preventDefault()
                    .statements(opts.onItemSelect(`ui.selected_index`)),
                )
                .return(),
            )
            .if(`event.key = 'ArrowDown'`, (s) =>
              s
                .preventDefault()
                .statements(
                  moveDown({
                    getItemId: opts.getItemId,
                    itemCount: opts.itemCount,
                  }),
                )
                .return(),
            )
            .if(`event.key = 'ArrowUp'`, (s) =>
              s
                .preventDefault()
                .statements(
                  moveUp({
                    getItemId: opts.getItemId,
                    itemCount: opts.itemCount,
                  }),
                )
                .return(),
            )
            .if(`event.key = 'Escape'`, (s) =>
              s
                .preventDefault()
                .setScalar(
                  `button_focus_key`,
                  `coalesce(button_focus_key, 0) + 1`,
                )
                .statements(onClose)
                .return(),
            )
            .setScalar(`ui.active_descendant`, `null`),
      },
    },
    opts,
  );
}

export function moveUp(opts: {
  getItemId: (id: string) => string;
  itemCount: string;
}) {
  return new DomStatements().if(`${opts.itemCount} != 0`, (s) =>
    s
      .setScalar(
        `ui.selected_index`,
        `case when ui.selected_index = 0 then 0 else coalesce(ui.selected_index - 1, ${opts.itemCount} - 1) end`,
      )
      .setScalar(`ui.active_descendant`, opts.getItemId(`ui.selected_index`)),
  );
}

export function moveDown(opts: {
  getItemId: (id: string) => string;
  itemCount: string;
}) {
  return new DomStatements().if(`${opts.itemCount} != 0`, (s) =>
    s
      .setScalar(
        `ui.selected_index`,
        `case when ui.selected_index = ${opts.itemCount} - 1 then ui.selected_index else coalesce(ui.selected_index + 1, 0) end`,
      )
      .setScalar(`ui.active_descendant`, opts.getItemId(`ui.selected_index`)),
  );
}

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export interface PopoverMenuOpts {
  id: string;
  items: PopoverMenuItem[];
  button: (opts: {
    buttonProps: yom.ElementProps;
    onButtonClick: DomStatementsOrFn;
    resetState: DomStatementsOrFn;
  }) => Node;
  menuListOpts?: Omit<ListOpts, "children" | "floating"> & {
    floating?: DeepPartial<yom.FloatingOpts>;
  };
  usePortal?: boolean;
}

export interface PopoverMenuItem {
  resetMenuAfter?: boolean;
  onClick: DomStatementsOrFn;
  children: Node;
}

export function popoverMenu(opts: PopoverMenuOpts) {
  const getItemId = (idx: string) => `${opts.id} || ${idx}`;
  const menuId = opts.id;
  const buttonId = opts.id + `|| '-button'`;
  const resetState = new DomStatements()
    .setScalar("ui.showing_list", "false")
    .setScalar("ui.active_descendant", "null")
    .setScalar("ui.selected_index", "null");
  const list = menuList({
    ...opts.menuListOpts,
    itemCount: opts.items.length.toString(),
    getItemId,
    onItemSelect: (idx) => (s) => {
      for (let i = 0; i < opts.items.length; i++) {
        s.if(`${idx} = ${i}`, opts.items[i].onClick);
      }
    },
    floating: deepmerge(
      {
        anchorEl: buttonId,
        placement: `'bottom-start'`,
        strategy: `'absolute'`,
        shift: { mainAxis: "true", crossAxis: "true" },
        offset: {
          mainAxis: `4`,
          crossAxis: `0`,
        },
        flip: { crossAxis: `false`, mainAxis: `false` },
      },
      opts.menuListOpts?.floating,
    ),
    props: {
      role: "'menu'",
      id: menuId,
      tabIndex: `-1`,
      ...opts.menuListOpts?.props,
    },
    children: opts.items.map((item, idx) =>
      listItemButton({
        props: {
          tabIndex: `case when selected_index = ${idx} then 0 else -1 end`,
          yolmFocusKey: `case when selected_index = ${idx} then true end`,
        },
        on: {
          click:
            item.resetMenuAfter ?? true
              ? (s) => s.statements(item.onClick, resetState)
              : item.onClick,
        },
        children: item.children,
      }),
    ),
  });
  return nodes.state({
    procedure: (s) =>
      s
        .scalar("showing_list", `false`)
        .scalar("active_descendant", { type: "String", maxLength: 100 })
        .scalar("selected_index", { type: "BigInt" })
        .scalar(`button_focus_key`, { type: "BigInt" }),
    children: [
      opts.button({
        buttonProps: {
          id: buttonId,
          "aria-controls": `case when showing_list then ${menuId} end`,
          "aria-haspopup": "true",
          "aria-expanded": `case when showing_list then 'true' end`,
          yolmFocusKey: `button_focus_key`,
        },
        onButtonClick: (s) =>
          s
            .setScalar("ui.showing_list", `true`)
            .setScalar(`ui.selected_index`, `0`)
            .setScalar(`ui.active_descendant`, getItemId(`ui.selected_index`)),
        resetState,
      }),
      nodes.if(`ui.showing_list`, opts.usePortal ? nodes.portal(list) : list),
    ],
  });
}
