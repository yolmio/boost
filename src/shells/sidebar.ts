import { divider } from "../components/divider.js";
import { drawer } from "../components/drawer.js";
import { iconButton } from "../components/iconButton.js";
import { materialIcon } from "../components/materialIcon.js";
import { IconName } from "../components/materialIconNames.js";
import { setShell } from "../modelHelpers.js";
import { element, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { scalar, setScalar } from "../procHelpers.js";
import {
  createHarmonizeVars,
  createStyles,
  flexGrowStyles,
  getVariantStyle,
} from "../styleUtils.js";
import { ColorPaletteProp } from "../theme.js";
import { stringLiteral } from "../utils/sqlHelpers.js";

export interface SidebarItem {
  label: string;
  icon: IconName;
  href: string;
  children?: Omit<SidebarItem, "children">[];
}

export interface SidebarShellOpts {
  variant?: "soft" | "solid";
  color?: ColorPaletteProp;
  items: SidebarItem[];
}

const sidebarWidth = 280;

const styles = createStyles({
  header: {
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
    borderBottom: "1px solid",
    borderColor: "divider",
    zIndex: 1000,
    lg: {
      width: `calc(100% - ${sidebarWidth}px)`,
      left: sidebarWidth,
    },
  },
  navMainWrapper: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
    lg: {
      flexDirection: "row",
    },
  },
  nav: (variant: "soft" | "solid", color: ColorPaletteProp) => ({
    ...getVariantStyle(variant, color),
    ...createHarmonizeVars(variant, color),
    display: "none",
    flexShrink: "0",
    width: sidebarWidth,
    height: "100vh",
    overflowY: "auto",
    position: "fixed",
    top: 0,
    left: 0,
    px: 1.5,
    lg: {
      display: "flex",
      flexDirection: "column",
    },
  }),
  drawerNav: (variant: "soft" | "solid", color: ColorPaletteProp) => ({
    ...getVariantStyle(variant, color),
    ...createHarmonizeVars(variant, color),
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
    gap: 0.5,
  },
  link: (variant: "soft" | "solid", color: ColorPaletteProp) => {
    return {
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      px: 2,
      py: 1,
      fontWeight: "lg",
      textDecoration: "none",
      color: "text-secondary",
      borderRadius: "md",
      "&:hover,.active": getVariantStyle(variant, color, "hover"),
      "&:active": getVariantStyle(variant, color, "active"),
    };
  },
  headerText: {
    fontWeight: "lg",
    fontSize: "lg",
    mx: 0,
    my: 2,
  },
});

export function sidebarShell(opts: SidebarShellOpts) {
  const variant = opts.variant ?? "solid";
  const color = opts.color ?? "primary";
  const navContents = [
    element("h5", {
      styles: styles.headerText,
      children: "'Northwind Traders'",
    }),
    divider(),
    element("ul", {
      styles: styles.list,
      children: opts.items.map((item) =>
        element("li", {
          children: element("a", {
            styles: styles.link(variant, color),
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
        })
      ),
    }),
  ];
  setShell((pages: Node) =>
    state({
      procedure: [scalar(`drawer_open`, `false`)],
      children: [
        drawer({
          open: `drawer_open`,
          onClose: [setScalar(`drawer_open`, `false`)],
          direction: "left",
          slots: { drawer: { styles: styles.drawerNav(variant, color) } },
          children: () => navContents,
        }),
        element("header", {
          styles: styles.header,
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
            iconButton({
              variant: "plain",
              color: "neutral",
              children: materialIcon("Search"),
            }),
            element("div", { styles: flexGrowStyles }),
            iconButton({
              variant: "plain",
              color: "neutral",
              children: materialIcon("Settings"),
            }),
          ],
        }),
        element("div", {
          styles: styles.navMainWrapper,
          children: [
            element("nav", {
              styles: styles.nav(variant, color),
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
