import { deepmerge } from "./utils/deepmerge";
import { colors } from "./colors";
import type {
  Breakpoint,
  Breakpoints,
  BreakpointValues,
  ColorPaletteProp,
  ColorScheme,
  Focus,
  FontFamily,
  FontSize,
  FontWeight,
  LineHeight,
  PaletteRange,
  Radius,
  Shadow,
  SpacingTransform,
  Theme,
  TypographySystem,
  ZIndex,
  TransitionDurations,
  TransitionEasings,
} from "./theme";
import { colorChannel } from "./colorManipulator";
import { cssVar } from "./styleUtils";

type Partial3Level<T> = {
  [K in keyof T]?: {
    [J in keyof T[K]]?: T[K][J] extends Record<any, any>
      ? {
          [P in keyof T[K][J]]?: T[K][J][P];
        }
      : T[K][J];
  };
};

export interface ThemeOpts {
  lightColorSystem?: Partial3Level<ColorScheme>;
  darkColorSystem?: Partial3Level<ColorScheme>;

  radius?: Partial<Radius>;
  shadow?: Partial<Shadow>;
  focus?: Partial<Focus>;
  typography?: Partial<TypographySystem>;
  fontFamily?: Partial<FontFamily>;
  fontSize?: Partial<FontSize>;
  fontWeight?: Partial<FontWeight>;
  lineHeight?: Partial<LineHeight>;

  breakpointValues?: Partial<BreakpointValues>;
  spacing?: SpacingTransform;

  transitionDurations?: Partial<TransitionDurations>;
  transitionEasings?: Partial<TransitionEasings>;
  zIndex?: Partial<ZIndex>;
}

const createLightModeVariantVariables = (color: ColorPaletteProp) => ({
  plainColor: cssVar(`palette-${color}-500`),
  plainBg: `transparent`,
  plainHoverBg: cssVar(`palette-${color}-100`),
  plainHoverColor: cssVar(`palette-${color}-500`),
  plainActiveBg: cssVar(`palette-${color}-200`),
  plainActiveColor: cssVar(`palette-${color}-500`),
  plainDisabledColor: cssVar(`palette-neutral-400`),
  plainDisabledBg: cssVar(`palette-${color}-100`),

  outlinedColor: cssVar(`palette-${color}-500`),
  outlinedBg: `transparent`,
  outlinedBorder: cssVar(`palette-${color}-300`),
  outlinedHoverColor: cssVar(`palette-${color}-500`),
  outlinedHoverBg: cssVar(`palette-${color}-100`),
  outlinedHoverBorder: cssVar(`palette-${color}-300`),
  outlinedActiveColor: cssVar(`palette-${color}-500`),
  outlinedActiveBorder: cssVar(`palette-${color}-300`),
  outlinedActiveBg: cssVar(`palette-${color}-200`),
  outlinedDisabledColor: cssVar(`palette-neutral-400`),
  outlinedDisabledBorder: cssVar(`palette-neutral-200`),
  outlinedDisabledBg: cssVar(`palette-${color}-100`),

  softColor: cssVar(`palette-${color}-700`),
  softBg: cssVar(`palette-${color}-100`),
  softHoverColor: cssVar(`palette-${color}-700`),
  softHoverBg: cssVar(`palette-${color}-200`),
  softActiveColor: cssVar(`palette-${color}-800`),
  softActiveBg: cssVar(`palette-${color}-300`),
  softDisabledColor: cssVar(`palette-neutral-400`),
  softDisabledBg: cssVar(`palette-neutral-50`),

  solidColor: cssVar(`palette-common-white`),
  solidBg: cssVar(`palette-${color}-500`),
  solidHoverColor: cssVar(`palette-common-white`),
  solidHoverBg: cssVar(`palette-${color}-600`),
  solidActiveColor: cssVar(`palette-common-white`),
  solidActiveBg: cssVar(`palette-${color}-700`),
  solidDisabledColor: cssVar(`palette-neutral-400`),
  solidDisabledBg: cssVar(`palette-neutral-100`),
});

