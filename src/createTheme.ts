import { deepmerge } from "./utils/deepmerge.js";
import { colors } from "./colors.js";
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
  LetterSpacing,
  LineHeight,
  PaletteRange,
  Radius,
  Shadow,
  SpacingTransform,
  Theme,
  TypographySystem,
} from "./theme.js";
import { colorChannel } from "./colorManipulator.js";
import { cssVar } from "./styleUtils.js";

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
  letterSpacing?: Partial<LetterSpacing>;

  breakpointValues?: Partial<BreakpointValues>;
  spacing?: SpacingTransform;
}

const createLightModeVariantVariables = (color: ColorPaletteProp) => ({
  plainColor: cssVar(`palette-${color}-600`),
  plainBg: `transparent`,
  plainHoverBg: cssVar(`palette-${color}-100`),
  plainHoverColor: cssVar(`palette-${color}-plain-color`),
  plainActiveBg: cssVar(`palette-${color}-200`),
  plainActiveColor: cssVar(`palette-${color}-plain-color`),
  plainDisabledColor: cssVar(`palette-${color}-200`),
  plainDisabledBg: cssVar(`palette-${color}-plain-bg`),

  outlinedColor: cssVar(`palette-${color}-500`),
  outlinedBg: `transparent`,
  outlinedBorder: cssVar(`palette-${color}-200`),
  outlinedHoverColor: cssVar(`palette-${color}-outlined-color`),
  outlinedHoverBg: cssVar(`palette-${color}-100`),
  outlinedHoverBorder: cssVar(`palette-${color}-300`),
  outlinedActiveColor: cssVar(`palette-${color}-outlined-color`),
  outlinedActiveBorder: cssVar(`palette-${color}-outlined-border`),
  outlinedActiveBg: cssVar(`palette-${color}-200`),
  outlinedDisabledColor: cssVar(`palette-${color}-100`),
  outlinedDisabledBorder: cssVar(`palette-${color}-100`),
  outlinedDisabledBg: cssVar(`palette-${color}-outlined-bg`),

  softColor: cssVar(`palette-${color}-600`),
  softBg: cssVar(`palette-${color}-100`),
  softHoverColor: cssVar(`palette-${color}-soft-color`),
  softHoverBg: cssVar(`palette-${color}-200`),
  softActiveColor: cssVar(`palette-${color}-soft-color`),
  softActiveBg: cssVar(`palette-${color}-300`),
  softDisabledColor: cssVar(`palette-${color}-300`),
  softDisabledBg: cssVar(`palette-${color}-50`),

  solidColor: "#fff",
  solidBg: cssVar(`palette-${color}-500`),
  solidHoverColor: cssVar(`palette-${color}-solid-color`),
  solidHoverBg: cssVar(`palette-${color}-600`),
  solidActiveColor: cssVar(`palette-${color}-solid-color`),
  solidActiveBg: cssVar(`palette-${color}-700`),
  solidDisabledColor: `#fff`,
  solidDisabledBg: cssVar(`palette-${color}-200`),
});

