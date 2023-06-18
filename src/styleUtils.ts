import { theme } from "./singleton.js";
import type { Style, StyleObject } from "./styleTypes.js";
import type { ColorPaletteProp, CssVar, Variant } from "./theme.js";
import { lazy, memoize } from "./utils/memoize.js";

export function cssVar(n: CssVar): string {
  return `var(--${n})`;
}

export const lightSchemeSelector = 'html[data-yolm-color-scheme="light"]';
export const darkSchemeSelector = 'html[data-yolm-color-scheme="dark"]';

export function getVariantStyle(
  variant: Variant,
  color: ColorPaletteProp | "harmonize",
  state?: "hover" | "disabled" | "active"
): StyleObject {
  const stateStr = typeof state === "string" ? "-" + state : "";
  const props: any = {};
  if (color === "harmonize") {
    props.color = `var(--harmonize-${variant}${stateStr}-color)`;
    props.backgroundColor = `var(--harmonize-${variant}${stateStr}-bg)`;
  } else {
    props.color = `var(--palette-${color}-${variant}${stateStr}-color)`;
    props.backgroundColor = `var(--palette-${color}-${variant}${stateStr}-bg)`;
  }
  if (state === "hover") {
    props.cursor = "pointer";
  }
  if (variant === "outlined") {
    props["--variant-border-width"] = "1px";
    props.border = "var(--variant-border-width) solid";
    if (color == "harmonize") {
      props.borderColor = `var(--harmonize-${variant}${stateStr}-border)`;
    } else {
      props.borderColor = `var(--palette-${color}-${variant}${stateStr}-border)`;
    }
  }
  return props;
}

export function createHarmonizeVars(
  variant: "soft" | "solid",
  color: ColorPaletteProp
) {
  return variant === "soft"
    ? createSoftHarmonizeVars(color)
    : createSolidHarmonizeVars(color);
}

