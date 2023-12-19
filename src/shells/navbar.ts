import { createHarmonizeVars, createStyles, cssVar } from "../styleUtils";
import { nodes } from "../nodeHelpers";
import type { ColorPaletteProp } from "../theme";
import { getVariantStyle } from "../styleUtils";
import {
  button,
  ButtonOpts,
  styles as buttonStyles,
} from "../components/button";
import { iconButton } from "../components/iconButton";
import { drawer } from "../components/drawer";
import { materialIcon } from "../components/materialIcon";
import { upcaseFirst } from "../utils/inflectors";
import { stringLiteral } from "../utils/sqlHelpers";
import { typography } from "../components/typography";
import { divider } from "../components/divider";
import { settingsDrawer } from "./internals/settingsDrawer";
import { GlobalSearchOpts } from "./internals/types";
import { makeConditionalLink } from "./internals/authLink";
import { globalSearchDialog } from "./internals/globalSearchDialog";
import * as yom from "../yom";
import { Node } from "../nodeTypes";

export interface NavbarProps extends GlobalSearchOpts {
  variant?: "soft" | "solid";
  color?: ColorPaletteProp;
  links: (
    | string
    | { label?: string; url: string; showIf?: yom.SqlExpression }
  )[];
  primaryActionButton?: ButtonOpts;
}

const styles = createStyles({
  root: (app, variant: "soft" | "solid", color: ColorPaletteProp) => {
    app.addGlobalStyle({
      "::view-transition-new(navbar)": {
        animation: "none",
      },
    });
    return {
      ...getVariantStyle(variant, color),
      ...createHarmonizeVars(variant, color),
      display: "flex",
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      px: 1,
      py: 2,
      sm: { px: 2 },
      lg: { px: 3 },
      viewTransitionName: "navbar",
    };
  },
  menuIcon: {
    display: "block",
    flexGrow: 1,
    lg: { display: "none" },
  },
  links: {
    display: "none",
    flexGrow: 1,
    gap: 1.5,
    lg: { display: "flex" },
  },
  navRight: {
    display: "flex",
    gap: 1.5,
  },
  searchButton: ({ theme }) => {
    return {
      appearance: "none",
      "--icon-margin": "initial", // reset the icon's margin.
      WebkitTapHighlightColor: "transparent",
      borderRadius: cssVar("radius-sm"),
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      fontFamily: cssVar(`font-family-body`),
      fontWeight: cssVar(`font-weight-md`),
      lineHeight: 1,
      "&:focus-visible": theme.focus.default,
      "&:hover": getVariantStyle("soft", "harmonize", "hover"),
      "&:active": getVariantStyle("soft", "harmonize", "active"),
      ...getVariantStyle("soft", "harmonize"),
      "--icon-font-size": "1.25rem",
      minHeight: "2rem",
      fontSize: cssVar("font-size-sm"),
      paddingY: "2px",
      border: "1px solid",
      borderColor: "divider",
      paddingLeft: "0.5rem",
      paddingRight: "0.5rem",
      sm: {
        paddingRight: "0.75rem",
      },
    };
  },
  searchButtonStartIcon: {
    display: "inherit",
    sm: { marginRight: "0.5rem" },
  },
  searchButtonLabel: {
    display: "none",
    sm: { display: "inline" },
  },
  linksDivider: {
    my: 1,
  },
  linksHeader: {
    display: "flex",
    justifyContent: "space-between",
  },
  linksDrawer: {
    maxWidth: 360,
  },
  linkWrapper: {
    position: "relative",
  },
  linkActive: (app) => {
    app.addGlobalStyle({
      'html[data-yolm-transition-type*="navigate"]::view-transition-group(navbar-link-active)':
        {
          animationDuration: app.theme.transitionDurations.navigation,
          animationTimingFunction: app.theme.transitionEasing.navigation,
        },
      'html[data-yolm-transition-type*="navigate"]::view-transition-new(navbar-link-active)':
        {
          height: "100%",
        },
      'html[data-yolm-transition-type*="navigate"]::view-transition-old(navbar-link-active)':
        {
          height: "100%",
        },
    });
    return {
      position: "absolute",
      inset: 0,
      borderRadius: "sm",
      ...getVariantStyle("soft", "harmonize"),
      pointerEvents: "none",
      viewTransitionName: "navbar-link-active",
    };
  },
  link: () => ({
    ...buttonStyles.button("plain", "harmonize", "sm", false),
    fontWeight: "lg",
  }),
});