const createDarkModeVariantVariables = (color: ColorPaletteProp) => ({
  plainColor: cssVar(`palette-${color}-300`),
  plainBg: `transparent`,
  plainHoverBg: cssVar(`palette-${color}-800`),
  plainHoverColor: cssVar(`palette-${color}-plain-color`),
  plainActiveBg: cssVar(`palette-${color}-700`),
  plainActiveColor: cssVar(`palette-${color}-plain-color`),
  plainDisabledColor: cssVar(`palette-${color}-800`),
  plainDisabledBg: cssVar(`palette-${color}-plain-bg`),

  outlinedColor: cssVar(`palette-${color}-200`),
  outlinedBg: `transparent`,
  outlinedBorder: cssVar(`palette-${color}-700`),
  outlinedHoverColor: cssVar(`palette-${color}-outlined-color`),
  outlinedHoverBg: cssVar(`palette-${color}-800`),
  outlinedHoverBorder: cssVar(`palette-${color}-600`),
  outlinedActiveColor: cssVar(`palette-${color}-outlined-color`),
  outlinedActiveBorder: cssVar(`palette-${color}-outlined-border`),
  outlinedActiveBg: cssVar(`palette-${color}-900`),
  outlinedDisabledColor: cssVar(`palette-${color}-800`),
  outlinedDisabledBorder: cssVar(`palette-${color}-800`),
  outlinedDisabledBg: cssVar(`palette-${color}-outlined-bg`),

  softColor: cssVar(`palette-${color}-200`),
  softBg: cssVar(`palette-${color}-900`),
  softHoverColor: cssVar(`palette-${color}-soft-color`),
  softHoverBg: cssVar(`palette-${color}-800`),
  softActiveColor: cssVar(`palette-${color}-soft-color`),
  softActiveBg: cssVar(`palette-${color}-700`),
  softDisabledColor: cssVar(`palette-${color}-800`),
  softDisabledBg: cssVar(`palette-${color}-900`),

  solidColor: `#fff`,
  solidBg: cssVar(`palette-${color}-600`),
  solidHoverColor: cssVar(`palette-${color}-solid-color`),
  solidHoverBg: cssVar(`palette-${color}-700`),
  solidActiveBg: cssVar(`palette-${color}-800`),
  solidActiveColor: cssVar(`palette-${color}-solid-color`),
  solidDisabledColor: cssVar(`palette-${color}-700`),
  solidDisabledBg: cssVar(`palette-${color}-900`),
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
      plainBg: "transparent",
      plainColor: cssVar(`palette-neutral-800`),
      plainHoverColor: cssVar(`palette-neutral-900`),
      plainHoverBg: cssVar(`palette-neutral-100`),
      plainActiveColor: cssVar(`palette-neutral-plain-color`),
      plainActiveBg: cssVar(`palette-neutral-200`),
      plainDisabledColor: cssVar(`palette-neutral-300`),
      plainDisabledBg: cssVar(`palette-neutral-plain-bg`),

      outlinedBg: "transparent",
      outlinedColor: cssVar(`palette-neutral-800`),
      outlinedBorder: cssVar(`palette-neutral-200`),
      outlinedHoverColor: cssVar(`palette-neutral-900`),
      outlinedHoverBg: cssVar(`palette-neutral-100`),
      outlinedHoverBorder: cssVar(`palette-neutral-300`),
      outlinedActiveBg: cssVar(`palette-neutral-200`),
      outlinedActiveColor: cssVar(`palette-neutral-outlined-color`),
      outlinedActiveBorder: cssVar(`palette-neutral-outlined-border`),
      outlinedDisabledColor: cssVar(`palette-neutral-300`),
      outlinedDisabledBorder: cssVar(`palette-neutral-100`),
      outlinedDisabledBg: cssVar(`palette-neutral-outlined-bg`),

      softColor: cssVar(`palette-neutral-800`),
      softBg: cssVar(`palette-neutral-100`),
      softHoverColor: cssVar(`palette-neutral-900`),
      softHoverBg: cssVar(`palette-neutral-200`),
      softActiveBg: cssVar(`palette-neutral-300`),
      softActiveColor: cssVar(`palette-neutral-soft-hover-color`),
      softDisabledColor: cssVar(`palette-neutral-300`),
      softDisabledBg: cssVar(`palette-neutral-50`),

      solidColor: cssVar(`palette-common-white`),
      solidBg: cssVar(`palette-neutral-600`),
      solidHoverBg: cssVar(`palette-neutral-700`),
      solidHoverColor: cssVar(`palette-neutral-solid-color`),
      solidActiveColor: cssVar(`palette-neutral-solid-color`),
      solidActiveBg: cssVar(`palette-neutral-800`),
      solidDisabledColor: cssVar(`palette-neutral-300`),
      solidDisabledBg: cssVar(`palette-neutral-50`),
    },
    danger: {
      ...emptyChannels,
      ...colors.red,
      ...createLightModeVariantVariables("danger"),
    },
    info: {
      ...emptyChannels,
      ...colors.purple,
      ...createLightModeVariantVariables("info"),
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
      solidColor: cssVar(`palette-warning-800`),
      solidBg: cssVar(`palette-warning-200`),
      solidHoverBg: cssVar(`palette-warning-300`),
      solidActiveBg: cssVar(`palette-warning-400`),
      solidDisabledColor: cssVar(`palette-warning-200`),
      solidDisabledBg: cssVar(`palette-warning-50`),

      softColor: cssVar(`palette-warning-800`),
      softBg: cssVar(`palette-warning-50`),
      softHoverBg: cssVar(`palette-warning-100`),
      softActiveBg: cssVar(`palette-warning-200`),
      softDisabledColor: cssVar(`palette-warning-200`),
      softDisabledBg: cssVar(`palette-warning-50`),

      outlinedColor: cssVar(`palette-warning-800`),
      outlinedHoverBg: cssVar(`palette-warning-50`),

      plainColor: cssVar(`palette-warning-800`),
      plainHoverBg: cssVar(`palette-warning-50`),
    },
    common: {
      white: "#FFF",
      black: "#09090D",
    },
    text: {
      primary: cssVar("palette-neutral-800"),
      secondary: cssVar("palette-neutral-600"),
      tertiary: cssVar("palette-neutral-500"),
    },
    background: {
      body: cssVar("palette-common-white"),
      surface: cssVar("palette-common-white"),
      level1: cssVar("palette-neutral-50"),
      level2: cssVar("palette-neutral-100"),
      level3: cssVar("palette-neutral-200"),
      tooltip: cssVar("palette-neutral-800"),
      popup: cssVar("palette-common-white"),
      backdrop: "rgba(255 255 255 / 0.5)",
    },
    divider: `rgba(${cssVar("palette-neutral-main-channel")} / 0.28)`,
    focusVisible: cssVar("palette-primary-500"),
  },
  shadowRing: "0 0 #000",
  shadowChannel: "187 187 187",
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
      plainBg: "transparent",
      plainColor: cssVar(`palette-neutral-200`),
      plainHoverColor: cssVar(`palette-neutral-50`),
      plainHoverBg: cssVar(`palette-neutral-800`),
      plainActiveColor: cssVar(`palette-neutral-plain-color`),
      plainActiveBg: cssVar(`palette-neutral-700`),
      plainDisabledColor: cssVar(`palette-neutral-700`),
      plainDisabledBg: cssVar(`palette-neutral-plain-bg`),

      outlinedBg: "transparent",
      outlinedColor: cssVar(`palette-neutral-200`),
      outlinedBorder: cssVar(`palette-neutral-800`),
      outlinedHoverColor: cssVar(`palette-neutral-50`),
      outlinedHoverBg: cssVar(`palette-neutral-800`),
      outlinedHoverBorder: cssVar(`palette-neutral-700`),
      outlinedActiveBg: cssVar(`palette-neutral-800`),
      outlinedActiveColor: cssVar(`palette-neutral-outlined-color`),
      outlinedActiveBorder: cssVar(`palette-neutral-outlined-border`),
      outlinedDisabledColor: cssVar(`palette-neutral-800`),
      outlinedDisabledBorder: cssVar(`palette-neutral-800`),
      outlinedDisabledBg: cssVar(`palette-neutral-outlined-bg`),

      softColor: cssVar(`palette-neutral-200`),
      softBg: cssVar(`palette-neutral-800`),
      softHoverColor: cssVar(`palette-neutral-50`),
      softHoverBg: cssVar(`palette-neutral-700`),
      softActiveBg: cssVar(`palette-neutral-600`),
      softActiveColor: cssVar(`palette-neutral-soft-hover-color`),
      softDisabledColor: cssVar(`palette-neutral-700`),
      softDisabledBg: cssVar(`palette-neutral-900`),

      solidColor: cssVar(`palette-common-white`),
      solidBg: cssVar(`palette-neutral-600`),
      solidHoverBg: cssVar(`palette-neutral-700`),
      solidHoverColor: cssVar(`palette-neutral-solid-color`),
      solidActiveColor: cssVar(`palette-neutral-solid-color`),
      solidActiveBg: cssVar(`palette-neutral-800`),
      solidDisabledColor: cssVar(`palette-neutral-700`),
      solidDisabledBg: cssVar(`palette-neutral-900`),
    },
    danger: {
      ...emptyChannels,
      ...colors.red,
      ...createDarkModeVariantVariables("danger"),
    },
    info: {
      ...emptyChannels,
      ...colors.purple,
      ...createDarkModeVariantVariables("info"),
    },
    success: {
      ...emptyChannels,
      ...colors.green,
      ...createDarkModeVariantVariables("success"),
      solidColor: "#fff",
      solidBg: cssVar(`palette-success-600`),
      solidHoverBg: cssVar(`palette-success-700`),
      solidActiveBg: cssVar(`palette-success-800`),
    },
    warning: {
      ...emptyChannels,
      ...colors.yellow,
      ...createDarkModeVariantVariables("warning"),
      solidColor: cssVar(`palette-common-black`),
      solidBg: cssVar(`palette-warning-300`),
      solidHoverBg: cssVar(`palette-warning-400`),
      solidActiveBg: cssVar(`palette-warning-500`),
    },
    common: {
      white: "#FFF",
      black: "#09090D",
    },
    text: {
      primary: cssVar("palette-neutral-100"),
      secondary: cssVar("palette-neutral-300"),
      tertiary: cssVar("palette-neutral-400"),
    },
    background: {
      body: cssVar("palette-neutral-900"),
      surface: cssVar("palette-common-black"),
      level1: cssVar("palette-neutral-800"),
      level2: cssVar("palette-neutral-700"),
      level3: cssVar("palette-neutral-600"),
      tooltip: cssVar("palette-neutral-600"),
      popup: cssVar("palette-neutral-800"),
      backdrop: `rgba(${cssVar("palette-neutral-dark-channel")} / 0.5)`,
    },
    divider: `rgba(${cssVar("palette-neutral-main-channel")} / 0.24)`,
    focusVisible: cssVar("palette-primary-500"),
  },
  shadowRing: "0 0 #000",
  shadowChannel: "0 0 0",
};

