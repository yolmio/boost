import { scalar, setScalar } from "../procHelpers.js";
import { createHarmonizeVars, createStyles, cssVar } from "../styleUtils.js";
import { element, state } from "../nodeHelpers.js";
import type { ColorPaletteProp } from "../theme.js";
import { getVariantStyle } from "../styleUtils.js";
import {
  button,
  ButtonOpts,
  styles as buttonStyles,
} from "../components/button.js";
import { iconButton } from "../components/iconButton.js";
import { drawer } from "../components/drawer.js";
import { materialIcon } from "../components/materialIcon.js";
import { setShell } from "../modelHelpers.js";
import { upcaseFirst } from "../utils/inflectors.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { model } from "../singleton.js";
import { typography } from "../components/typography.js";
import { divider } from "../components/divider.js";
import { Authorization } from "../modelTypes.js";
import { settingsDrawer } from "./internals/settingsDrawer.js";
import { GlobalSearchOpts } from "./internals/types.js";
import { makeAuthorizedLink } from "./internals/authLink.js";
import { globalSearchDialog } from "./internals/globalSearchDialog.js";

export interface NavbarProps extends GlobalSearchOpts {
  variant?: "soft" | "solid";
  color?: ColorPaletteProp;
  links: (string | { label?: string; url: string; auth?: Authorization })[];
  primaryActionButton?: ButtonOpts;
}

const styles = createStyles({
  root: (variant: "soft" | "solid", color: ColorPaletteProp) => ({
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
  }),
  menuIcon: {
    display: "block",
    flexGrow: 1,
    md: { display: "none" },
  },
  links: {
    display: "none",
    flexGrow: 1,
    gap: 1.5,
    md: { display: "flex" },
  },
  navRight: {
    display: "flex",
    gap: 1.5,
  },
  actionButtonWrapper: {
    display: "none",
    sm: { display: "flex" },
  },
  searchButton: () => {
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
      // TODO: discuss the transition approach in a separate PR. This value is copied from mui-material Button.
      transition:
        "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
      fontFamily: cssVar(`font-family-body`),
      fontWeight: cssVar(`font-weight-md`),
      lineHeight: 1,
      "&:focus-visible": model.theme.focus.default,
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
      paddingRight: "0.75rem",
    };
  },
  searchButtonStartIcon: {
    display: "inherit",
    marginRight: "0.5rem",
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
  link: () => ({
    ...buttonStyles.button("plain", "harmonize", "sm", false),
    "&.active": {
      ...getVariantStyle("soft", "harmonize"),
    },
  }),
});

export function navbarShell(opts: NavbarProps) {
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
      auth: link.auth,
    };
  });
  if (opts.multiTableSearchDialog && opts.searchDialog) {
    throw new Error("Cannot have both multiSearchDialog and searchDialog");
  }
  const hasSearchDialog =
    Boolean(opts.searchDialog) || Boolean(opts.multiTableSearchDialog);
  const content = state({
    procedure: [
      scalar("showing_mobile_menu", "false"),
      scalar("showing_settings", "false"),
      hasSearchDialog ? scalar("searching", "false") : undefined,
    ],
    children: element("nav", {
      styles: styles.root(variant, color),
      children: [
        element("div", {
          styles: styles.menuIcon,
          children: iconButton({
            color: "harmonize",
            variant: "soft",
            size: "sm",
            children: materialIcon({
              title: "'Menu'",
              name: "Menu",
            }),
            on: { click: [setScalar(`ui.showing_mobile_menu`, `true`)] },
          }),
        }),
        element("div", {
          styles: styles.links,
          children: [
            iconButton({
              color: "harmonize",
              variant: "plain",
              size: "sm",
              children: materialIcon({
                title: "'Home'",
                name: "Home",
              }),
              href: "'/'",
            }),
            normalizedLabels.map((link) =>
              makeAuthorizedLink(
                element("a", {
                  props: { href: stringLiteral(link.url) },
                  styles: styles.link(),
                  dynamicClasses: [
                    {
                      condition: `uri.is_match(location.pathname, ${stringLiteral(
                        link.url
                      )})`,
                      classes: "active",
                    },
                  ],
                  children: stringLiteral(link.label),
                }),
                link.auth
              )
            ),
          ],
        }),
        element("div", {
          styles: styles.navRight,
          children: [
            opts.primaryActionButton
              ? element("div", {
                  styles: styles.actionButtonWrapper,
                  children: button(opts.primaryActionButton),
                })
              : undefined,
            hasSearchDialog
              ? element("button", {
                  styles: styles.searchButton(),
                  children: [
                    element("span", {
                      styles: styles.searchButtonStartIcon,
                      children: materialIcon("Search"),
                    }),
                    opts.searchDialog
                      ? `'Find ${opts.searchDialog.table}…'`
                      : `'Search…'`,
                  ],
                  on: { click: [setScalar(`ui.searching`, `true`)] },
                })
              : undefined,
            iconButton({
              color: "harmonize",
              variant: "soft",
              size: "sm",
              children: materialIcon({
                title: "'Settings'",
                name: "Settings",
              }),
              on: { click: [setScalar(`ui.showing_settings`, `true`)] },
            }),
          ],
        }),
        drawer({
          open: `ui.showing_mobile_menu`,
          onClose: [setScalar(`ui.showing_mobile_menu`, `false`)],
          direction: "left",
          slots: { drawer: { styles: styles.linksDrawer } },
          children: (closeDrawer) => [
            element("div", {
              styles: styles.linksHeader,
              children: [
                typography({
                  level: "h5",
                  children: "'Links'",
                }),
                iconButton({
                  color: "neutral",
                  children: materialIcon("Close"),
                  variant: "plain",
                  size: "sm",
                  on: { click: closeDrawer },
                }),
              ],
            }),
            divider({ styles: styles.linksDivider }),
            opts.primaryActionButton
              ? button({ ...opts.primaryActionButton, color: color })
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
          onClose: [setScalar(`ui.showing_settings`, `false`)],
        }),
        globalSearchDialog(opts, `searching`, (open) =>
          setScalar(`searching`, open)
        ),
      ],
    }),
  });
  setShell((pages) => [content, pages]);
}
