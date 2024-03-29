import { system } from "../system";
import { nodes } from "../nodeHelpers";
import type { Node } from "../nodeTypes";
import { Style, StyleObject } from "../styleTypes";
import { Variant } from "../theme";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils";
import { scopedVariables, styles as listStyles } from "./list";
import { Color, ComponentOpts, Size } from "./types";

const styles = createStyles({
  tab: (
    { theme },
    defaultVariant: Variant,
    defaultColor: Color,
    selectedVariant: Variant,
    selectedColor: Color,
    orientation: Orientation,
  ) => {
    const styles = listStyles.baseListItemButton(orientation === "horizontal");
    Object.assign(styles, {
      justifyContent: "center",
      flexGrow: 1,
      ...getVariantStyle(defaultVariant, defaultColor),
      '&:not(&[aria-selected="true"]):hover': getVariantStyle(
        defaultVariant,
        defaultColor,
        "hover",
      ),
      '&:not(&[aria-selected="true"]):active': getVariantStyle(
        defaultVariant,
        defaultColor,
        "active",
      ),
      '&[aria-selected="true"]': {
        ...getVariantStyle(selectedVariant, selectedColor),
        boxShadow: theme.shadow.sm,
        fontWeight: "initial",
        ...((selectedVariant === "plain" || selectedVariant === "outlined") && {
          backgroundColor: cssVar(`palette-background-surface`),
        }),
      },
    });
    return styles;
  },
  tabList: (_, size: Size | undefined, variant: Variant, color: Color) => {
    const styles = listStyles.list(size, variant, color, false, "horizontal");
    switch (size) {
      case "sm":
        (styles as any)["--tabs-gap"] = "3px";
        break;
      case "md":
      case undefined:
        (styles as any)["--tabs-gap"] = "4px";
        break;
      case "lg":
        (styles as any)["--tabs-gap"] = ".5rem";
        break;
    }
    Object.assign(styles, {
      flexGrow: "initial",
      "--list-radius": cssVar(`radius-md`), // targets TabList which reuses styles from List.
      "--list-gap": "var(--tabs-gap)",
      "--list-padding": "var(--tabs-gap)",
      "--list-divider-gap": "0px",
      ...scopedVariables,
    });
    return styles;
  },
  root: (
    _,
    variant: Variant,
    color: Color,
    size: Size,
    orientation: Orientation,
  ) => {
    const styles = {
      display: "flex",
      ...getVariantStyle(variant, color),
    };
    if (orientation === "horizontal") {
      Object.assign(styles, {
        flexDirection: "column",
      });
    } else {
      Object.assign(styles, {
        flexDirection: "row",
        alignItems: "flex-start",
      });
    }
    switch (size) {
      case "sm":
        Object.assign(styles, {
          "--Tabs-gap": "3px",
        });
        break;
      case "md":
        Object.assign(styles, {
          "--Tabs-gap": "4px",
        });
        break;
      case "lg":
        Object.assign(styles, {
          "--Tabs-gap": "0.5rem",
        });
        break;
    }
    return styles;
  },
  tabPanel: (_, size: Size, orientation: Orientation) => {
    const styles: StyleObject = {
      flexGrow: 1,
      fontFamily: cssVar(`font-family-body`),
      display: "flex",
      flexDirection: "column",
    };
    if (orientation === "horizontal") {
      styles.paddingTop = `var(--tabs-gap)`;
    } else {
      styles.paddingLeft = `var(--tabs-gap)`;
    }
    switch (size) {
      case "sm":
        styles.fontSize = cssVar(`font-size-sm`);
        break;
      case "md":
        styles.fontSize = cssVar(`font-size-md`);
        break;
      case "lg":
        styles.fontSize = cssVar(`font-size-lg`);
        break;
    }
    return styles;
  },
});

type Orientation = "horizontal" | "vertical";

export interface BetterTabsOpts extends ComponentOpts {
  styles?: Style;
  tabDefaultColor?: Color;
  tabSelectedColor?: Color;
  tabDefaultVariant?: Variant;
  tabSelectedVariant?: Variant;
  orientation?: Orientation;
  idBase: string;
  tabs: {
    tabButton: Node;
    content: Node;
  }[];
}

