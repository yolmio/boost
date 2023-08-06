/*
I was building this, but in any app that has a datagrid, using a sidebar limits the amount of space you have for the datagrid.
I'll just keep it here for future reference.

import { alpha } from "../colorManipulator.js";
import { drawer } from "../components/drawer.js";
import { iconButton } from "../components/iconButton.js";
import { materialIcon } from "../components/materialIcon.js";
import { IconName } from "../components/materialIconNames.js";
import { setShell } from "../modelHelpers.js";
import { Authorization } from "../modelTypes.js";
import { element, ifNode, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { scalar, setScalar } from "../procHelpers.js";
import { theme } from "../singleton.js";
import { createStyles, cssVar, flexGrowStyles } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { makeAuthorizedLink } from "./internals/authLink.js";
import { globalSearchDialog } from "./internals/globalSearchDialog.js";
import { settingsDrawer } from "./internals/settingsDrawer.js";
import { GlobalSearchOpts } from "./internals/types.js";

export interface SidebarLink {
  label: string;
  icon: IconName;
  href: string;
  auth?: Authorization;
}

export interface SidebarCollapse {
  label: string;
  icon: IconName;
  openByDefault?: boolean;
  auth?: Authorization;
  children: {
    label: string;
    href: string;
  }[];
}

export type SidebarItem = SidebarLink | SidebarCollapse;
export interface SidebarShellOpts extends GlobalSearchOpts {
  items: SidebarItem[];
}

const sidebarWidth = 280;

const styles = createStyles({
  header: () => ({
    display: "flex",
    height: "64px",
    position: "fixed",
    px: 1.5,
    top: 0,
    right: 0,
    backdropFilter: "blur(6px)",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    width: "100%",
    left: 0,
    alignItems: "center",
    zIndex: 1000,
    lg: {
      width: `calc(100% - ${sidebarWidth}px)`,
      left: sidebarWidth,
    },
    dark: {
      backgroundColor: alpha(theme.darkColorScheme.palette.neutral[900], 0.8),
    },
  }),
  navMainWrapper: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
    lg: {
      flexDirection: "row",
    },
  },
  nav: () => ({
    display: "none",
    flexShrink: "0",
    width: sidebarWidth,
    height: "100vh",
    overflowY: "auto",
    position: "fixed",
    top: 0,
    left: 0,
    px: 1.5,
    borderRight: "1px solid",
    borderColor: "divider",
    lg: {
      display: "flex",
      flexDirection: "column",
    },
  }),
  drawerNav: () => ({
    overflowY: "auto",
  }),
  main: {
    flexGrow: "1",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    pt: "64px",
    width: "100%",
    lg: {
      width: `calc(100% - ${sidebarWidth}px)`,
      pl: sidebarWidth + "px",
    },
  },
  menuButton: {
    display: "block",
    lg: {
      display: "none",
    },
  },
  list: {
    m: 0,
    mt: 1,
    p: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  link: () => {
    return {
      userSelect: "none",
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      px: 2,
      py: 1,
      fontSize: "lg",
      fontWeight: "lg",
      textDecoration: "none",
      color: "text-secondary",
      borderRadius: "md",
      cursor: "pointer",
      "&:hover": {
        backgroundColor: cssVar(`palette-primary-50`),
        dark: {
          backgroundColor: cssVar(`palette-primary-800`),
        },
      },
      "&.active": {
        color: "primary-plain-color",
        backgroundColor: cssVar(`palette-primary-50`),
        dark: {
          backgroundColor: cssVar(`palette-primary-800`),
        },
      },
      "&:active": {
        backgroundColor: cssVar(`palette-primary-100`),
        dark: {
          backgroundColor: cssVar(`palette-primary-700`),
        },
      },
    };
  },
  subLink: () => {
    return {
      userSelect: "none",
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      px: 2,
      py: 1,
      fontWeight: "lg",
      textDecoration: "none",
      color: "text-secondary",
      borderRadius: "md",
      "&:hover": {
        backgroundColor: cssVar(`palette-primary-50`),
        dark: {
          backgroundColor: cssVar(`palette-primary-800`),
        },
      },
      "&.active": {
        color: "primary-plain-color",
      },
      "&:active": {
        backgroundColor: cssVar(`palette-primary-100`),
        dark: {
          backgroundColor: cssVar(`palette-primary-700`),
        },
      },
    };
  },
  subLinkDotWrapper: {
    display: "inline-flex",
    width: "16px",
    height: "16px",
    alignItems: "center",
    justifyContent: "center",
  },
  subLinkDot: {
    width: "4px",
    height: "4px",
    borderRadius: "50%",
    backgroundColor: "currentColor",
    ".active &": {
      width: "6px",
      height: "6px",
    },
  },
  headerText: {
    fontWeight: "lg",
    fontSize: "xl",
    mr: 0,
    ml: 2,
    my: 2,
  },
});

export function sidebarShell(opts: SidebarShellOpts) {
  const hasSearchDialog =
    Boolean(opts.searchDialog) || Boolean(opts.multiTableSearchDialog);
  const navContents = [
    element("h5", {
      styles: styles.headerText,
      children: "'Northwind Traders'",
    }),
    element("ul", {
      styles: styles.list,
      children: [
        ...opts.items.map((item) => {
          if ("children" in item) {
            const anyMatching = item.children
              .map(
                (child) =>
                  `uri.is_match(location.pathname, ${stringLiteral(
                    child.href
                  )})`
              )
              .join(" or ");
            return makeAuthorizedLink(
              state({
                procedure: [
                  scalar(`expanded`, (item.openByDefault ?? false).toString()),
                ],
                children: element("li", {
                  children: [
                    element("a", {
                      styles: styles.link(),
                      on: { click: [setScalar(`expanded`, `not expanded`)] },
                      dynamicClasses: [
                        {
                          condition: anyMatching,
                          classes: "active",
                        },
                      ],
                      children: [
                        materialIcon(item.icon),
                        stringLiteral(item.label),
                        element("div", { styles: flexGrowStyles }),
                        ifNode(
                          `expanded`,
                          materialIcon("KeyboardArrowDown"),
                          materialIcon("KeyboardArrowRight")
                        ),
                      ],
                    }),
                    ifNode(
                      `expanded`,
                      element("ul", {
                        styles: styles.list,
                        children: item.children.map((child) =>
                          element("li", {
                            children: element("a", {
                              styles: styles.subLink(),
                              dynamicClasses: [
                                {
                                  condition: `uri.is_match(location.pathname, ${stringLiteral(
                                    child.href
                                  )})`,
                                  classes: "active",
                                },
                              ],
                              props: {
                                href: child.href
                                  ? stringLiteral(child.href)
                                  : undefined,
                              },
                              children: [
                                element("div", {
                                  styles: styles.subLinkDotWrapper,
                                  children: element("span", {
                                    styles: styles.subLinkDot,
                                  }),
                                }),
                                stringLiteral(child.label),
                              ],
                            }),
                          })
                        ),
                      })
                    ),
                  ],
                }),
              }),
              item.auth
            );
          }
          return makeAuthorizedLink(
            element("li", {
              children: element("a", {
                styles: styles.link(),
                dynamicClasses: [
                  {
                    condition: `uri.is_match(location.pathname, ${stringLiteral(
                      item.href
                    )})`,
                    classes: "active",
                  },
                ],
                props: {
                  href: item.href ? stringLiteral(item.href) : undefined,
                },
                children: [materialIcon(item.icon), stringLiteral(item.label)],
              }),
            }),
            item.auth
          );
        }),
      ],
    }),
  ];
  setShell((pages: Node) =>
    state({
      procedure: [
        scalar(`drawer_open`, `false`),
        scalar(`settings_open`, `false`),
        hasSearchDialog ? scalar(`searching`, `false`) : undefined,
      ],
      children: [
        drawer({
          open: `drawer_open`,
          onClose: [setScalar(`drawer_open`, `false`)],
          direction: "left",
          slots: { drawer: { styles: styles.drawerNav() } },
          children: () => navContents,
        }),
        globalSearchDialog(opts, "searching", (open) =>
          setScalar("searching", open)
        ),
        settingsDrawer({
          open: `settings_open`,
          onClose: [setScalar(`settings_open`, `false`)],
        }),
        element("header", {
          styles: styles.header(),
          children: [
            element("span", {
              styles: styles.menuButton,
              children: iconButton({
                variant: "plain",
                color: "neutral",
                children: materialIcon("Menu"),
                on: { click: [setScalar(`drawer_open`, `true`)] },
              }),
            }),
            hasSearchDialog
              ? iconButton({
                  variant: "plain",
                  color: "neutral",
                  children: materialIcon("Search"),
                  on: { click: [setScalar(`searching`, `true`)] },
                })
              : undefined,
            element("div", { styles: flexGrowStyles }),
            iconButton({
              variant: "plain",
              color: "neutral",
              children: materialIcon("Settings"),
              on: { click: [setScalar(`settings_open`, `true`)] },
            }),
          ],
        }),
        element("div", {
          styles: styles.navMainWrapper,
          children: [
            element("nav", {
              styles: styles.nav(),
              children: navContents,
            }),
            element("main", {
              styles: styles.main,
              children: pages,
            }),
          ],
        }),
      ],
    })
  );
}
*/
export const isolatedModules = true;