const createDarkModeVariantVariables = (color: ColorPaletteProp) => ({
  plainColor: cssVar(`palette-${color}-300`),
  plainBg: `transparent`,
  plainHoverBg: cssVar(`palette-${color}-800`),
  plainHoverColor: cssVar(`palette-${color}-300`),
  plainActiveBg: cssVar(`palette-${color}-700`),
  plainActiveColor: cssVar(`palette-${color}-300`),
  plainDisabledColor: cssVar(`palette-neutral-500`),
  plainDisabledBg: cssVar(`palette-${color}-800`),

  outlinedColor: cssVar(`palette-${color}-200`),
  outlinedBg: `transparent`,
  outlinedBorder: cssVar(`palette-${color}-700`),
  outlinedHoverColor: cssVar(`palette-${color}-200`),
  outlinedHoverBg: cssVar(`palette-${color}-800`),
  outlinedHoverBorder: cssVar(`palette-${color}-700`),
  outlinedActiveColor: cssVar(`palette-${color}-200`),
  outlinedActiveBorder: cssVar(`palette-${color}-700`),
  outlinedActiveBg: cssVar(`palette-${color}-700`),
  outlinedDisabledColor: cssVar(`palette-neutral-500`),
  outlinedDisabledBorder: cssVar(`palette-neutral-800`),
  outlinedDisabledBg: cssVar(`palette-${color}-800`),

  softColor: cssVar(`palette-${color}-200`),
  softBg: cssVar(`palette-${color}-800`),
  softHoverColor: cssVar(`palette-${color}-200`),
  softHoverBg: cssVar(`palette-${color}-700`),
  softActiveColor: cssVar(`palette-${color}-100`),
  softActiveBg: cssVar(`palette-${color}-600`),
  softDisabledColor: cssVar(`palette-neutral-500`),
  softDisabledBg: cssVar(`palette-neutral-800`),

  solidColor: cssVar(`palette-common-white`),
  solidBg: cssVar(`palette-${color}-500`),
  solidHoverColor: cssVar(`palette-common-white`),
  solidHoverBg: cssVar(`palette-${color}-600`),
  solidActiveColor: cssVar(`palette-common-white`),
  solidActiveBg: cssVar(`palette-${color}-700`),
  solidDisabledColor: cssVar(`palette-neutral-500`),
  solidDisabledBg: cssVar(`palette-neutral-800`),
});

const UNSET_CHANNEL = "not set yet";

const emptyChannels = {
  mainChannel: UNSET_CHANNEL,
  lightChannel: UNSET_CHANNEL,
  darkChannel: UNSET_CHANNEL,
};

const defaultLightColorScheme: ColorScheme = {
  palette: {
    primary: {
      ...emptyChannels,
      ...colors.blue,
      ...createLightModeVariantVariables("primary"),
    },
    neutral: {
      ...emptyChannels,
      ...colors.grey,
      ...createLightModeVariantVariables("neutral"),
      plainColor: cssVar("palette-neutral-700"),
      plainHoverColor: cssVar(`palette-neutral-900`),
      outlinedColor: cssVar("palette-neutral-700"),
    },
    danger: {
      ...emptyChannels,
      ...colors.red,
      ...createLightModeVariantVariables("danger"),
    },
    success: {
      ...emptyChannels,
      ...colors.green,
      ...createLightModeVariantVariables("success"),
    },
    warning: {
      ...emptyChannels,
      ...colors.yellow,
      ...createLightModeVariantVariables("warning"),
    },
    common: {
      white: "#FFF",
      black: "#09090D",
    },
    text: {
      primary: cssVar("palette-neutral-800"),
      secondary: cssVar("palette-neutral-700"),
      tertiary: cssVar("palette-neutral-600"),
      icon: cssVar("palette-neutral-500"),
    },
    background: {
      body: cssVar("palette-common-white"),
      surface: cssVar("palette-neutral-50"),
      level1: cssVar("palette-neutral-100"),
      level2: cssVar("palette-neutral-200"),
      level3: cssVar("palette-neutral-300"),
      tooltip: cssVar("palette-neutral-500"),
      popup: cssVar("palette-common-white"),
      backdrop: `rgba(${cssVar("palette-neutral-main-channel")} / 0.25)`,
    },
    divider: `rgba(${cssVar("palette-neutral-main-channel")} / 0.2)`,
    focusVisible: cssVar("palette-primary-500"),
  },
  shadowRing: "0 0 #000",
  shadowChannel: "21 21 21",
  shadowOpacity: "0.08",
};

const defaultDarkColorScheme: ColorScheme = {
  palette: {
    primary: {
      ...emptyChannels,
      ...colors.blue,
      ...createDarkModeVariantVariables("primary"),
    },
    neutral: {
      ...emptyChannels,
      ...colors.grey,
      ...createDarkModeVariantVariables("neutral"),
      plainColor: cssVar("palette-neutral-300"),
      plainHoverColor: cssVar(`palette-neutral-300`),
    },
    danger: {
      ...emptyChannels,
      ...colors.red,
      ...createDarkModeVariantVariables("danger"),
    },
    success: {
      ...emptyChannels,
      ...colors.green,
      ...createDarkModeVariantVariables("success"),
    },
    warning: {
      ...emptyChannels,
      ...colors.yellow,
      ...createDarkModeVariantVariables("warning"),
    },
    common: {
      white: "#FFF",
      black: "#09090D",
    },
    text: {
      primary: cssVar("palette-neutral-100"),
      secondary: cssVar("palette-neutral-300"),
      tertiary: cssVar("palette-neutral-400"),
      icon: cssVar("palette-neutral-400"),
    },
    background: {
      body: cssVar("palette-common-black"),
      surface: cssVar("palette-neutral-900"),
      level1: cssVar("palette-neutral-800"),
      level2: cssVar("palette-neutral-700"),
      level3: cssVar("palette-neutral-600"),
      tooltip: cssVar("palette-neutral-600"),
      popup: cssVar("palette-common-black"),
      backdrop: `rgba(${cssVar("palette-neutral-dark-channel")} / 0.25)`,
    },
    divider: `rgba(${cssVar("palette-neutral-main-channel")} / 0.16)`,
    focusVisible: cssVar("palette-primary-500"),
  },
  shadowRing: "0 0 #000",
  shadowChannel: "0 0 0",
  shadowOpacity: "0.6",
};

