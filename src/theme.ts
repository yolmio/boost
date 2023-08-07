import type { CSSObject } from "./styleTypes";

export interface Focus {
  thickness: string;
  default: CSSObject;
}

export interface Radius {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface Shadow {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface FontSize {
  xs3: string;
  xs2: string;
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xl2: string;
  xl3: string;
  xl4: string;
  xl5: string;
  xl6: string;
  xl7: string;
}

export interface FontFamily {
  body: string;
  display: string;
  code: string;
  fallback: string;
}

export interface FontWeight {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xl2: string;
  xl3: string;
}

export interface LineHeight {
  sm: string;
  md: string;
  lg: string;
}

export interface LetterSpacing {
  sm: string;
  md: string;
  lg: string;
}

export type TypographyKeys =
  | "display1"
  | "display2"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body1"
  | "body2"
  | "body3"
  | "body4"
  | "body5";

export interface TypographySystem extends Record<TypographyKeys, CSSObject> {}

export interface PaletteVariant {
  plainColor: string;
  plainBg: string;
  // hover state
  plainHoverColor: string;
  plainHoverBg: string;
  // active state
  plainActiveColor: string;
  plainActiveBg: string;
  // disabled state
  plainDisabledColor: string;
  plainDisabledBg: string;

  outlinedColor: string;
  outlinedBorder: string;
  outlinedBg: string;
  // hover state
  outlinedHoverColor: string;
  outlinedHoverBorder: string;
  outlinedHoverBg: string;
  // active state
  outlinedActiveColor: string;
  outlinedActiveBorder: string;
  outlinedActiveBg: string;
  // disabled state
  outlinedDisabledColor: string;
  outlinedDisabledBorder: string;
  outlinedDisabledBg: string;

  softColor: string;
  softBg: string;
  // hover state
  softHoverColor: string;
  softHoverBg: string;
  // active state
  softActiveColor: string;
  softActiveBg: string;
  // disabled state
  softDisabledColor?: string;
  softDisabledBg: string;

  solidColor: string;
  solidBg: string;
  // hover state
  solidHoverColor: string;
  solidHoverBg: string;
  // active state
  solidActiveColor: string;
  solidActiveBg: string;
  // disabled state
  solidDisabledColor: string;
  solidDisabledBg: string;
}

export type PaletteRangeKey =
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "mainChannel"
  | "lightChannel"
  | "darkChannel";

export interface PaletteRange
  extends Record<PaletteRangeKey, string>,
    PaletteVariant {}

export interface PaletteCommon {
  white: string;
  black: string;
}

export interface PaletteText {
  primary: string;
  secondary: string;
  tertiary: string;
}
export interface PaletteBackground {
  body: string;
  surface: string;
  level1: string;
  level2: string;
  level3: string;
  tooltip: string;
  backdrop: string;
  popup: string;
}

export type ColorPaletteProp =
  | "primary"
  | "neutral"
  | "danger"
  | "info"
  | "success"
  | "warning";

export interface Palette {
  primary: PaletteRange;
  neutral: PaletteRange;
  danger: PaletteRange;
  info: PaletteRange;
  success: PaletteRange;
  warning: PaletteRange;
  common: PaletteCommon;
  text: PaletteText;
  background: PaletteBackground;
  divider: string;
  focusVisible: string;
}

export type Variant = "soft" | "solid" | "outlined" | "plain";

type Kebab<
  T extends string,
  A extends string = ""
> = T extends `${infer F}${infer R}`
  ? Kebab<R, `${A}${F extends Lowercase<F> ? "" : "-"}${Lowercase<F>}`>
  : A;

/** These css vars are applied depending on the light/dark mode */
export type PaletteCssVars =
  | `shadow-ring`
  | `shadow-channel`
  | `palette-primary-${Kebab<keyof Palette["primary"]>}`
  | `palette-neutral-${Kebab<keyof Palette["neutral"]>}`
  | `palette-danger-${Kebab<keyof Palette["danger"]>}`
  | `palette-info-${Kebab<keyof Palette["info"]>}`
  | `palette-success-${Kebab<keyof Palette["success"]>}`
  | `palette-warning-${Kebab<keyof Palette["warning"]>}`
  | `palette-common-${Kebab<keyof Palette["common"]>}`
  | `palette-text-${Kebab<keyof Palette["text"]>}`
  | `palette-background-${Kebab<keyof Palette["background"]>}`
  | `palette-divider`
  | `palette-focus-visible`;

export interface ColorScheme {
  palette: Palette;
  shadowRing: string;
  shadowChannel: string;
}

export type SpacingTransform = (value: number) => number;

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";

export type BreakpointValues = { [key in Breakpoint]: number };

export interface Breakpoints {
  values: BreakpointValues;
  /**
   * @param key - A breakpoint key (`xs`, `sm`, etc.) or a screen width number in px.
   * @returns A media query string ready to be used with most styling solutions, which matches screen widths greater than the screen size given by the breakpoint key (inclusive).
   */
  up: (key: Breakpoint | number) => string;
}

/** These are the variables declared at :root and don't change for the lifetime of the app */
export type ConstantCssVars =
  | `radius-${keyof Radius}`
  | `shadow-${keyof Shadow}`
  | `focus-thickness`
  | `font-family-${keyof FontFamily}`
  | `font-size-${keyof FontSize}`
  | `font-weight-${keyof FontWeight}`
  | `line-height-${keyof LineHeight}`
  | `letter-spacing-${keyof LetterSpacing}`;

export type CssVar = ConstantCssVars | PaletteCssVars;

export interface Theme {
  lightColorScheme: ColorScheme;
  darkColorScheme: ColorScheme;

  radius: Radius;
  shadow: Shadow;
  focus: Focus;
  typography: TypographySystem;
  fontFamily: FontFamily;
  fontSize: FontSize;
  fontWeight: FontWeight;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;

  spacing: SpacingTransform;
  breakpoints: Breakpoints;
}
