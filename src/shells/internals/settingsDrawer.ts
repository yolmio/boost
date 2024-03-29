import { alert } from "../../components/alert";
import { button } from "../../components/button";
import { circularProgress } from "../../components/circularProgress";
import { divider } from "../../components/divider";
import { drawer } from "../../components/drawer";
import { formControl } from "../../components/formControl";
import { formLabel } from "../../components/formLabel";
import { iconButton } from "../../components/iconButton";
import { materialIcon } from "../../components/materialIcon";
import { typography } from "../../components/typography";
import { nodes } from "../../nodeHelpers";
import { system } from "../../system";
import { createStyles, cssVar } from "../../styleUtils";
import { DomStatementsOrFn } from "../../statements";
import { checkbox } from "../../components";

export interface SettingsDrawerOpts {
  open: string;
  onClose: DomStatementsOrFn;
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
  colorModeButton: ({ theme }) => {
    return {
      appearance: "none",
      "--icon-margin": "initial", // reset the icon's margin.
      WebkitTapHighlightColor: "transparent",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
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
});

export function settingsDrawer(opts: SettingsDrawerOpts) {
  return drawer({
    open: opts.open,
    onClose: opts.onClose,
    direction: "right",
    slots: { drawer: { styles: styles.root } },
    children: (closeDrawer) => [
      nodes.element("div", {
        styles: styles.settingsHeader,
        children: [
          typography({
            level: "h4",
            children: "'Settings'",
          }),
          iconButton({
            color: "neutral",
            children: materialIcon("Close"),
            variant: "plain",
            size: "sm",
            ariaLabel: "'Close settings'",
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
          nodes.element("div", {
            styles: styles.colorModeSwitcher,
            children: [
              nodes.element("button", {
                styles: styles.colorModeButton(),
                dynamicClasses: [
                  {
                    classes: "selected",
                    condition: `color_scheme = 'light'`,
                  },
                ],
                children: [
                  nodes.element("span", {
                    styles: styles.colorModeIcon,
                    children: materialIcon("LightMode"),
                  }),
                  `'Light'`,
                ],
                on: { click: (s) => s.setScalar(`color_scheme`, `'light'`) },
              }),
              nodes.element("button", {
                styles: styles.colorModeButton(),
                dynamicClasses: [
                  {
                    classes: "selected",
                    condition: `ui.color_scheme = 'system'`,
                  },
                ],
                children: [
                  nodes.element("span", {
                    styles: styles.colorModeIcon,
                    children: materialIcon("SettingsBrightness"),
                  }),
                  `'System'`,
                ],
                on: {
                  click: (s) => s.setScalar(`ui.color_scheme`, `'system'`),
                },
              }),
              nodes.element("button", {
                styles: styles.colorModeButton(),
                dynamicClasses: [
                  {
                    classes: "selected",
                    condition: `ui.color_scheme = 'dark'`,
                  },
                ],
                children: [
                  nodes.element("span", {
                    styles: styles.colorModeIcon,
                    children: materialIcon("DarkModeOutlined"),
                  }),
                  `'Dark'`,
                ],
                on: { click: (s) => s.setScalar(`ui.color_scheme`, `'dark'`) },
              }),
            ],
          }),
        ],
      }),
      nodes.if(
        `sys.can_download`,
        checkbox({
          label: "'Download database'",
          size: "lg",
          variant: "outlined",
          styles: { mb: 2 },
          slots: { input: { props: { id: "'download-database'" } } },
          checked:
            "case when device_prefer_db_download is not null then device_prefer_db_download else sys.prefer_download end",
          on: {
            checkboxChange: (s) =>
              s.setScalar(
                `device_prefer_db_download`,
                `case when device_prefer_db_download is not null then not device_prefer_db_download else not sys.prefer_download end`,
              ),
          },
        }),
      ),
      nodes.state({
        procedure: (s) =>
          s.scalar(
            `email`,
            `(select email from db.${system.db.userTableName} where id = current_user())`,
          ),
        statusScalar: `status`,
        children: nodes.switch(
          {
            condition: `status = 'received'`,
            node: typography({
              level: "body-md",
              children: [
                `'Logged in as: '`,
                nodes.element("strong", {
                  children: `coalesce(email, 'email')`,
                }),
              ],
            }),
          },
          {
            condition: `status = 'fallback_triggered'`,
            node: circularProgress({ size: "sm" }),
          },
          {
            condition: `status = 'failed'`,
            node: alert({ children: `'Unable to get current user'` }),
          },
        ),
      }),
      nodes.element("div", {
        styles: styles.logoutWrapper,
        children: button({
          variant: "soft",
          startDecorator: materialIcon("Logout"),
          children: `'Log out'`,
          on: { click: (s) => s.logout() },
        }),
      }),
    ],
  });
}