const defaultFontSize: FontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  md: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  xl2: "1.5rem",
  xl3: "1.875rem",
  xl4: "2.25rem",
};

const defaultFontFamily: FontFamily = {
  body: `"Inter", ${cssVar("font-family-fallback")}`,
  display: `"Inter", ${cssVar("font-family-fallback")}`,
  code: "Source Code Pro,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace",
  fallback:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
};

const defaultFontWeight: FontWeight = {
  xs: "200",
  sm: "300",
  md: "500",
  lg: "600",
  xl: "700",
};

const defaultFocus: Focus = {
  thickness: "2px",
  default: {
    outlineOffset: `var(--focus-outline-offset, ${cssVar("focus-thickness")})`,
    outline: `${cssVar("focus-thickness")} solid ${cssVar(
      "palette-focus-visible"
    )}`,
  },
};

const defaultLineHeight: LineHeight = {
  xs: "1.33334",
  sm: "1.42858",
  md: "1.5",
  lg: "1.55556",
  xl: "1.66667",
};

const defaultRadius: Radius = {
  xs: "2px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
};

const defaultShadow: Shadow = {
  xs: `${cssVar("shadow-ring")}, 0 1px 2px 0 rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")})`,

  sm: `${cssVar("shadow-ring")}, 0 1px 2px 0 rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")}), 0 2px 4px 0 rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")})`,

  md: `${cssVar("shadow-ring")}, 0 2px 8px -2px rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")}), 0 6px 12px -2px rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")})`,

  lg: `${cssVar("shadow-ring")}, 0 2px 8px -2px rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")}), 0 12px 16px -4px rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")})`,

  xl: `${cssVar("shadow-ring")}, 0 2px 8px -2px rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")}), 0 20px 24px -4px rgba(${cssVar(
    "shadow-channel"
  )} / ${cssVar("shadow-opacity")})`,
};

const defaultEasing: TransitionEasings = {
  navigation: "cubic-bezier(0.34, 1.20, 0.64, 1)",
  drawer: "cubic-bezier(0.34, 1, 0.64, 1)",
  dialog: "cubic-bezier(0.34, 1.14, 0.64, 1)",
  popover: "cubic-bezier(0.25, 0.85, 0.35, 1.55)",
};

const defaultDuration: TransitionDurations = {
  navigation: "275ms",
  drawer: "275ms",
  dialog: "225ms",
  popover: "200ms",
};

const defaultZIndex: ZIndex = {
  popover: 1000,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
};