export function tabs(opts: BetterTabsOpts) {
  const size = opts.size ?? "md";
  const orientation = opts.orientation ?? "horizontal";
  const rootStyle = styles.root(
    opts.variant ?? "plain",
    opts.color ?? "neutral",
    size,
    orientation,
  );
  const tabListStyles = styles.tabList(
    size,
    opts.variant ?? "soft",
    opts.color ?? "neutral",
  );
  const tabPanelStyles = styles.tabPanel(size, orientation);
  const tabStyles = styles.tab(
    opts.tabDefaultVariant ?? "plain",
    opts.tabDefaultColor ?? "neutral",
    opts.tabSelectedVariant ?? "outlined",
    opts.tabSelectedColor ?? "neutral",
    orientation,
  );
  const lastTabIdx = opts.tabs.length - 1;
  const getTabId = (idx: number | string) => `${opts.idBase} || 't' || ${idx}`;
  const getPanelId = (idx: number | string) =>
    `${opts.idBase} || 'p' || ${idx}`;
  return nodes.state({
    procedure: (s) => s.scalar(`selected_tab`, `0`).scalar(`focus_tab`, `0`),
    children: nodes.element("div", {
      styles: opts.styles ? [opts.styles, rootStyle] : rootStyle,
      children: [
        nodes.element("div", {
          props: { role: "'tablist'" },
          styles: tabListStyles,
          children: opts.tabs.map((t, i) =>
            nodes.element("div", {
              styles: tabStyles,
              children: t.tabButton,
              props: {
                "aria-selected": `selected_tab = ${i}`,
                role: "'tab'",
                tabIndex: `case when selected_tab = ${i} then 0 else -1 end`,
                id: getTabId(i),
                "aria-controls": `case when selected_tab = 0 then ${getPanelId(
                  i,
                )} end`,
              },
              on: {
                click: (s) =>
                  s
                    .setScalar(`ui.selected_tab`, `${i}`)
                    .setScalar(`ui.focus_tab`, `${i}`),
              },
            }),
          ),
          on: {
            keydown: (s) =>
              s
                .if(
                  `event.key = ${
                    orientation === "horizontal" ? "'ArrowLeft'" : "'ArrowUp'"
                  }`,

                  (s) =>
                    s
                      .setScalar(
                        `ui.focus_tab`,
                        `case when ui.focus_tab = 0 then ${lastTabIdx} else ui.focus_tab - 1 end`,
                      )
                      .focusEl(getTabId(`ui.focus_tab`)),
                )
                .if(
                  `event.key = ${
                    orientation === "horizontal"
                      ? "'ArrowRight'"
                      : "'ArrowDown'"
                  }`,
                  (s) =>
                    s
                      .setScalar(
                        `ui.focus_tab`,
                        `case when ui.focus_tab = ${lastTabIdx} then 0 else ui.focus_tab + 1 end`,
                      )
                      .focusEl(getTabId(`ui.focus_tab`)),
                )
                .if(`event.key = 'Enter' or event.key = ' '`, (s) =>
                  s
                    .setScalar(`ui.selected_tab`, `ui.focus_tab`)
                    .focusEl(getTabId(`ui.focus_tab`)),
                )
                .if(`event.key = 'Home'`, (s) =>
                  s
                    .setScalar(`ui.focus_tab`, `0`)
                    .focusEl(getTabId(`ui.focus_tab`)),
                )
                .if(`event.key = 'End'`, (s) =>
                  s
                    .setScalar(`ui.focus_tab`, `${lastTabIdx}`)
                    .focusEl(getTabId(`ui.focus_tab`)),
                ),
          },
        }),
        nodes.switch(
          ...opts.tabs.map((t, i) => ({
            condition: `selected_tab = ${i}`,
            node: nodes.element("div", {
              styles: tabPanelStyles,
              props: {
                role: `'tabpanel'`,
                id: getPanelId(i),
                "aria-labelledby": getTabId(i),
              },
              children: t.content,
            }),
          })),
        ),
      ],
    }),
  });
}