export function createSoftHarmonizeVars(color: ColorPaletteProp): StyleObject {
  return {
    "--badge-ring-color": cssVar(`palette-${color}-soft-bg`),
    [lightSchemeSelector + " &"]: {
      "--palette-focus-visible": cssVar(`palette-${color}-500`),
      "--palette-background-body": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.1)`,
      "--palette-background-surface": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.08)`,
      "--palette-background-level1": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.2)`,
      "--palette-background-level2": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.32)`,
      "--palette-background-level3": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.48)`,
      "--palette-text-primary": cssVar(`palette-${color}-700`),
      "--palette-text-secondary": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.8)`,
      "--palette-text-tertiary": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.68)`,
      "--palette-divider": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.32)`,

      "--harmonize-plain-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 1)`,
      "--harmonize-plain-bg": `transparent`,
      "--harmonize-plain-hover-color": cssVar(`palette-${color}-600`),
      "--harmonize-plain-hover-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.12)`,
      "--harmonize-plain-active-color": cssVar(`palette-${color}-600`),
      "--harmonize-plain-active-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.24)`,
      "--harmonize-plain-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.6)`,
      "--harmonize-plain-disabled-bg": `transparent`,

      "--harmonize-outlined-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 1)`,
      "--harmonize-outlined-border": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.4)`,
      "--harmonize-outlined-bg": `transparent`,
      "--harmonize-outlined-hover-color": cssVar(`palette-${color}-600`),
      "--harmonize-outlined-hover-border": cssVar(`palette-${color}-300`),
      "--harmonize-outlined-hover-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.12)`,
      "--harmonize-outlined-active-color": cssVar(`palette-${color}-600`),
      "--harmonize-outlined-active-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.24)`,
      "--harmonize-outlined-active-border": cssVar(`palette-${color}-300`),
      "--harmonize-outlined-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.6)`,
      "--harmonize-outlined-disabled-border": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.12)`,
      "--harmonize-outlined-disabled-bg": `transparent`,

      "--harmonize-soft-color": cssVar(`palette-${color}-600`),
      "--harmonize-soft-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.72)`,
      "--harmonize-soft-hover-color": cssVar(`palette-${color}-700`),
      "--harmonize-soft-hover-bg": cssVar(`palette-${color}-200`),
      "--harmonize-soft-active-bg": cssVar(`palette-${color}-300`),
      "--harmonize-soft-active-color": cssVar(`palette-${color}-700`),
      "--harmonize-soft-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.6)`,
      "--harmonize-soft-disabled-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.08)`,

      "--harmonize-solid-color": cssVar("palette-common-white"),
      "--harmonize-solid-bg": cssVar(`palette-${color}-600`),
      "--harmonize-solid-hover-color": cssVar("palette-common-white"),
      "--harmonize-solid-hover-bg": cssVar(`palette-${color}-700`),
      "--harmonize-solid-active-color": cssVar("palette-common-white"),
      "--harmonize-solid-active-bg": cssVar(`palette-${color}-800`),
      "--harmonize-solid-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.6)`,
      "--harmonize-solid-disabled-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.08)`,
    },
    [darkSchemeSelector + " &"]: {
      "--palette-focusVisible": cssVar(`palette-${color}-300`),
      "--palette-background-body": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.1)`,
      "--palette-background-surface": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.08)`,
      "--palette-background-level1": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.2)`,
      "--palette-background-level2": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.4)`,
      "--palette-background-level3": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.6)`,
      "--palette-text-primary": cssVar(`palette-${color}-100`),
      "--palette-text-secondary": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.72)`,
      "--palette-text-tertiary": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.6)`,
      "--palette-divider": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.2)`,

      "--harmonize-plain-color": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 1)`,
      "--harmonize-plain-bg": `transparent`,
      "--harmonize-plain-hover-color": cssVar(`palette-${color}-50`),
      "--harmonize-plain-hover-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.16)`,
      "--harmonize-plain-active-color": cssVar(`palette-${color}-50`),
      "--harmonize-plain-active-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.32)`,
      "--harmonize-plain-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.72)`,
      "--harmonize-plain-disabled-bg": `transparent`,

      "--harmonize-outlined-color": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 1)`,
      "--harmonize-outlined-bg": "initial",
      "--harmonize-outlined-border": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.4)`,
      "--harmonize-outlined-hover-color": cssVar(`palette-${color}-50`),
      "--harmonize-outlined-hover-border": cssVar(`palette-${color}-600`),
      "--harmonize-outlined-hover-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.16)`,
      "--harmonize-outlined-active-color": cssVar(`palette-${color}-50`),
      "--harmonize-outlined-active-border": cssVar(`palette-${color}-600`),
      "--harmonize-outlined-active-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.32)`,
      "--harmonize-outlined-disabled-bg": `transparent`,
      "--harmonize-outlined-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.72)`,
      "--harmonize-outlined-disabled-border": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.2)`,

      "--harmonize-soft-color": cssVar(`palette-${color}-100`),
      "--harmonize-soft-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.24)`,
      "--harmonize-soft-hover-color": "#fff",
      "--harmonize-soft-hover-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.32)`,
      "--harmonize-soft-active-color": "#fff",
      "--harmonize-soft-active-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.48)`,
      "--harmonize-soft-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.72)`,
      "--harmonize-soft-disabled-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.12)`,

      "--harmonize-solid-color": "#fff",
      "--harmonize-solid-bg": cssVar(`palette-${color}-500`),
      "--harmonize-solid-hover-color": "#fff",
      "--harmonize-solid-hover-bg": cssVar(`palette-${color}-500`),
      "--harmonize-solid-active-color": "#fff",
      "--harmonize-solid-active-bg": cssVar(`palette-${color}-600`),
      "--harmonize-solid-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.72)`,
      "--harmonize-solid-disabled-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.12)`,
    },
  };
}

