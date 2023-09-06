import { SequentialIDGenerator } from "./utils/SequentialIdGenerator";
import type { Style, StyleObject } from "./styleTypes";
import type {
  FontFamily,
  FontSize,
  FontWeight,
  LetterSpacing,
  LineHeight,
  Radius,
  Shadow,
  Theme,
  TypographyKeys,
} from "./theme";
import { cssVar, darkSchemeSelector, lightSchemeSelector } from "./styleUtils";
import { app } from "./app";
import type { Node } from "./nodeTypes";
import type * as yom from "./yom";

/** Function that transform the properties in our Style to real css properties, i.e. px -> paddingLeft, paddingRight */
type StyleValueMapper = (
  v: any,
  theme: Theme
) => StyleObject | string | number | null;

const mappers: { [s: string]: StyleValueMapper } = {};

mappers.borderRadius = (v, theme) => {
  if (v in theme.radius) {
    return theme.radius[v as keyof Radius];
  }
  return v;
};
mappers.boxShadow = (v, theme) => {
  if (v in theme.shadow) {
    return theme.shadow[v as keyof Shadow];
  }
  return v;
};

// typography

mappers.fontFamily = (v, theme) => {
  if (v in theme.fontFamily) {
    return theme.fontFamily[v as keyof FontFamily];
  }
  return v;
};
mappers.fontSize = (v, theme) => {
  if (v in theme.fontSize) {
    return theme.fontSize[v as keyof FontSize];
  }
  return v;
};
mappers.fontWeight = (v, theme) => {
  if (v in theme.fontWeight) {
    return theme.fontWeight[v as keyof FontWeight];
  }
  return v;
};
mappers.letterSpacing = (v, theme) => {
  if (v in theme.letterSpacing) {
    return theme.letterSpacing[v as keyof LetterSpacing];
  }
  return v;
};
mappers.lineHeight = (v, theme) => {
  if (v in theme.lineHeight) {
    return theme.lineHeight[v as keyof LineHeight];
  }
  return v;
};
mappers.typography = (v, theme) => {
  return theme.typography[v as TypographyKeys] as any;
};

// pallete

const themeColorKeys = new Set([
  "common-white",
  "common-black",
  "text-primary",
  "text-secondary",
  "text-tertiary",
  "background-body",
  "background-surface",
  "background-backdrop",
  "background-level1",
  "background-level2",
  "background-level3",
  "background-tooltip",
  "background-popup",
  "divider",
  "focus-visible",
]);

function addPaletteRange(color: string) {
  function addVariant(variant: string) {
    const prefix = color + "-" + variant + "-";
    themeColorKeys.add(prefix + "color");
    themeColorKeys.add(prefix + "bg");
    themeColorKeys.add(prefix + "hover-color");
    themeColorKeys.add(prefix + "hover-bg");
    themeColorKeys.add(prefix + "acitve-color");
    themeColorKeys.add(prefix + "active-bg");
    themeColorKeys.add(prefix + "disabled-color");
    themeColorKeys.add(prefix + "disabled-bg");
  }
  addVariant("plain");
  addVariant("solid");
  addVariant("soft");
  addVariant("outlined");
  const outlinedPrefix = color + "-outlined-";
  themeColorKeys.add(outlinedPrefix + "border");
  themeColorKeys.add(outlinedPrefix + "active-border");
  themeColorKeys.add(outlinedPrefix + "hover-border");
  themeColorKeys.add(outlinedPrefix + "disabled-border");
  themeColorKeys.add(color + "-50");
  themeColorKeys.add(color + "-100");
  themeColorKeys.add(color + "-200");
  themeColorKeys.add(color + "-300");
  themeColorKeys.add(color + "-400");
  themeColorKeys.add(color + "-500");
  themeColorKeys.add(color + "-600");
  themeColorKeys.add(color + "-700");
  themeColorKeys.add(color + "-800");
  themeColorKeys.add(color + "-900");
  themeColorKeys.add(color + "-main-channel");
  themeColorKeys.add(color + "-light-channel");
  themeColorKeys.add(color + "-dark-channel");
}

addPaletteRange("primary");
addPaletteRange("neutral");
addPaletteRange("info");
addPaletteRange("success");
addPaletteRange("warning");
addPaletteRange("danger");

