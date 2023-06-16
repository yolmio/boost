import { if_, logOut, scalar, setScalar } from "../procHelpers.js";
import { createHarmonizeVars, createStyles, cssVar } from "../styleUtils.js";
import {
  element,
  eventHandlers,
  ifNode,
  state,
  switchNode,
} from "../nodeHelpers.js";
import type { ColorPaletteProp } from "../theme.js";
import { getVariantStyle } from "../styleUtils.js";
import { button, ButtonOpts } from "../components/button.js";
import { iconButton } from "../components/iconButton.js";
import { drawer } from "../components/drawer.js";
import { materialIcon } from "../components/materialIcon.js";
import { setShell } from "../modelHelpers.js";
import { upcaseFirst } from "../utils/inflectors.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import {
  multiTableSearchDialog,
  MultiTableSearchDialogTable,
  tableSearchDialog,
  TableSearchDisplay,
} from "../components/searchDialog.js";
import { model, theme } from "../singleton.js";
import { typography } from "../components/typography.js";
import { divider } from "../components/divider.js";
import { formLabel } from "../components/formLabel.js";
import { formControl } from "../components/formControl.js";
import { Authorization } from "../modelTypes.js";
import { currentUserIsAuthorized } from "../utils/auth.js";
import { alert } from "../components/alert.js";
import { circularProgress } from "../components/circularProgress.js";

export interface NavbarProps {
  variant?: "soft" | "solid";
  color?: ColorPaletteProp;
  links: (string | { label?: string; url: string; auth?: Authorization })[];
  primaryActionButton?: ButtonOpts;
  searchDialog?: {
    table: string;
    displayValues?: TableSearchDisplay[];
  };
  multiSearchDialog?: {
    tables: MultiTableSearchDialogTable[];
  };
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
      paddingRight: "0.75rem",
    };
  },
  searchButtonStartIcon: {
    display: "inherit",
    marginRight: "0.5rem",
  },
  colorModeWrapper: {
    my: 2,
  },
  colorModeSwitcher: {
    display: "flex",
    borderRadius: "md",
    width: "100%",
  },
  colorModeButton: () => {
    return {
      appearance: "none",
      "--icon-margin": "initial", // reset the icon's margin.
      WebkitTapHighlightColor: "transparent",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      // TODO: discuss the transition approach in a separate PR. This value is copied from mui-material Button.
      transition:
        "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
      fontFamily: cssVar(`font-family-body`),
      fontWeight: "md",
      lineHeight: 1,
      "&:focus-visible": theme.focus.default,
      "--icon-font-size": "1.25rem",
      minHeight: "2rem",
      fontSize: cssVar("font-size-md"),
      paddingY: 1.5,
      paddingX: 2,
      border: "1px solid",
      borderColor: "divider",
      backgroundColor: "transparent",
      "&:hover": {
        backgroundColor: "neutral-100",
        dark: {
          backgroundColor: "neutral-700",
        },
      },
      "&:first-child": {
        borderTopLeftRadius: cssVar(`radius-md`),
        borderBottomLeftRadius: cssVar(`radius-md`),
      },
      "&:last-child": {
        borderTopRightRadius: cssVar(`radius-md`),
        borderBottomRightRadius: cssVar(`radius-md`),
      },
      "&.selected": {
        borderColor: "primary-400",
        color: "primary-400",
        zIndex: 10,
      },
    };
  },
  colorModeIcon: {
    display: "inherit",
    marginRight: 0.75,
  },
  linksDivider: {
    my: 1,
  },
  linksHeader: {
    display: "flex",
    justifyContent: "space-between",
  },
  settingsHeader: {
    display: "flex",
    justifyContent: "space-between",
    mb: 1.5,
  },
  settingsDrawer: {
    maxWidth: 360,
  },
  linksDrawer: {
    maxWidth: 360,
  },
  logoutWrapper: {
    display: "flex",
    justifyContent: "flex-end",
    mt: 1,
  },
});

