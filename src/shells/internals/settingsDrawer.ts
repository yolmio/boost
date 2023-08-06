import { alert } from "../../components/alert.js";
import { button } from "../../components/button.js";
import { circularProgress } from "../../components/circularProgress.js";
import { divider } from "../../components/divider.js";
import { drawer } from "../../components/drawer.js";
import { formControl } from "../../components/formControl.js";
import { formLabel } from "../../components/formLabel.js";
import { iconButton } from "../../components/iconButton.js";
import { materialIcon } from "../../components/materialIcon.js";
import { typography } from "../../components/typography.js";
import { element, state, switchNode } from "../../nodeHelpers.js";
import { logOut, scalar, setScalar } from "../../procHelpers.js";
import { app } from "../../singleton.js";
import { createStyles, cssVar } from "../../styleUtils.js";
import { ClientProcStatement } from "../../yom.js";

export interface SettingsDrawerOpts {
  open: string;
  onClose: ClientProcStatement[];
}

const styles = createStyles({
  root: {
    maxWidth: 360,
  },
  logoutWrapper: {
    display: "flex",
    justifyContent: "flex-end",
    mt: 1,
  },
  settingsHeader: {
    display: "flex",
    justifyContent: "space-between",
    mb: 1.5,
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
      "&:focus-visible": app.theme.focus.default,
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
});

export function settingsDrawer(opts: SettingsDrawerOpts) {
  return drawer({
    open: opts.open,
    onClose: opts.onClose,
    direction: "right",
    slots: { drawer: { styles: styles.root } },
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
            `(select email from db.${app.db.userTableName} where id = current_user())`
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
          [`status = 'fallback_triggered'`, circularProgress({ size: "sm" })],
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
  });
}