export function navbarShell(opts: NavbarProps): (n: Node) => Node {
  const variant = opts.variant ?? "solid";
  const color = opts.color ?? "neutral";
  const normalizedLabels = opts.links.map((link) => {
    function getLabelFromUrl(url: string) {
      return url.split(/-|\//).filter(Boolean).map(upcaseFirst).join(" ");
    }
    if (typeof link === "string") {
      return { url: link, label: getLabelFromUrl(link) };
    }
    return {
      url: link.url,
      label: link.label ?? getLabelFromUrl(link.url),
      showIf: link.showIf,
    };
  });
  if (opts.multiTableSearchDialog && opts.searchDialog) {
    throw new Error("Cannot have both multiSearchDialog and searchDialog");
  }
  const hasSearchDialog =
    Boolean(opts.searchDialog) || Boolean(opts.multiTableSearchDialog);
  const content = nodes.state({
    procedure: (s) =>
      s
        .scalar("showing_mobile_menu", "false")
        .scalar("showing_settings", "false")
        .conditionalStatements(hasSearchDialog, (s) =>
          s.scalar("searching", "false"),
        ),
    children: nodes.element("nav", {
      styles: styles.root(variant, color),
      children: [
        nodes.element("div", {
          styles: styles.menuIcon,
          children: iconButton({
            color: "harmonize",
            variant: "soft",
            size: "sm",
            ariaLabel: "'Open Menu'",
            children: materialIcon("Menu"),
            on: {
              click: (s) =>
                s
                  .setScalar(`ui.showing_mobile_menu`, `true`)
                  .triggerViewTransition("all"),
            },
          }),
        }),
        nodes.element("div", {
          styles: styles.links,
          children: [
            nodes.element("div", {
              styles: styles.linkWrapper,
              children: [
                iconButton({
                  color: "harmonize",
                  variant: "plain",
                  size: "sm",
                  ariaLabel: "'Home'",
                  children: materialIcon("Home"),
                  href: "'/'",
                }),
                nodes.if(
                  `location.pathname = '/'`,
                  nodes.element("div", { styles: styles.linkActive() }),
                ),
              ],
            }),
            normalizedLabels.map((link) =>
              makeConditionalLink(
                nodes.element("div", {
                  styles: styles.linkWrapper,
                  children: [
                    nodes.element("a", {
                      props: { href: stringLiteral(link.url) },
                      styles: styles.link(),
                      children: stringLiteral(link.label),
                    }),
                    nodes.if(
                      `uri.is_match(location.pathname, ${stringLiteral(
                        link.url,
                      )})`,
                      nodes.element("div", { styles: styles.linkActive() }),
                    ),
                  ],
                }),
                link.showIf,
              ),
            ),
          ],
        }),
        nodes.element("div", {
          styles: styles.navRight,
          children: [
            opts.primaryActionButton
              ? button(opts.primaryActionButton)
              : undefined,
            hasSearchDialog
              ? nodes.element("button", {
                  styles: styles.searchButton(),
                  children: [
                    nodes.element("span", {
                      styles: styles.searchButtonStartIcon,
                      children: materialIcon("Search"),
                    }),
                    nodes.element("span", {
                      styles: styles.searchButtonLabel,
                      children: opts.searchDialog
                        ? `'Find ${opts.searchDialog.table}…'`
                        : `'Search…'`,
                    }),
                  ],
                  on: {
                    click: (s) =>
                      s
                        .setScalar(`ui.searching`, `true`)
                        .triggerViewTransition("all", "'open-dialog'"),
                  },
                })
              : undefined,
            iconButton({
              color: "harmonize",
              variant: "soft",
              size: "sm",
              ariaLabel: "'Open Settings'",
              children: materialIcon("Settings"),
              on: {
                click: (s) =>
                  s
                    .setScalar(`ui.showing_settings`, `true`)
                    .triggerViewTransition("all"),
              },
            }),
          ],
        }),
        drawer({
          open: `ui.showing_mobile_menu`,
          onClose: (s) => s.setScalar(`ui.showing_mobile_menu`, `false`),
          direction: "left",
          slots: { drawer: { styles: styles.linksDrawer } },
          children: (closeDrawer) => [
            nodes.element("div", {
              styles: styles.linksHeader,
              children: [
                typography({
                  level: "h4",
                  children: "'Links'",
                }),
                iconButton({
                  color: "neutral",
                  children: materialIcon("Close"),
                  ariaLabel: "'Close Menu'",
                  variant: "plain",
                  size: "sm",
                  on: { click: closeDrawer },
                }),
              ],
            }),
            divider({ styles: styles.linksDivider }),
            opts.primaryActionButton
              ? button({
                  ...opts.primaryActionButton,
                  color: color,
                  on: { click: closeDrawer },
                })
              : undefined,
            button({
              startDecorator: materialIcon("Home"),
              variant: "plain",
              children: "'Home'",
              href: "'/'",
              on: { click: closeDrawer },
            }),
            normalizedLabels.map((link) => {
              return button({
                variant: "plain",
                children: stringLiteral(link.label),
                href: stringLiteral(link.url),
                on: { click: closeDrawer },
              });
            }),
          ],
        }),
        settingsDrawer({
          open: `ui.showing_settings`,
          onClose: (s) => s.setScalar(`ui.showing_settings`, `false`),
        }),
        globalSearchDialog(opts, `searching`, (open, s) =>
          s.setScalar(`searching`, open),
        ),
      ],
    }),
  });
  return (pages) => [content, pages];
}