const defaultFontSize: FontSize = {
  xs3: "0.5rem",
  xs2: "0.625rem",
  xs: "0.75rem",
  sm: "0.875rem",
  md: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  xl2: "1.5rem",
  xl3: "1.875rem",
  xl4: "2.25rem",
  xl5: "3rem",
  xl6: "3.75rem",
  xl7: "4.5rem",
};

const defaultFontFamily: FontFamily = {
  body: `"Public Sans", ${cssVar("font-family-fallback")}`,
  display: `"Public Sans", ${cssVar("font-family-fallback")}`,
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
  xl2: "800",
  xl3: "900",
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
  sm: "1.25",
  md: "1.5",
  lg: "1.7",
};

const defaultLetterSpacing: LetterSpacing = {
  sm: "-0.01em",
  md: "0.083em",
  lg: "0.125em",
};

const defaultRadius: Radius = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
};

const defaultShadow: Shadow = {
  xs: `${cssVar("shadow-ring")}, 0 1px 2px 0 rgba(${cssVar(
    "shadow-channel"
  )} / 0.12)`,
  sm: `${cssVar("shadow-ring")}, 0.3px 0.8px 1.1px rgba(${cssVar(
    "shadow-channel"
  )} / 0.11), 0.5px 1.3px 1.8px -0.6px rgba(${cssVar(
    "shadow-channel"
  )} / 0.18), 1.1px 2.7px 3.8px -1.2px rgba(${cssVar(
    "shadow-channel"
  )} / 0.26)`,
  md: `${cssVar("shadow-ring")}, 0.3px 0.8px 1.1px rgba(${cssVar(
    "shadow-channel"
  )} / 0.12), 1.1px 2.8px 3.9px -0.4px rgba(${cssVar(
    "shadow-channel"
  )} / 0.17), 2.4px 6.1px 8.6px -0.8px rgba(${cssVar(
    "shadow-channel"
  )} / 0.23), 5.3px 13.3px 18.8px -1.2px rgba(${cssVar(
    "shadow-channel"
  )} / 0.29)`,
  lg: `${cssVar("shadow-ring")}, 0.3px 0.8px 1.1px rgba(${cssVar(
    "shadow-channel"
  )} / 0.11), 1.8px 4.5px 6.4px -0.2px rgba(${cssVar(
    "shadow-channel"
  )} / 0.13), 3.2px 7.9px 11.2px -0.4px rgba(${cssVar(
    "shadow-channel"
  )} / 0.16), 4.8px 12px 17px -0.5px rgba(${cssVar(
    "shadow-channel"
  )} / 0.19), 7px 17.5px 24.7px -0.7px rgba(${cssVar(
    "shadow-channel"
  )} / 0.21)`,
  xl: `${cssVar("shadow-ring")}, 0.3px 0.8px 1.1px rgba(${cssVar(
    "shadow-channel"
  )} / 0.11), 1.8px 4.5px 6.4px -0.2px rgba(${cssVar(
    "shadow-channel"
  )} / 0.13), 3.2px 7.9px 11.2px -0.4px rgba(${cssVar(
    "shadow-channel"
  )} / 0.16), 4.8px 12px 17px -0.5px rgba(${cssVar(
    "shadow-channel"
  )} / 0.19), 7px 17.5px 24.7px -0.7px rgba(${cssVar(
    "shadow-channel"
  )} / 0.21), 10.2px 25.5px 36px -0.9px rgba(${cssVar(
    "shadow-channel"
  )} / 0.24), 14.8px 36.8px 52.1px -1.1px rgba(${cssVar(
    "shadow-channel"
  )} / 0.27), 21px 52.3px 74px -1.2px rgba(${cssVar("shadow-channel")} / 0.29)`,
};