function transformColor(value: any, theme: Theme) {
  if (typeof value !== "string") {
    return value;
  }
  if (value === "shadow-channel" || value === "shadow-ring") {
    return cssVar(value);
  }
  if (themeColorKeys.has(value)) {
    return cssVar(("palette-" + value) as any);
  }
  return value;
}

mappers.color = transformColor;
mappers.backgroundColor = transformColor;
mappers.bgcolor = (v, theme) => ({ backgroundColor: transformColor(v, theme) });
mappers.borderColor = transformColor;
mappers.borderTopColor = transformColor;
mappers.borderRightColor = transformColor;
mappers.borderBottomColor = transformColor;
mappers.borderLeftColor = transformColor;

// spacing

const simpleSpacingFields = [
  { real: "paddingTop", short: "pt" },
  { real: "paddingLeft", short: "pl" },
  { real: "paddingRight", short: "pr" },
  { real: "paddingBottom", short: "pb" },
  { real: "marginTop", short: "mt" },
  { real: "marginLeft", short: "ml" },
  { real: "marginRight", short: "mr" },
  { real: "marginBottom", short: "mb" },
  { real: "paddingInlineStart" },
  { real: "paddingInlineEnd" },
  { real: "paddingBlockStart" },
  { real: "paddingBlockEnd" },
  { real: "marginInlineStart" },
  { real: "marginInlineEnd" },
  { real: "marginBlockStart" },
  { real: "marginBlockEnd" },
];

for (const { real, short } of simpleSpacingFields) {
  mappers[real] = (v, theme) => {
    if (typeof v !== "number") {
      return { [real]: v };
    }
    return { [real]: theme.spacing(v) };
  };
  if (short) {
    mappers[short] = mappers[real];
  }
}

const doubleSpacingFields = [
  { long: "paddingX", short: "px", fields: ["paddingLeft", "paddingRight"] },
  { long: "paddingY", short: "py", fields: ["paddingTop", "paddingBottom"] },
  { long: "marginX", short: "mx", fields: ["marginLeft", "marginRight"] },
  { long: "marginY", short: "my", fields: ["marginTop", "marginBottom"] },
  { long: "marginBlock", fields: ["marginBlockStart", "marginBlockEnd"] },
  { long: "marginInline", fields: ["marginInlineStart", "marginInlineEnd"] },
  { long: "paddingBlock", fields: ["paddingBlockStart", "paddingBlockEnd"] },
  { long: "paddingInline", fields: ["paddingInlineStart", "paddingInlineEnd"] },
];

for (const { long, short, fields } of doubleSpacingFields) {
  mappers[long] = (v, theme) => {
    if (typeof v !== "number") {
      return { [fields[0]]: v, [fields[1]]: v };
    }
    const transformed = theme.spacing(v);
    return { [fields[0]]: transformed, [fields[1]]: transformed };
  };
  if (short) {
    mappers[short] = mappers[long];
  }
}

mappers.padding = (v, theme) => {
  if (typeof v !== "number") {
    return {
      paddingTop: v,
      paddingLeft: v,
      paddingRight: v,
      paddingBottom: v,
    };
  }
  const transformed = theme.spacing(v);
  return {
    paddingTop: transformed,
    paddingLeft: transformed,
    paddingRight: transformed,
    paddingBottom: transformed,
  };
};
mappers.p = mappers.padding;

mappers.margin = (v, theme) => {
  if (typeof v !== "number") {
    return {
      marginTop: v,
      marginLeft: v,
      marginRight: v,
      marginBottom: v,
    };
  }
  const transformed = theme.spacing(v);
  return {
    marginTop: transformed,
    marginLeft: transformed,
    marginRight: transformed,
    marginBottom: transformed,
  };
};
mappers.m = mappers.margin;

mappers.gap = (v, theme) => {
  if (typeof v !== "number") {
    return v;
  }
  return { gap: theme.spacing(v) };
};
mappers.columnGap = (v, theme) => {
  if (typeof v !== "number") {
    return v;
  }
  return { columnGap: theme.spacing(v) };
};
mappers.rowGap = (v, theme) => {
  if (typeof v !== "number") {
    return v;
  }
  return { rowGap: theme.spacing(v) };
};

