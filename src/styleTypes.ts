import type * as CSS from "csstype";
import type {
  Breakpoint,
  FontWeight,
  PaletteCssVars,
  Shadow,
  TypographyKeys,
} from "./theme.js";

type SkipPalette<T extends string> = T extends `palette-${infer R}` ? R : T;

export type SimplifiedPaletteVars = SkipPalette<PaletteCssVars>;

export type StandardCSSProperties = CSS.PropertiesFallback<number | string>;

export interface AliasesCSSProperties {
  /**
   * The **`background-color`** CSS property sets the background color of an element.
   *
   * **Initial value**: `transparent`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/background-color
   */
  bgcolor?: SimplifiedPaletteVars | StandardCSSProperties["backgroundColor"];
  /**
   * The **`margin`** CSS property sets the margin on all four sides of an element. It is a shorthand for `margin-top`, `margin-right`, `margin-bottom`, and `margin-left`.
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin
   */
  m?: StandardCSSProperties["margin"];
  /**
   * The **`margin-top`** CSS property sets the margin on the top of an element. A positive value places it farther from its neighbors, while a negative value places it closer.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-top
   */
  mt?: StandardCSSProperties["marginTop"];
  /**
   * The **`margin-right`** CSS property sets the margin on the right side of an element. A positive value places it farther from its neighbors, while a negative value places it closer.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-right
   */
  mr?: StandardCSSProperties["marginRight"];
  /**
   * The **`margin-bottom`** CSS property sets the margin on the bottom of an element. A positive value places it farther from its neighbors, while a negative value places it closer.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-bottom
   */
  mb?: StandardCSSProperties["marginBottom"];
  /**
   * The **`margin-left`** CSS property sets the margin on the left side of an element. A positive value places it farther from its neighbors, while a negative value places it closer.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-left
   */
  ml?: StandardCSSProperties["marginLeft"];
  /**
   * The **`mx`** property is shorthand for using both **`margin-left`** and **`margin-right`** CSS properties. They set the margin on the left and right side of an element. A positive value places it
   * farther from its neighbors, while a negative value places it closer.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-left
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-right
   */
  mx?: StandardCSSProperties["marginLeft"];
  /**
   * The **`marginX`** property is shorthand for using both **`margin-left`** and **`margin-right`** CSS properties. They set the margin on the left and right side of an element. A positive value
   * places it farther from its neighbors, while a negative value places it closer.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-left
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-right
   */
  marginX?: StandardCSSProperties["marginLeft"];
  /**
   * The **`my`** property is shorthand for using both **`margin-top`** and **`margin-bottom`** CSS properties. They set the margin on the top and bottom of an element. A positive value places it
   * farther from its neighbors, while a negative value places it closer.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-top
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-bottom
   */
  my?: StandardCSSProperties["marginTop"];
  /**
   * The **`marginY`** property is shorthand for using both **`margin-top`** and **`margin-bottom`** CSS properties. They set the margin on the top and bottom of an element. A positive value places
   * it farther from its neighbors, while a negative value places it closer.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-top
   * @see https://developer.mozilla.org/docs/Web/CSS/margin-bottom
   */
  marginY?: StandardCSSProperties["marginTop"];
  /**
   * The **`padding`** CSS property sets the padding on all four sides of an element. It is a shorthand for `padding-top`, `padding-right`, `padding-bottom`, and `padding-left`.
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding
   */
  p?: StandardCSSProperties["padding"];
  /**
   * The **`padding-top`** CSS property sets the height of the padding at the top of an element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-top
   */
  pt?: StandardCSSProperties["paddingTop"];
  /**
   * The **`padding-right`** CSS property sets the width of the padding at the right side of an element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-right
   */
  pr?: StandardCSSProperties["paddingRight"];
  /**
   * The **`padding-bottom`** CSS property sets the height of the padding on the bottom of an element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-bottom
   */
  pb?: StandardCSSProperties["paddingBottom"];
  /**
   * The **`padding-left`** CSS property sets the width of the padding at the left side of an element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-left
   */
  pl?: StandardCSSProperties["paddingLeft"];
  /**
   * The **`px`** property is shorthand for the CSS properties **`padding-left`** and **`padding-right`**. They set the width of the padding at the left and right side of an element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-left
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-right
   */
  px?: StandardCSSProperties["paddingLeft"];
  /**
   * The **`paddingX`** property is shorthand for the CSS properties **`padding-left`** and **`padding-right`**. They set the width of the padding at the left and right sides of an element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-left
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-right
   */
  paddingX?: StandardCSSProperties["paddingLeft"];
  /**
   * The **`py`** property is shorthand for the CSS properties **`padding-top`** and **`padding-bottom`**. They set the width of the padding at the top and bottom of an element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-top
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-bottom
   */
  py?: StandardCSSProperties["paddingTop"];
  /**
   * The **`paddingY`** property is shorthand for the CSS properties **`padding-top`** and **`padding-bottom`**. They set the width of the padding at the top and bottom of an element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-top
   * @see https://developer.mozilla.org/docs/Web/CSS/padding-bottom
   */
  paddingY?: StandardCSSProperties["paddingTop"];
  /**
   * The **`typography`** property  is shorthand for the CSS properties **`font-family`**, **`font-weight`**, **`font-size`**, **`line-height`**, **`letter-spacing`** and **`text-transform``**.
   * It takes the values defined under `theme.typography` and spreads them on the element.
   *
   * **Initial value**: `0`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **2**  |  **1**  | **1**  | **12** | **5.5** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/font-family
   * @see https://developer.mozilla.org/docs/Web/CSS/font-weight
   * @see https://developer.mozilla.org/docs/Web/CSS/font-size
   * @see https://developer.mozilla.org/docs/Web/CSS/line-height
   * @see https://developer.mozilla.org/docs/Web/CSS/letter-spacing
   * @see https://developer.mozilla.org/docs/Web/CSS/text-transform
   */
  typography?: TypographyKeys;
  /**
   * The **`displayPrint`** property sets the display value for the element when the page is printed.
   *
   * **Initial value**: `inline`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/display
   */
  displayPrint?: StandardCSSProperties["display"];
}