const defaultTypography: TypographySystem = {
  display1: {
    fontFamily: cssVar("font-family-display"),
    fontWeight: cssVar("font-weight-xl"),
    fontSize: cssVar("font-size-xl7"),
    lineHeight: cssVar("line-height-sm"),
    letterSpacing: cssVar("letter-spacing-sm"),
    color: cssVar("palette-text-primary"),
  },
  display2: {
    fontFamily: cssVar("font-family-display"),
    fontWeight: cssVar("font-weight-xl"),
    fontSize: cssVar("font-size-xl6"),
    lineHeight: cssVar("line-height-sm"),
    letterSpacing: cssVar("letter-spacing-sm"),
    color: cssVar("palette-text-primary"),
  },
  h1: {
    fontFamily: cssVar("font-family-display"),
    fontWeight: cssVar("font-weight-lg"),
    fontSize: cssVar("font-size-xl5"),
    lineHeight: cssVar("line-height-sm"),
    letterSpacing: cssVar("letter-spacing-sm"),
    color: cssVar("palette-text-primary"),
  },
  h2: {
    fontFamily: cssVar("font-family-display"),
    fontWeight: cssVar("font-weight-lg"),
    fontSize: cssVar("font-size-xl4"),
    lineHeight: cssVar("line-height-sm"),
    letterSpacing: cssVar("letter-spacing-sm"),
    color: cssVar("palette-text-primary"),
  },
  h3: {
    fontFamily: cssVar("font-family-body"),
    fontWeight: cssVar("font-weight-md"),
    fontSize: cssVar("font-size-xl3"),
    lineHeight: cssVar("line-height-sm"),
    color: cssVar("palette-text-primary"),
  },
  h4: {
    fontFamily: cssVar("font-family-body"),
    fontWeight: cssVar("font-weight-md"),
    fontSize: cssVar("font-size-xl2"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-primary"),
  },
  h5: {
    fontFamily: cssVar("font-family-body"),
    fontWeight: cssVar("font-weight-md"),
    fontSize: cssVar("font-size-xl"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-primary"),
  },
  h6: {
    fontFamily: cssVar("font-family-body"),
    fontWeight: cssVar("font-weight-md"),
    fontSize: cssVar("font-size-lg"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-primary"),
  },
  body1: {
    fontFamily: cssVar("font-family-body"),
    fontSize: cssVar("font-size-md"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-primary"),
  },
  body2: {
    fontFamily: cssVar("font-family-body"),
    fontSize: cssVar("font-size-sm"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-secondary"),
  },
  body3: {
    fontFamily: cssVar("font-family-body"),
    fontSize: cssVar("font-size-xs"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-tertiary"),
  },
  body4: {
    fontFamily: cssVar("font-family-body"),
    fontSize: cssVar("font-size-xs2"),
    lineHeight: cssVar("line-height-md"),
    color: cssVar("palette-text-tertiary"),
  },
  body5: {
    fontFamily: cssVar("font-family-body"),
    fontSize: cssVar("font-size-xs3"),
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
    themeOptions.lightColorSystem
  );
  attachColorChannels(lightColorScheme.palette);
  const darkColorScheme = deepmerge(
    defaultDarkColorScheme,
    themeOptions.darkColorSystem
  );
  attachColorChannels(darkColorScheme.palette);
  const breakpoints = createBreakpoints(
    deepmerge(defaultBreakpointValues, themeOptions.breakpointValues)
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
    letterSpacing: { ...defaultLetterSpacing, ...themeOptions.letterSpacing },
    typography: { ...defaultTypography, ...themeOptions.typography },
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