mappers.displayPrint = (v) => ({
  "@media print": {
    display: v,
  },
});

mappers.gridColumnSpan = (v) => ({
  gridColumn: v === "full" ? "1 / -1" : `span ${v} / span ${v}`,
});
mappers.gridRowSpan = (v) => ({
  gridRow: v === "full" ? "1 / -1" : `span ${v} / span ${v}`,
});

/**
 * Quick lookup for unit-less numbers.
 */
const CSS_NUMBER: Set<string> = new Set();

/**
 * CSS properties that are valid unit-less numbers.
 *
 * Ref: https://github.com/facebook/react/blob/master/packages/react-dom/src/shared/CSSProperty.js
 */
const CSS_NUMBER_KEYS = [
  "animation-iteration-count",
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex",
  "box-flex-group",
  "box-ordinal-group",
  "column-count",
  "columns",
  "counter-increment",
  "counter-reset",
  "flex",
  "flex-grow",
  "flex-positive",
  "flex-shrink",
  "flex-negative",
  "flex-order",
  "font-weight",
  "grid-area",
  "grid-column",
  "grid-column-end",
  "grid-column-span",
  "grid-column-start",
  "grid-row",
  "grid-row-end",
  "grid-row-span",
  "grid-row-start",
  "line-clamp",
  "line-height",
  "opacity",
  "order",
  "orphans",
  "tab-size",
  "widows",
  "z-index",
  "zoom",
  // SVG properties.
  "fill-opacity",
  "flood-opacity",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
];

// Add vendor prefixes to all unit-less properties.
for (const property of CSS_NUMBER_KEYS) {
  for (const prefix of ["-webkit-", "-ms-", "-moz-", "-o-", ""]) {
    CSS_NUMBER.add(prefix + property);
  }
}

/**
 * Escape a CSS class name.
 */
function escape(str: string) {
  return str.replace(/[ !#$%&()*+,./;<=>?@[\]^`{|}~"'\\]/g, "\\$&");
}

/**
 * Interpolate the `&` with style name.
 */
function interpolate(selector: string, styleName: string) {
  return selector.replace(/&/g, styleName);
}

/**
 * Interpolate CSS selectors.
 */
function child(selector: string, parent: string) {
  if (selector.indexOf("&") === -1) return `${parent} ${selector}`;
  return interpolate(selector, parent);
}

/**
 * Transform a JavaScript property into a CSS property.
 */
function hyphenate(propertyName: string): string {
  return propertyName
    .replace(/[A-Z]/g, (m: string) => `-${m.toLowerCase()}`)
    .replace(/^ms-/, "-ms-"); // Internet Explorer vendor prefix.
}

const classNameGenerator = new SequentialIDGenerator();

function serializeSimpleCssProperties(obj: object) {
  const rule = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || typeof value === "object") {
      continue;
    }
    const cssKey = hyphenate(key);
    if (typeof value === "number" && value && !CSS_NUMBER.has(cssKey)) {
      rule.push(`${cssKey}:${value}px`);
    } else {
      rule.push(`${cssKey}:${String(value)}`);
    }
  }
  return rule;
}

function createRulesFromStyle(
  obj: object,
  cssRules: string[],
  selector?: string,
  media?: string
) {
  const thisRule = serializeSimpleCssProperties(obj);
  if (thisRule.length !== 0) {
    if (!selector) {
      throw new Error("Cannot specifiy global styles without a selector");
    }
    let rule = `${selector}{${thisRule.join(";")}}`;
    if (media) {
      cssRules.push(`${media}{${rule}}`);
    } else {
      cssRules.push(rule);
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || typeof value !== "object") {
      continue;
    }
    if (key.charCodeAt(0) === 64 /* @ */ && key.includes("media")) {
      if (!selector) {
        throw new Error("Must have parent selector for media query");
      }
      createRulesFromStyle(value, cssRules, selector, key);
    } else {
      createRulesFromStyle(
        value,
        cssRules,
        selector ? child(key, selector) : key,
        media
      );
    }
  }
}

