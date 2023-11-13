import type { ColorScheme, Theme } from "./theme";
import {
  cssVar,
  darkSchemeSelector,
  fadeIn,
  fadeOut,
  lightSchemeSelector,
} from "./styleUtils";
import { StyleObject } from "./styleTypes";

export function rootStyles(theme: Theme): StyleObject {
  return {
    ":root": getRootVariables(theme),
    [lightSchemeSelector]: {
      ...getColorSchemeVariables(theme.lightColorScheme),
      colorScheme: "light",
    },
    [darkSchemeSelector]: {
      ...getColorSchemeVariables(theme.darkColorScheme),
      colorScheme: "dark",
    },
    html: {
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
      // Change from `box-sizing: content-box` so that `width`
      // is not affected by `padding` or `border`.
      boxSizing: "border-box",
      // Fix font resize problem in iOS
      WebkitTextSizeAdjust: "100%",
      height: "100%",
      width: "100%",
    },
    "*, *::before, *::after": {
      boxSizing: "inherit",
    },
    "strong, b": {
      fontWeight: "bold",
    },
    body: {
      margin: 0, // Remove the margin in all browsers.
      height: "100%",
      width: "100%",
      color: cssVar("palette-text-primary"),
      fontFamily: cssVar("font-family-body"),
      typography: theme.typography["body-md"],
      backgroundColor: cssVar("palette-background-body"),
      // Add support for document.body.requestFullScreen().
      // Other elements, if background transparent, are not supported.
      "&::backdrop": {
        backgroundColor: cssVar("palette-background-backdrop"),
      },
    },
    "#yolm-app-container": {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
    },
    "html::view-transition-group(root)": {
      animationDuration: theme.transitionDurations.navigation,
      animationTimingFunction: theme.transitionEasing.navigation,
    },
    'html[data-yolm-transition-type*="navigate"]::view-transition-new(root)': {
      animationName: fadeIn(),
      mixBlendMode: "plus-lighter",
    },
    'html[data-yolm-transition-type*="navigate"]::view-transition-old(root)': {
      animationName: fadeOut(),
      mixBlendMode: "plus-lighter",
    },
  };
}

function getRootVariables(theme: Theme) {
  const styles: Record<string, string> = {
    "--focus-thickness": theme.focus.thickness,
  };
  addSimpleVars(styles, "--shadow-", theme.shadow);
  addSimpleVars(styles, "--radius-", theme.radius);
  addSimpleVars(styles, "--font-family-", theme.fontFamily);
  addSimpleVars(styles, "--font-size-", theme.fontSize);
  addSimpleVars(styles, "--font-weight-", theme.fontWeight);
  addSimpleVars(styles, "--line-height-", theme.lineHeight);
  addSimpleVars(styles, "--transition-duration-", theme.transitionDurations);
  addSimpleVars(styles, "--transition-easing-", theme.transitionEasing);
  addSimpleVars(styles, "--z-index-", theme.zIndex);
  return styles;
}

function getColorSchemeVariables(scheme: ColorScheme) {
  const styles: Record<string, string> = {
    "--shadow-ring": scheme.shadowRing,
    "--shadow-channel": scheme.shadowChannel,
    "--palette-divider": scheme.palette.divider,
    "--palette-focus-visible": scheme.palette.focusVisible,
  };
  addSimpleVars(styles, "--palette-primary-", scheme.palette.primary);
  addSimpleVars(styles, "--palette-neutral-", scheme.palette.neutral);
  addSimpleVars(styles, "--palette-danger-", scheme.palette.danger);
  addSimpleVars(styles, "--palette-success-", scheme.palette.success);
  addSimpleVars(styles, "--palette-warning-", scheme.palette.warning);
  addSimpleVars(styles, "--palette-common-", scheme.palette.common);
  addSimpleVars(styles, "--palette-text-", scheme.palette.text);
  addSimpleVars(styles, "--palette-background-", scheme.palette.background);
  return styles;
}

function addSimpleVars(
  target: Record<string, string>,
  prefix: string,
  vars: object
) {
  for (const [key, value] of Object.entries(vars)) {
    target[prefix + key] = value;
  }
}