export function createSolidHarmonizeVars(color: ColorPaletteProp): StyleObject {
  if (color === "warning") {
    return {
      "--badge-ring-color": cssVar(`palette-${color}-solid-bg`),
      "--palette-focus-visible": cssVar(`palette-${color}-700`),
      "--palette-background-body": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.16)`,
      "--palette-background-surface": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.1)`,
      "--palette-background-popup": cssVar(`palette-${color}-100`),
      "--palette-background-level1": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.2)`,
      "--palette-background-level2": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.36)`,
      "--palette-background-level3": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.6)`,
      "--palette-text-primary": cssVar(`palette-${color}-900`),
      "--palette-text-secondary": cssVar(`palette-${color}-700`),
      "--palette-text-tertiary": cssVar(`palette-${color}-500`),
      "--palette-divider": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.2)`,

      "--harmonize-plain-bg": `transparent`,
      "--harmonize-plain-color": cssVar(`palette-${color}-700`),
      "--harmonize-plain-hover-color": cssVar(`palette-${color}-800`),
      "--harmonize-plain-hover-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.12)`,
      "--harmonize-plain-active-color": cssVar(`palette-${color}-800`),
      "--harmonize-plain-active-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.32)`,
      "--harmonize-plain-disabled-bg": `transparent`,
      "--harmonize-plain-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.72)`,

      "--harmonize-outlined-bg": `transparent`,
      "--harmonize-outlined-color": cssVar(`palette-${color}-700`),
      "--harmonize-outlined-border": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.5)`,
      "--harmonize-outlined-hover-color": cssVar(`palette-${color}-800`),
      "--harmonize-outlined-hover-border": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.6)`,
      "--harmonize-outlined-hover-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.12)`,
      "--harmonize-outlined-active-color": cssVar(`palette-${color}-800`),
      "--harmonize-outlined-active-border": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.6)`,
      "--harmonize-outlined-active-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.32)`,
      "--harmonize-outlined-disabled-bg": `transparent`,
      "--harmonize-outlined-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.72)`,
      "--harmonize-outlined-disabled-border": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.2)`,

      "--harmonize-soft-color": cssVar(`palette-${color}-800`),
      "--harmonize-soft-hover-color": cssVar(`palette-${color}-900`),
      "--harmonize-soft-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.2)`,
      "--harmonize-soft-hover-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.28)`,
      "--harmonize-soft-active-color": cssVar(`palette-${color}-900`),
      "--harmonize-soft-active-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.12)`,
      "--harmonize-soft-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.72)`,
      "--harmonize-soft-disabled-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.08)`,

      "--harmonize-solid-color": "#fff",
      "--harmonize-solid-bg": cssVar(`palette-${color}-700`),
      "--harmonize-solid-hover-color": "#fff",
      "--harmonize-solid-hover-bg": cssVar(`palette-${color}-800`),
      "--harmonize-solid-active-color": "#fff",
      "--harmonize-solid-active-bg": cssVar(`palette-${color}-600`),
      "--harmonize-solid-disabled-color": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.72)`,
      "--harmonize-solid-disabled-bg": `rgba(${cssVar(
        `palette-${color}-main-channel`
      )} / 0.08)`,
    };
  } else {
    return {
      "--badge-ring-color": cssVar(`palette-${color}-solid-bg`),
      "--palette-focus-visible": cssVar(`palette-${color}-200`),
      "--palette-background-body": "rgba(0 0 0 / 0.1)",
      "--palette-background-surface": "rgba(0 0 0 / 0.06)",
      "--palette-background-popup": cssVar(`palette-${color}-700`),
      "--palette-background-level1": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.2)`,
      "--palette-background-level2": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.36)`,
      "--palette-background-level3": `rgba(${cssVar(
        `palette-${color}-dark-channel`
      )} / 0.6)`,
      "--palette-text-primary": cssVar(`palette-common-white`),
      "--palette-text-secondary": cssVar(`palette-${color}-100`),
      "--palette-text-tertiary": cssVar(`palette-${color}-200`),
      "--palette-divider": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.32)`,

      "--harmonize-plain-bg": "transparent",
      "--harmonize-plain-color": cssVar(`palette-${color}-50`),
      "--harmonize-plain-hover-color": `#fff`,
      "--harmonize-plain-hover-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.12)`,
      "--harmonize-plain-active-color": `#fff`,
      "--harmonize-plain-active-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.32)`,
      "--harmonize-plain-disabled-bg": "transparent",
      "--harmonize-plain-disabled-color": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.72)`,

      "--harmonize-outlined-color": cssVar(`palette-${color}-50`),
      "--harmonize-outlined-bg": "transparent",
      "--harmonize-outlined-border": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.5)`,
      "--harmonize-outlined-hover-color": `#fff`,
      "--harmonize-outlined-hover-border": cssVar(`palette-${color}-300`),
      "--harmonize-outlined-hover-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.12)`,
      "--harmonize-outlined-active-color": `#fff`,
      "--harmonize-outlined-active-border": cssVar(`palette-${color}-300`),
      "--harmonize-outlined-active-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.32)`,
      "--harmonize-outlined-disabled-bg": "transparent",
      "--harmonize-outlined-disabled-color": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.72)`,
      "--harmonize-outlined-disabled-border": `rgba(255 255 255 / 0.2)`,

      "--harmonize-soft-color": cssVar(`palette-common-white`),
      "--harmonize-soft-hover-color": cssVar(`palette-common-white`),
      "--harmonize-soft-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.24)`,
      "--harmonize-soft-hover-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.36)`,
      "--harmonize-soft-active-color": cssVar(`palette-common-white`),
      "--harmonize-soft-active-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.16)`,
      "--harmonize-soft-disabled-color": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.72)`,
      "--harmonize-soft-disabled-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.1)`,

      "--harmonize-solid-color": cssVar(`palette-${color}-700`),
      "--harmonize-solid-bg": cssVar(`palette-common-white`),
      "--harmonize-solid-hover-color": cssVar(`palette-${color}-900`),
      "--harmonize-solid-hover-bg": cssVar(`palette-${color}-100`),
      "--harmonize-solid-active-color": cssVar(`palette-${color}-900`),
      "--harmonize-solid-active-bg": cssVar(`palette-${color}-200`),
      "--harmonize-solid-disabled-color": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.72)`,
      "--harmonize-solid-disabled-bg": `rgba(${cssVar(
        `palette-${color}-light-channel`
      )} / 0.1)`,
    };
  }
}

//

export const containerStyles = lazy(() => {
  return {
    width: "100%",
    mx: "auto",
    px: 2,
    sm: {
      maxWidth: theme.breakpoints.values.sm,
    },
    md: {
      maxWidth: theme.breakpoints.values.md,
    },
    lg: {
      maxWidth: theme.breakpoints.values.lg,
    },
    xl: {
      maxWidth: theme.breakpoints.values.xl,
    },
  };
});

type OneToTwelve = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

type SpanType = OneToTwelve | "full";
type StartEndType = OneToTwelve | "auto";

export interface BaseGridItemDescription {
  colSpan?: SpanType;
  colStart?: StartEndType;
  colEnd?: StartEndType;

  rowSpan?: SpanType;
  rowStart?: StartEndType;
  rowEnd?: StartEndType;

  justifySelf?: "auto" | "start" | "end" | "center" | "stretch";
  alignSelf?:
    | "auto"
    | "flex-start"
    | "flex-end"
    | "center"
    | "stretch"
    | "baseline";
}

export interface GridItemDescription extends BaseGridItemDescription {
  xs?: BaseGridItemDescription;
  sm?: BaseGridItemDescription;
  md?: BaseGridItemDescription;
  lg?: BaseGridItemDescription;
  xl?: BaseGridItemDescription;
}

const transformBaseGridItemDescription = memoize(
  (desc: BaseGridItemDescription): StyleObject => {
    const obj: StyleObject = {
      justifySelf: desc.justifySelf,
      alignSelf: desc.alignSelf,
    };
    if (desc.colSpan) {
      obj.gridColumn =
        desc.colSpan === "full"
          ? "1 / -1"
          : `span ${desc.colSpan} / span ${desc.colSpan}`;
    }
    if (desc.colStart) {
      obj.gridColumnStart = desc.colStart.toString();
    }
    if (desc.colEnd) {
      obj.gridColumnEnd = desc.colEnd.toString();
    }
    if (desc.rowSpan) {
      obj.gridRow =
        desc.rowSpan === "full"
          ? "1 / -1"
          : `span ${desc.rowSpan} / span ${desc.rowSpan}`;
    }
    if (desc.rowStart) {
      obj.gridRowStart = desc.rowStart.toString();
    }
    if (desc.rowEnd) {
      obj.gridRowEnd = desc.rowEnd.toString();
    }
    return obj;
  }
);

const transformGridItemStyles = memoize((desc: GridItemDescription) => {
  const styles = transformBaseGridItemDescription(desc);
  if (desc.xs) {
    (styles as any).xs = transformBaseGridItemDescription(desc.xs);
  }
  if (desc.sm) {
    (styles as any).sm = transformBaseGridItemDescription(desc.sm);
  }
  if (desc.md) {
    (styles as any).md = transformBaseGridItemDescription(desc.md);
  }
  if (desc.lg) {
    (styles as any).lg = transformBaseGridItemDescription(desc.lg);
  }
  if (desc.xl) {
    (styles as any).xl = transformBaseGridItemDescription(desc.xl);
  }
  return styles;
});

export function getGridItemStyles(description: GridItemDescription) {
  function extractBaseGridItemDescription(
    v: BaseGridItemDescription
  ): BaseGridItemDescription {
    return {
      colSpan: v.colSpan,
      colStart: v.colStart,
      colEnd: v.colEnd,
      rowSpan: v.rowSpan,
      rowStart: v.rowStart,
      rowEnd: v.rowEnd,
      justifySelf: v.justifySelf,
      alignSelf: v.alignSelf,
    };
  }
  const extracted: GridItemDescription =
    extractBaseGridItemDescription(description);
  if (description.xs) {
    extracted.xs = extractBaseGridItemDescription(description.xs);
  }
  if (description.sm) {
    extracted.sm = extractBaseGridItemDescription(description.sm);
  }
  if (description.md) {
    extracted.md = extractBaseGridItemDescription(description.md);
  }
  if (description.lg) {
    extracted.lg = extractBaseGridItemDescription(description.lg);
  }
  if (description.xl) {
    extracted.xl = extractBaseGridItemDescription(description.xl);
  }
  return transformGridItemStyles(extracted);
}

export interface BaseGridDescription {
  gridGap?: number;
  gridGapX?: number;
  gridGapY?: number;
}

export interface GridDescription extends BaseGridDescription {
  xs?: BaseGridDescription;
  sm?: BaseGridDescription;
  md?: BaseGridDescription;
  lg?: BaseGridDescription;
  xl?: BaseGridDescription;
}

const transformBaseGridDescription = memoize(
  (desc: BaseGridDescription): StyleObject => {
    return {
      gap: desc.gridGap,
      columnGap: desc.gridGapX,
      rowGap: desc.gridGapY,
    };
  }
);

const transformGridStyles = memoize((desc: GridDescription) => {
  const styles = transformBaseGridDescription(desc);
  if (desc.xs) {
    (styles as any).xs = transformBaseGridDescription(desc.xs);
  }
  if (desc.sm) {
    (styles as any).sm = transformBaseGridDescription(desc.sm);
  }
  if (desc.md) {
    (styles as any).md = transformBaseGridDescription(desc.md);
  }
  if (desc.lg) {
    (styles as any).lg = transformBaseGridDescription(desc.lg);
  }
  if (desc.xl) {
    (styles as any).xl = transformBaseGridDescription(desc.xl);
  }
  return styles;
});

const gridConstStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
};

export function getGridStyles(description: GridDescription) {
  function extractBaseGridDescription(
    v: BaseGridDescription
  ): BaseGridDescription {
    return {
      gridGap: v.gridGap,
      gridGapX: v.gridGapX,
      gridGapY: v.gridGapY,
    };
  }
  const extracted: GridDescription = extractBaseGridDescription(description);
  if (description.xs) {
    extracted.xs = extractBaseGridDescription(description.xs);
  }
  if (description.sm) {
    extracted.sm = extractBaseGridDescription(description.sm);
  }
  if (description.md) {
    extracted.md = extractBaseGridDescription(description.md);
  }
  if (description.lg) {
    extracted.lg = extractBaseGridDescription(description.lg);
  }
  if (description.xl) {
    extracted.xl = extractBaseGridDescription(description.xl);
  }
  return [gridConstStyles, transformGridStyles(extracted)];
}

export const baseGridStyles: StyleObject = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
};
export const flexGrowStyles: StyleObject = { flexGrow: 1 };
export const visibilityHidden: StyleObject = { visibility: "hidden" };
export const displayNoneStyles: StyleObject = { display: "none" };
export const visuallyHiddenStyles: StyleObject = {
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
  "&:not(caption)": {
    position: "absolute",
  },
};

export type Styles = Record<string, Style | ((...args: any[]) => Style)>;

export function createStyles<T extends Styles>(styles: T): T {
  const output: Styles = {};
  for (const [key, value] of Object.entries(styles)) {
    if (typeof value === "function") {
      output[key] = memoize(value);
    } else {
      output[key] = value;
    }
  }
  return output as T;
}