function mergeStyleProp(
  key: string,
  value: any,
  output: Record<string, any>,
  theme: Theme
) {
  if (value === null) {
    output[key] = undefined;
  }
  if (!value && value !== 0) {
    return;
  }
  if (key === "light") {
    const newKey = lightSchemeSelector + " &";
    if (!output[newKey]) {
      output[newKey] = {};
    }
    mergeStyle(value, output[newKey], theme);
    return;
  }
  if (key === "dark") {
    const newKey = darkSchemeSelector + " &";
    if (!output[newKey]) {
      output[newKey] = {};
    }
    mergeStyle(value, output[newKey], theme);
    return;
  }
  if (key.includes("&") || key.includes("@media")) {
    if (!output[key]) {
      output[key] = {};
    }
    mergeStyle(value, output[key], theme);
    return;
  }
  if (key in theme.breakpoints.values) {
    const mediaKey = theme.breakpoints.up(key as any);
    if (!output[mediaKey]) {
      output[mediaKey] = {};
    }
    mergeStyle(value, output[mediaKey], theme);
    return;
  }
  const mapper = mappers[key];
  if (!mapper) {
    output[key] = value;
    return;
  }
  const mappedValue = mapper(value, theme);
  if (mappedValue === null) {
    output[key] = undefined;
    return;
  }
  if (!mappedValue && mappedValue !== 0) {
    return;
  }
  if (typeof mappedValue === "object") {
    for (const [key, value] of Object.entries(mappedValue)) {
      // mergeStyleProp(key, value, output, theme);
      // todo we should handle merging of media queries here
      output[key] = value;
    }
  } else {
    output[key] = mappedValue;
  }
}

function mergeStyle(style: Style, output: Record<string, any>, theme: Theme) {
  if (!style) {
    return;
  }
  if (Array.isArray(style)) {
    for (const v of style) {
      mergeStyle(v, output, theme);
    }
    return;
  }
  for (const [k, v] of Object.entries(style)) {
    mergeStyleProp(k, v, output, theme);
  }
}

function prepStyle(style: Style, theme: Theme) {
  const preppedStyle: Record<string, any> = {};
  mergeStyle(style, preppedStyle, theme);
  return preppedStyle;
}

const seenStyles = new WeakMap<StyleObject | Style[], string>();

/**
 * For animation keyframe definition
 */
export interface KeyFrames {
  [
    /** stuff like `from`, `to` or `10%` etc*/
    key: string
  ]: Style | undefined;
}

const keyframeIdGen = new SequentialIDGenerator();
const registeredKeyframes = new Map<KeyFrames, string>();

export function registerKeyframes(keyframes: KeyFrames) {
  if (registeredKeyframes.has(keyframes)) {
    return registeredKeyframes.get(keyframes)!;
  }
  const id = keyframeIdGen.next();
  registeredKeyframes.set(keyframes, id);
  return id;
}

export class StyleSerializer {
  #cssRules: string[] = [];

  constructor() {
    for (const [frames, id] of registeredKeyframes.entries()) {
      const selectors = [];
      for (const [key, v] of Object.entries(frames)) {
        if (v) {
          const properties = serializeSimpleCssProperties(
            prepStyle(v, app.theme)
          ).join(";");
          selectors.push(`${key} {${properties}}`);
        }
      }
      this.#cssRules.push(`@keyframes ${id}{${selectors.join("")}}`);
    }
  }