const defaultTypography: TypographySystem = {
  h1: {
    fontFamily: cssVar("font-family-display"),
    fontWeight: cssVar("font-weight-xl"),
    fontSize: cssVar("font-size-xl4"),
    lineHeight: cssVar("line-height-xs"),
    letterSpacing: "-0.025em",
    color: cssVar("palette-text-primary"),
  },
  h2: {
    fontFamily: cssVar("font-family-display"),
    fontWeight: cssVar("font-weight-xl"),
    fontSize: cssVar("font-size-xl3"),
    lineHeight: cssVar("line-height-xs"),
    letterSpacing: "-0.025em",
    color: cssVar("palette-text-primary"),
  },
  h3: {
    fontFamily: cssVar("font-family-display"),
    fontWeight: cssVar("font-weight-lg"),
    fontSize: cssVar("font-size-xl2"),
    lineHeight: cssVar("line-height-xs"),
    letterSpacing: "-0.025em",
    color: cssVar("palette-text-primary"),
  },
  h4: {
    fontFamily: cssVar("font-family-display"),
    fontWeight: cssVar("font-weight-lg"),
    fontSize: cssVar("font-size-xl"),
    lineHeight: cssVar("line-height-md"),
    letterSpacing: "-0.025em",
    color: cssVar("palette-text-primary"),
  },
  "title-lg": {
    fontFamily: cssVar("font-family-body"),
    fontWeight: cssVar("font-weight-lg"),
    fontSize: cssVar("font-size-lg"),
    lineHeight: cssVar("line-height-xs"),
    color: cssVar("palette-text-primary"),
  },
  "title-md": {
    fontFamily: cssVar("font-family-body"),
    fontWeight: cssVar("font-weight-md"),
    fontSize: cssVar("font-size-md"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-primary"),
  },
  "title-sm": {
    fontFamily: cssVar("font-family-body"),
    fontWeight: cssVar("font-weight-md"),
    fontSize: cssVar("font-size-sm"),
    lineHeight: cssVar("line-height-sm"),
    color: cssVar("palette-text-primary"),
  },
  "body-lg": {
    fontFamily: cssVar("font-family-body"),
    fontSize: cssVar("font-size-lg"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-secondary"),
  },
  "body-md": {
    fontFamily: cssVar("font-family-body"),
    fontSize: cssVar("font-size-md"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-secondary"),
  },
  "body-sm": {
    fontFamily: cssVar("font-family-body"),
    fontSize: cssVar("font-size-sm"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-tertiary"),
  },
  "body-xs": {
    fontFamily: cssVar("font-family-body"),
    fontWeight: cssVar("font-weight-md"),
    fontSize: cssVar("font-size-xs"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-tertiary"),
  },
};

const defaultBreakpointValues: BreakpointValues = {
  xs: 0, // phone
  sm: 600, // tablet
  md: 900, // small laptop
  lg: 1200, // desktop
  xl: 1536, // large screen
};

const sortBreakpointsValues = (values: BreakpointValues) => {
  const breakpointsAsArray =
    Object.keys(values).map((key) => ({
      key,
      val: values[key as Breakpoint],
    })) || [];
  // Sort in ascending order
  breakpointsAsArray.sort(
    (breakpoint1, breakpoint2) => breakpoint1.val - breakpoint2.val
  );
  return breakpointsAsArray.reduce((acc, obj) => {
    return { ...acc, [obj.key]: obj.val };
  }, {});
};

function createBreakpoints(values: BreakpointValues): Breakpoints {
  const sortedValues = sortBreakpointsValues(values);
  function up(key: Breakpoint | number) {
    const value = typeof key === "number" ? key : values[key];
    return `@media (min-width:${value}px)`;
  }
  return {
    values: sortedValues as BreakpointValues,
    up,
  };
}

export function createTheme(themeOptions: ThemeOpts = {}): Theme {
  const lightColorScheme = deepmerge(
    defaultLightColorScheme,
    themeOptions.lightColorSystem,
    { clone: true }
  );
  attachColorChannels(lightColorScheme.palette);
  const darkColorScheme = deepmerge(
    defaultDarkColorScheme,
    themeOptions.darkColorSystem,
    { clone: true }
  );
  attachColorChannels(darkColorScheme.palette);
  const breakpoints = createBreakpoints(
    deepmerge(defaultBreakpointValues, themeOptions.breakpointValues, {
      clone: true,
    })
  );
  return {
    lightColorScheme,
    darkColorScheme,

    spacing: themeOptions.spacing ?? ((n) => n * 8),
    breakpoints,

    focus: { ...defaultFocus, ...themeOptions.focus },
    radius: {
      ...defaultRadius,
      ...themeOptions.radius,
    },
    shadow: { ...defaultShadow, ...themeOptions.shadow },
    fontSize: { ...defaultFontSize, ...themeOptions.fontSize },
    fontFamily: { ...defaultFontFamily, ...themeOptions.fontFamily },
    fontWeight: { ...defaultFontWeight, ...themeOptions.fontWeight },
    lineHeight: { ...defaultLineHeight, ...themeOptions.lineHeight },
    typography: deepmerge(defaultTypography, themeOptions.typography),
    zIndex: { ...defaultZIndex, ...themeOptions.zIndex },
    transitionEasing: { ...defaultEasing, ...themeOptions.transitionEasings },
    transitionDurations: {
      ...defaultDuration,
      ...themeOptions.transitionDurations,
    },
  };
}

function attachColorChannels(palette: Record<ColorPaletteProp, PaletteRange>) {
  (Object.keys(palette) as Array<ColorPaletteProp>).forEach((key) => {
    if (palette[key].mainChannel === UNSET_CHANNEL && palette[key][500]) {
      palette[key].mainChannel = colorChannel(palette[key][500]);
    }
    if (palette[key].lightChannel === UNSET_CHANNEL && palette[key][200]) {
      palette[key].lightChannel = colorChannel(palette[key][200]);
    }
    if (palette[key].darkChannel === UNSET_CHANNEL && palette[key][800]) {
      palette[key].darkChannel = colorChannel(palette[key][800]);
    }
  });
}
