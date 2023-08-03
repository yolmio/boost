import { app } from "../singleton.js";
import type { Node } from "../nodeTypes.js";
import { StyleObject } from "../styleTypes.js";
import { Variant } from "../theme.js";
import { createStyles, cssVar, getVariantStyle } from "../styleUtils.js";
import { Color, ComponentOpts, Size } from "./types.js";
import { mergeEls, SingleElementComponentOpts } from "./utils.js";

export type Orientation = "horizontal" | "vertical";

export interface ListOpts extends ComponentOpts, SingleElementComponentOpts {
  orientation?: Orientation;

  /**
   * Expression for the id of the list this is nested in.
   *
   * We assume this list to be always be in a nested context if this property is provided.
   */
  nestedIn?: string;

  children: Node;
}

export const styles = createStyles({
  list: (
    size: Size | undefined,
    variant: Variant,
    color: Color,
    isNested: boolean,
    orientation: Orientation
  ): StyleObject => {
    const styles: StyleObject = {
      boxSizing: "border-box",
      borderRadius: "var(--list-radius)",
      listStyle: "none",
      display: "flex",
      flexDirection: orientation === "vertical" ? "column" : "row",
      flexGrow: 1,
      position: "relative", // for sticky ListItem
      ...getVariantStyle(variant, color),
    };
    function applySizeVars(size: Size | undefined) {
      if (size === "sm") {
        return {
          "--list-divider-gap": "0.25rem",
          "--list-item-min-height": "2rem",
          "--list-item-padding-y": "0.25rem",
          "--list-item-padding-x": "0.5rem",
          "--list-item-font-size": cssVar(`font-size-sm`),
          "--list-decorator-size": "2rem",
          "--icon-font-size": "1.125rem",
        };
      }
      if (size === "md") {
        return {
          "--list-divider-gap": "0.375rem",
          "--list-item-min-height": "2.5rem",
          "--list-item-padding-y": "0.375rem",
          "--list-item-padding-x": "0.75rem",
          "--list-item-font-size": cssVar(`font-size-md`),
          "--list-decorator-size": "2.5rem",
          "--icon-font-size": "1.25rem",
        };
      }
      if (size === "lg") {
        return {
          "--list-divider-gap": "0.5rem",
          "--list-item-min-height": "3rem",
          "--list-item-padding-y": "0.5rem",
          "--list-item-padding-x": "1rem",
          "--list-item-font-size": cssVar(`font-size-md`),
          "--list-decorator-size": "3rem",
          "--icon-font-size": "1.5rem",
        };
      }
      return {};
    }
    if (isNested) {
      // this won't apply size unless explicitly set, allowing for inheritence
      Object.assign(styles, applySizeVars(size));
      Object.assign(styles, {
        "--list-item-padding-right": "var(--list-item-padding-x)",
        "--list-item-padding-left": "var(--nested-list-item-padding-left)",
        // reset ListItem, ListItemButton negative margin (caused by NestedListItem)
        "--list-item-button-margin-y": "0px",
        "--list-item-button-margin-x": "0px",
        "--list-item-margin-y": "0px",
        "--list-item-margin-x": "0px",
        padding: 0,
        marginLeft: "var(--nested-list-margin-left)",
        marginRight: "var(--nested-list-margin-right)",
        marginTop: "var(--list-gap)",
        marginBottom: "initial", // reset user agent stylesheet.
      });
    } else {
      Object.assign(styles, applySizeVars(size ?? "md"));
      Object.assign(styles, {
        "--list-gap": "0px",
        "--list-decorator-color": cssVar(`palette-text-tertiary`),
        "--list-nested-inset-start": "0px",
        "--list-item-padding-left": "var(--list-item-padding-x)",
        "--list-item-padding-right": "var(--list-item-padding-x)",
        // Automatic radius adjustment kicks in only if '--list-padding' and '--list-radius' are provided.
        "--internal-child-radius":
          "max(var(--list-radius) - var(--list-padding), min(var(--list-padding) / 2, var(--list-radius) / 2))",
        "--list-item-radius": "var(--internal-child-radius)",
        // by default, The ListItem & ListItemButton use automatic radius adjustment based on the parent List.
        "--list-item-start-action-translate-x":
          "calc(0.5 * var(--list-item-padding-left))",
        "--list-item-end-action-translate-x":
          "calc(-0.5 * var(--list-item-padding-right))",
        margin: "initial",
      });
      if (orientation === "vertical") {
        Object.assign(styles, {
          paddingY: "var(--list-padding, var(--list-divider-gap))",
          paddingX: "var(--list-padding)",
        });
      } else {
        Object.assign(styles, {
          paddingX: "var(--list-padding, var(--list-divider-gap))",
          paddingY: "var(--list-padding)",
        });
      }
    }
    return styles;
  },
  baseListItemButton: (inRow: boolean): StyleObject => {
    return {
      WebkitTapHighlightColor: "transparent",
      boxSizing: "border-box",
      position: "relative",
      display: "flex",
      alignItems: "center",
      textAlign: "initial",
      textDecoration: "initial", // reset native anchor tag
      backgroundColor: "initial", // reset button background
      // In some cases, ListItemButton is a child of ListItem so the margin needs to be controlled by the ListItem. The value is negative to account for the ListItem's padding
      marginX: "var(--list-item-button-margin-x)",
      marginY: "var(--list-item-button-margin-y)",
      // account for the border width, so that all of the ListItemButtons content aligned horizontally
      paddingY:
        "calc(var(--list-item-padding-y) - var(--variant-border-width))",
      // account for the border width, so that all of the ListItemButtons content aligned vertically
      paddingLeft:
        "calc(var(--list-item-padding-left) + var(--list-item-start-action-width, var(--internal-start-action-width, 0px)))", // --internal variable makes it possible to customize the actionWidth from the top List
      paddingRight:
        "calc(var(--list-item-padding-right) + var(--list-item-end-action-width, var(--internal-end-action-width, 0px)))", // --internal variable makes it possible to customize the actionWidth from the top List
      minBlockSize: "var(--list-item-min-height)",
      border: "none",
      borderRadius: "var(--list-item-radius)",
      flexGrow: 1,
      flexBasis: "0%", // for long text (in vertical), displays in multiple lines.
      flexShrink: 0,
      minInlineSize: 0,
      transition:
        "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
      fontSize: "var(--list-item-font-size)",
      fontFamily: cssVar(`font-family-body`),
      "&:not(&:first-child)": {
        marginRight: inRow ? "var(--list-gap)" : undefined,
        marginTop: inRow ? undefined : "var(--list-gap)",
      },
      "&:focus-visible": app.theme.focus.default,
    };
  },
  listItemButton: (
    variant: Variant,
    color: Color,
    inRow: boolean
  ): StyleObject => {
    return {
      ...styles.baseListItemButton(inRow),
      '[aria-selected="true"]': app.theme.focus.default,
      "&:hover": getVariantStyle(variant, color, "hover"),
      "&:active": getVariantStyle(variant, color, "active"),
      ...getVariantStyle(variant, color),
    };
  },
  listItem: (sticky: boolean, nested: boolean) => {
    const styles: StyleObject = {
      // Integration with control elements, eg. Checkbox, Radio.
      "--internal-action-radius":
        "calc(var(--list-item-radius) - var(--variant-border-width, 0px))",
      boxSizing: "border-box",
      borderRadius: "var(--list-item-radius)",
      display: "flex",
      flex: "none", // prevent children from shrinking when the List's height is limited.
      position: "relative",
      paddingTop: nested ? 0 : "var(--list-item-padding-y)",
      paddingBottom: nested ? 0 : "var(--list-item-padding-y)",
      paddingLeft: "var(--list-item-padding-left)",
      paddingRight: "var(--list-item-padding-right)",
      "&:first-child": {
        marginTop: "var(--list-gap)",
      },
      minBlockSize: "var(--list-item-min-height)",
      fontSize: "var(--list-item-font-size)",
      fontFamily: cssVar(`font-family-body`),
    };
    if (sticky) {
      Object.assign(styles, {
        // sticky in list item can be found in grouped options
        position: "sticky",
        top: "var(--list-item-sticky-top, 0px)", // integration with Menu and Select.
        zIndex: 1,
        background: "var(--list-item-sticky-background)",
      });
    }
    if (nested) {
      Object.assign(styles, {
        // add negative margin to ListItemButton equal to this ListItem padding
        "--list-item-button-margin-x": `calc(-1 * var(--list-item-padding-left)) calc(-1 * var(--list-item-padding-right))`,
        "--list-item-button-margin-y": "calc(-1 * var(--list-item-padding-y))",
        alignItems: "center",
        marginX: "var(--list-item-margin-x)",
      });
    } else {
      Object.assign(styles, {
        // add negative margin to NestedList equal to this ListItem padding
        "--nested-list-margin-right":
          "calc(-1 * var(--list-item-padding-right))",
        "--nested-list-margin-left": "calc(-1 * var(--list-item-padding-left))",
        "--nested-list-item-padding-left": `calc(var(--list-item-padding-left) + var(--list-nested-inset-start))`,
        // add negative margin to ListItem, ListItemButton to make them start from the edge.
        "--list-item-button-margin-y": "0px",
        "--list-item-button-margin-x":
          "calc(-1 * var(--list-item-padding-left)) calc(-1 * var(--list-item-padding-right))",
        "--list-item-margin-x":
          "calc(-1 * var(--list-item-padding-left)) calc(-1 * var(--list-item-padding-right))",
        flexDirection: "column",
      });
    }
    return styles;
  },
});