export interface OverwriteCSSProperties {
  color?: CSS.Property.Color | SimplifiedPaletteVars;
  borderColor?: CSS.Property.Color | SimplifiedPaletteVars;
  backgroundColor?: CSS.Property.BackgroundColor | SimplifiedPaletteVars;
  /**
   * The **`border`** CSS property is shorthand for the CSS properties **`border-width`**, **`border-style`**, and **`border-color`**. It sets an element's border.
   *
   * **Initial value**: `none`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/border
   */
  border?: CSS.Property.Border | number;
  /**
   * The **`box-shadow`** CSS property adds shadow effects around an element's frame. You can set multiple effects separated by commas. A box shadow is described by X and Y offsets relative to the
   * element for blur and spread radii, and by its color.
   *
   * **Initial value**: `none`
   *
   * | Chrome  | Firefox | Safari  |  Edge  |  IE   |
   * | :-----: | :-----: | :-----: | :----: | :---: |
   * | **10**  |  **4**  | **5.1** | **12** | **9** |
   * | 1 _-x-_ |         | 3 _-x-_ |        |       |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/box-shadow
   */
  boxShadow?: CSS.Property.BoxShadow | keyof Shadow;
  /**
   * The **`font-weight`** CSS property specifies the weight (or boldness) of the font. The font weights available to you will depend on the `font-family` you are using. Some fonts are only
   * available in `normal` and `bold`.
   *
   * **Initial value**: `normal`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **2**  |  **1**  | **1**  | **12** | **3** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/font-weight
   */
  fontWeight?: CSS.Property.FontWeight | keyof FontWeight;
  /**
   * The **`z-index`** CSS property sets the z-order of a positioned element and its descendants or flex items. Overlapping elements with a higher z-index cover those with a lower one.
   *
   * **Initial value**: `auto`
   *
   * | Chrome | Firefox | Safari |  Edge  |  IE   |
   * | :----: | :-----: | :----: | :----: | :---: |
   * | **1**  |  **1**  | **1**  | **12** | **4** |
   *
   * @see https://developer.mozilla.org/docs/Web/CSS/z-index
   */
  zIndex?: CSS.Property.ZIndex | string;
}

/**
 * Map of all CSS pseudo selectors (`:hover`, `:focus`, ...).
 */
export type CSSPseudoSelectorProps = {
  [K in CSS.Pseudos | "dark" | "light" | Breakpoint]?: Style;
};

/**
 * Map all nested selectors.
 */
export interface CSSSelectorObject {
  [cssSelector: string]: Style;
}

type CssVariableType = string | number;

/**
 * Map all nested selectors and CSS variables.
 */
export interface CSSSelectorObjectOrCssVariables {
  [cssSelectorOrVariable: string]: Style | CssVariableType;
}

/**
 * Map of all available CSS properties (including aliases) and their raw value.
 * Only used internally to map CSS properties to input types (responsive value,
 * theme function or nested) in `SystemCssProperties`.
 */
export interface AllSystemCSSProperties
  extends Omit<StandardCSSProperties, keyof OverwriteCSSProperties>,
    OverwriteCSSProperties,
    AliasesCSSProperties {}

export type SystemCssProperties = {
  [K in keyof AllSystemCSSProperties]: AllSystemCSSProperties[K] | Style;
};

export type StyleObject =
  | SystemCssProperties
  | CSSPseudoSelectorProps
  | CSSSelectorObjectOrCssVariables;

export type Style = StyleObject | null | false | undefined | Style[];

/** for anywhere we want just a simple css in js object */
export interface CSSObject
  extends CSS.StandardProperties<number | string>,
    CSS.SvgProperties<number | string> {}