  addGlobalStyle(style: Style) {
    createRulesFromStyle(prepStyle(style, app.theme), this.#cssRules);
  }

  addStyle(style: Style, useCached = true): string {
    if (typeof style !== "object" || style === null) {
      return "";
    }
    if (useCached && seenStyles.has(style)) {
      return seenStyles.get(style)!;
    }
    const className = "boost-" + classNameGenerator.next();
    createRulesFromStyle(
      prepStyle(style, app.theme),
      this.#cssRules,
      "." + className
    );
    seenStyles.set(style, className);
    return className;
  }

  getCss() {
    return this.#cssRules.join("");
  }
}

const transformedNodes = new WeakMap<object, yom.Node>();

export function transformNode(
  node: Node,
  styleToClass: (
    styles: Style | undefined,
    dynamicStyle: boolean
  ) => string | undefined
): yom.Node {
  if (typeof node === "string") {
    return node;
  }
  if (transformedNodes.has(node)) {
    return transformedNodes.get(node)!;
  }
  if (Array.isArray(node)) {
    const transformed = node
      .filter((n) => n !== undefined && n !== null)
      .map((n) => transformNode(n!, styleToClass));
    transformedNodes.set(node, transformed);
    return transformed;
  }
  let transformed: yom.Node;
  switch (node.t) {
    case "EventHandlers":
    case "Recurse":
      transformed = node;
      break;
    case "Portal":
    case "QueryParams":
    case "Route":
    case "State":
    case "Mode":
    case "Each":
    case "SourceMap":
    case "Recursive":
      transformed = {
        ...node,
        children: transformNode(node.children, styleToClass),
      };
      break;
    case "Switch":
      transformed = {
        t: "Switch",
        cases: node.cases.map(({ condition, node }) => ({
          condition,
          node: node ? transformNode(node, styleToClass) : undefined,
        })),
      };
      break;
    case "Element": {
      let classes = styleToClass(node.styles, false);
      if (node.classes) {
        classes = classes ? classes + " " + node.classes : node.classes;
      }
      transformed = {
        t: "Element",
        tag: node.tag,
        children: node.children
          ? transformNode(node.children, styleToClass)
          : undefined,
        floating: node.floating,
        focusLock: node.focusLock,
        scrollLock: node.scrollLock,
        on: node.on,
        props: node.props,
        testId: node.testId,
        classes,
        style: node.style,
        dynamicClasses: node.dynamicClasses,
      };
      break;
    }
    case "If":
      transformed = {
        t: "If",
        condition: node.condition,
        then: node.then ? transformNode(node.then, styleToClass) : undefined,
        else: node.else ? transformNode(node.else, styleToClass) : undefined,
      };
      break;
    case "Routes":
      transformed = {
        t: "Routes",
        children: node.children.map((n) => ({
          ...n,
          t: "Route",
          children: transformNode(n.children, styleToClass),
        })),
      };
      break;
    case "LineChart": {
      const { styles, ...rest } = node;
      transformed = {
        classes: Object.entries(styles).reduce((acc, [k, s]) => {
          acc[k as keyof yom.LineChartClasses] = styleToClass(s, false);
          return acc;
        }, {} as yom.LineChartClasses),
        ...rest,
      };
      break;
    }
    case "BarChart": {
      const { styles, ...rest } = node;
      transformed = {
        classes: Object.entries(styles).reduce((acc, [k, s]) => {
          acc[k as keyof yom.BarChartClasses] = styleToClass(s, false);
          return acc;
        }, {} as yom.BarChartClasses),
        ...rest,
      };
      break;
    }
    case "PieChart": {
      const { styles, ...rest } = node;
      transformed = {
        classes: Object.entries(styles).reduce((acc, [k, s]) => {
          acc[k as keyof yom.PieChartClasses] = styleToClass(s, false);
          return acc;
        }, {} as yom.PieChartClasses),
        ...rest,
      };
      break;
    }
    case "DataGrid":
      transformed = {
        t: "DataGrid",
        columns: node.columns.map((col) => ({
          header: transformNode(col.header, styleToClass),
          cell: transformNode(col.cell, styleToClass),
          width: col.width,
          ordering: col.ordering,
          visible: col.visible,
        })),
        classes: {
          cell: styleToClass(node.styles.cell, false),
          header: styleToClass(node.styles.header, false),
          headerCell: styleToClass(node.styles.headerCell, false),
          root: styleToClass(node.styles.root, false),
          row: styleToClass(node.styles.row, false),
        },
        headerHeight: node.headerHeight,
        recordName: node.recordName,
        rowHeight: node.rowHeight,
        table: node.table,
        tableKey: node.tableKey,
        focusedColumn: node.focusedColumn,
        focusedRow: node.focusedRow,
        shouldFocusCell: node.shouldFocusCell,
        on: node.on,
      };
      break;
    default:
      console.log(node);
      throw new Error("Invalid node");
  }
  transformedNodes.set(node, transformed);
  return transformed;
}