export function navbar(opts: NavbarProps) {
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
  if (opts.multiSearchDialog && opts.searchDialog) {
    throw new Error("Cannot have both multiSearchDialog and searchDialog");
  }
  const content = state({
    procedure: [
      scalar("showing_mobile_menu", "false"),
      scalar("showing_settings", "false"),
      scalar("searching", "false"),
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
            normalizedLabels.map((link) => {
              const linkButton = button({
                color: "harmonize",
                variant: "plain",
                size: "sm",
                children: stringLiteral(link.label),
                href: stringLiteral(link.url),
              });
              if (link.auth) {
                return state({
                  procedure: [
                    scalar(`show_link`, currentUserIsAuthorized(link.auth)),
                  ],
                  statusScalar: `status`,
                  children: ifNode(
                    `status = 'received' and show_link`,
                    linkButton
                  ),
                });
              }
              return linkButton;
            }),
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
            opts.searchDialog
              ? element("button", {
                  styles: styles.searchButton(),
                  children: [
                    element("span", {
                      styles: styles.searchButtonStartIcon,
                      children: materialIcon("Search"),
                    }),
                    `'Find ${opts.searchDialog.table}…'`,
                  ],
                  on: { click: [setScalar(`ui.searching`, `true`)] },
                })
              : undefined,
            opts.multiSearchDialog
              ? element("button", {
                  styles: styles.searchButton(),
                  children: [
                    element("span", {
                      styles: styles.searchButtonStartIcon,
                      children: materialIcon("Search"),
                    }),
                    `'Search…'`,
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
        drawer({
          open: `ui.showing_settings`,
          onClose: [setScalar(`ui.showing_settings`, `false`)],
          direction: "right",
          slots: { drawer: { styles: styles.settingsDrawer } },
          children: (closeDrawer) => [
            element("div", {
              styles: styles.settingsHeader,
              children: [
                typography({
                  level: "h5",
                  children: "'Settings'",
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
            divider(),
            formControl({
              styles: styles.colorModeWrapper,
              children: [
                formLabel({
                  children: `'Color mode'`,
                }),
                element("div", {
                  styles: styles.colorModeSwitcher,
                  children: [
                    element("button", {
                      styles: styles.colorModeButton(),
                      dynamicClasses: [
                        {
                          classes: "selected",
                          condition: `ui.color_scheme = 'light'`,
                        },
                      ],
                      children: [
                        element("span", {
                          styles: styles.colorModeIcon,
                          children: materialIcon("LightMode"),
                        }),
                        `'Light'`,
                      ],
                      on: { click: [setScalar(`ui.color_scheme`, `'light'`)] },
                    }),
                    element("button", {
                      styles: styles.colorModeButton(),
                      dynamicClasses: [
                        {
                          classes: "selected",
                          condition: `ui.color_scheme = 'system'`,
                        },
                      ],
                      children: [
                        element("span", {
                          styles: styles.colorModeIcon,
                          children: materialIcon("SettingsBrightness"),
                        }),
                        `'System'`,
                      ],
                      on: { click: [setScalar(`ui.color_scheme`, `'system'`)] },
                    }),
                    element("button", {
                      styles: styles.colorModeButton(),
                      dynamicClasses: [
                        {
                          classes: "selected",
                          condition: `ui.color_scheme = 'dark'`,
                        },
                      ],
                      children: [
                        element("span", {
                          styles: styles.colorModeIcon,
                          children: materialIcon("DarkModeOutlined"),
                        }),
                        `'Dark'`,
                      ],
                      on: { click: [setScalar(`ui.color_scheme`, `'dark'`)] },
                    }),
                  ],
                }),
              ],
            }),
            state({
              procedure: [
                scalar(
                  `email`,
                  `(select email from db.${model.database.userTableName} where id = current_user())`
                ),
              ],
              statusScalar: `status`,
              children: switchNode(
                [
                  `status = 'received'`,
                  typography({
                    level: "body1",
                    children: [
                      `'Logged in as: '`,
                      element("strong", {
                        children: `coalesce(email, 'email')`,
                      }),
                    ],
                  }),
                ],
                [
                  `status = 'fallback_triggered'`,
                  circularProgress({ size: "sm" }),
                ],
                [
                  `status = 'failed'`,
                  alert({ children: `'Unable to get current user'` }),
                ]
              ),
            }),
            element("div", {
              styles: styles.logoutWrapper,
              children: button({
                variant: "soft",
                startDecorator: materialIcon("Logout"),
                children: `'Log out'`,
                on: { click: [logOut()] },
              }),
            }),
          ],
        }),
        opts.searchDialog
          ? tableSearchDialog({
              open: `searching`,
              onClose: [setScalar(`searching`, `false`)],
              table: opts.searchDialog.table,
              displayValues: opts.searchDialog?.displayValues,
            })
          : undefined,
        opts.multiSearchDialog
          ? multiTableSearchDialog({
              open: `searching`,
              onClose: [setScalar(`searching`, `false`)],
              tables: opts.multiSearchDialog.tables,
            })
          : undefined,
        eventHandlers({
          document: {
            keydown: [
              if_(`event.key = 'k' and (event.ctrl_key or event.meta_key)`, [
                setScalar(`searching`, `not searching`),
              ]),
            ],
          },
        }),
      ],
    }),
  });
  setShell(content);
}