export function list(opts: ListOpts) {
  const listStyles = styles.list(
    opts.size,
    opts.variant ?? "plain",
    opts.color ?? "neutral",
    typeof opts.nestedIn === "string",
    opts.orientation ?? "vertical"
  );
  return mergeEls(
    {
      tag: "div",
      props: { "aria-labelledby": opts.nestedIn },
      children: opts.children,
      styles: listStyles,
    },
    opts
  );
}

export interface ListItemButtonOpts extends SingleElementComponentOpts {
  variant?: Variant;
  color?: Color;
  inRow?: boolean;

  children: Node;
}

export function listItemButton(opts: ListItemButtonOpts) {
  const rootStyles = styles.listItemButton(
    opts.variant ?? "plain",
    opts.color ?? "neutral",
    opts.inRow ?? false
  );
  return mergeEls(
    {
      tag: "div",
      styles: rootStyles,
      props: { tabIndex: `0` },
      children: opts.children,
    },
    opts
  );
}

export interface ListItemOpts extends SingleElementComponentOpts {
  variant?: Variant;
  color?: Color;

  /** Whether this list item can contain a nested list */
  nested?: boolean;
  sticky?: boolean;

  startAction?: Node;
  endAction?: Node;

  children: Node;
}

export function listItem(opts: ListItemOpts) {
  return mergeEls(
    {
      tag: "div",
      styles: styles.listItem(opts.sticky ?? false, opts.nested ?? false),
      children: opts.children,
    },
    opts
  );
}

/**
 * This variables should be used in a List to create a scope
 * that will not inherit variables from the upper scope.
 *
 * Used in `Menu`, `MenuList`, `TabList`, `Select`, and `Autocomplete` to communicate with nested List.
 *
 * e.g. menu group:
 * <Menu>
 *   <List>...</List>
 *   <List>...</List>
 * </Menu>
 */
export const scopedVariables = {
  "--nested-list-margin-right": "0px",
  "--nested-list-margin-left": "0px",
  "--nested-list-item-padding-left": "var(--list-item-padding-x)",
  // reset ListItem, ListItemButton negative margin (caused by NestedListItem)
  "--list-item-button-margin-y": "0px",
  "--list-item-button-margin-x": "0px",
  "--list-item-margin-y": "0px",
  "--list-item-margin-x": "0px",
};
