import { element, ifNode, portal, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import {
  exit,
  if_,
  preventDefault,
  scalar,
  setScalar,
  stopPropagation,
} from "../procHelpers.js";
import { theme } from "../singleton.js";
import { Style, StyleObject } from "../styleTypes.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { ColorPaletteProp, Variant } from "../theme.js";
import { deepmerge } from "../utils/deepmerge.js";
import { memoize } from "../utils/memoize.js";
import { ClientProcStatement, ElementProps, FloatingOpts } from "../yom.js";
import { listItemButton, ListOpts, styles as listStyles } from "./list.js";
import { Color, Size } from "./types.js";
import { mergeEls } from "./utils.js";

export interface MenuListOpts extends ListOpts {
  getItemId: (id: string) => string;
  itemCount: string;
  onItemSelect: (index: string) => ClientProcStatement[];
}

const styles = createStyles({
  menuList: (
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
  const onClose = [
    setScalar("ui.showing_list", "false"),
    setScalar("ui.active_descendant", "null"),
    setScalar("ui.selected_index", "null"),
  ];
  return mergeEls(
    {
      tag: "div",
      styles: styles.menuList(
        opts.size,
        opts.variant ?? "plain",
        opts.color ?? "neutral",
        typeof opts.nestedIn === "string"
      ),
      children: opts.children,
      on: {
        clickAway: onClose,
        focusAway: onClose,
        keydown: [
          if_(
            `event.is_composing or event.shift_key or event.meta_key or event.alt_key or event.ctrl_key`,
            exit()
          ),
          if_(`event.key in ('Enter', ' ')`, [
            if_(`ui.active_descendant is not null`, [
              preventDefault(),
              ...opts.onItemSelect(`ui.selected_index`),
            ]),
            exit(),
          ]),
          if_(`event.key = 'ArrowDown'`, [
            preventDefault(),
            ...moveDown({
              getItemId: opts.getItemId,
              itemCount: opts.itemCount,
            }),
            exit(),
          ]),
          if_(`event.key = 'ArrowUp'`, [
            preventDefault(),
            ...moveUp({ getItemId: opts.getItemId, itemCount: opts.itemCount }),
            exit(),
          ]),
          if_(`event.key = 'Escape'`, [
            preventDefault(),
            setScalar(`button_focus_key`, `coalesce(button_focus_key, 0) + 1`),
            ...onClose,
            exit(),
          ]),
          setScalar(`ui.active_descendant`, `null`),
        ],
        ...opts.on,
      },
    },
    opts
  );
}

export function moveUp(opts: {
  getItemId: (id: string) => string;
  itemCount: string;
}) {
  return [
    if_(`${opts.itemCount} != 0`, [
      setScalar(
        `ui.selected_index`,
        `case when ui.selected_index = 0 then 0 else coalesce(ui.selected_index - 1, ${opts.itemCount} - 1) end`
      ),
      setScalar(`ui.active_descendant`, opts.getItemId(`ui.selected_index`)),
    ]),
  ];
}

export function moveDown(opts: {
  getItemId: (id: string) => string;
  itemCount: string;
}) {
  return [
    if_(`${opts.itemCount} != 0`, [
      setScalar(
        `ui.selected_index`,
        `case when ui.selected_index = ${opts.itemCount} - 1 then ui.selected_index else coalesce(ui.selected_index + 1, 0) end`
      ),
      setScalar(`ui.active_descendant`, opts.getItemId(`ui.selected_index`)),
    ]),
  ];
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
    buttonProps: ElementProps;
    onButtonClick: ClientProcStatement[];
    resetState: ClientProcStatement[];
  }) => Node;
  menuListOpts?: Omit<ListOpts, "children" | "floating"> & {
    floating?: DeepPartial<FloatingOpts>;
  };
  usePortal?: boolean;
}

export interface PopoverMenuItem {
  resetMenuAfter?: boolean;
  onClick: ClientProcStatement[];
  children: Node;
}

export function popoverMenu(opts: PopoverMenuOpts) {
  const getItemId = (idx: string) => `${opts.id} || ${idx}`;
  const menuId = opts.id;
  const buttonId = opts.id + `|| '-button'`;
  const resetState = [
    setScalar("ui.showing_list", "false"),
    setScalar("ui.active_descendant", "null"),
    setScalar("ui.selected_index", "null"),
  ];
  const list = menuList({
    ...opts.menuListOpts,
    itemCount: opts.items.length.toString(),
    getItemId,
    onItemSelect: (idx) =>
      opts.items.map((item, i) => if_(`${idx} = ${i}`, item.onClick)),
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
      opts.menuListOpts?.floating
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
              ? [...item.onClick, ...resetState]
              : item.onClick,
        },
        children: item.children,
      })
    ),
  });
  return state({
    procedure: [
      scalar("showing_list", `false`),
      scalar("active_descendant", { type: "String", maxLength: 100 }),
      scalar("selected_index", { type: "BigInt" }),
      scalar(`button_focus_key`, { type: "BigInt" }),
    ],
    children: [
      opts.button({
        buttonProps: {
          id: buttonId,
          "aria-controls": `case when showing_list then ${menuId} end`,
          "aria-haspopup": "true",
          "aria-expanded": `case when showing_list then 'true' end`,
          yolmFocusKey: `button_focus_key`,
        },
        onButtonClick: [
          setScalar("ui.showing_list", `true`),
          setScalar(`ui.selected_index`, `0`),
          setScalar(`ui.active_descendant`, getItemId(`ui.selected_index`)),
        ],
        resetState,
      }),
      ifNode(`ui.showing_list`, opts.usePortal ? portal(list) : list),
    ],
  });
}
