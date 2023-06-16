import { element } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { Style, StyleObject } from "../styleTypes.js";
import { SequentialIDGenerator } from "../utils/SequentialIdGenerator.js";
import {
  AllHtmlTags,
  DynamicClass,
  ElementEventHandlers,
  ElementProps,
  EventHandler,
  FloatingOpts,
  ScrollLockOpts,
} from "../yom.js";

export interface SlottedComponentOpts extends SingleElementComponentOpts {
  slots?: Record<string, SingleElementComponentOpts>;
}

export type SlottedComponentWithSlotNames<T extends string> =
  SingleElementComponentOpts & {
    slots?: Partial<Record<T, SingleElementComponentOpts>>;
  };

/** Options for a component concerned with only a single component */
export interface SingleElementComponentOpts {
  tag?: AllHtmlTags;
  props?: ElementProps;
  styles?: Style;
  testId?: string;
  dynamicClasses?: DynamicClass[];
  floating?: FloatingOpts;
  focusLock?: {};
  scrollLock?: ScrollLockOpts;
  on?: ElementEventHandlers;
  style?: Record<string, string>;
}

const mergeStyleCache = new WeakMap<object, WeakMap<object, Style>>();

function mergeStyle(
  base: Style | undefined,
  ovewrite: Style | undefined
): Style | undefined {
  if (!base) {
    return ovewrite;
  }
  if (!ovewrite) {
    return base;
  }
  if (mergeStyleCache.has(base)) {
    const baseCache = mergeStyleCache.get(base)!;
    if (baseCache.has(ovewrite)) {
      return baseCache.get(ovewrite)!;
    }
    const merged = [base, ovewrite];
    baseCache.set(ovewrite, merged);
    return merged;
  }
  const merged = [base, ovewrite];
  const baseCache = new WeakMap();
  baseCache.set(ovewrite, merged);
  mergeStyleCache.set(base, baseCache);
  return merged;
}

export interface SingleElementComponentBase extends SingleElementComponentOpts {
  tag: AllHtmlTags;
  children?: Node;
}

export function mergeEls(
  opts: SingleElementComponentBase,
  overwriteOpts: SingleElementComponentOpts = {}
) {
  return element(overwriteOpts.tag ?? opts.tag, {
    props: { ...opts.props, ...overwriteOpts.props },
    styles: overwriteOpts.styles
      ? mergeStyle(opts.styles, overwriteOpts.styles)
      : opts.styles,
    dynamicClasses: overwriteOpts.dynamicClasses
      ? [
          ...(overwriteOpts.dynamicClasses ?? []),
          ...(opts.dynamicClasses ?? []),
        ]
      : opts.dynamicClasses,
    testId: overwriteOpts.testId ?? opts.testId,
    floating: overwriteOpts.floating ?? opts.floating,
    focusLock: overwriteOpts.focusLock ?? opts.focusLock,
    scrollLock: overwriteOpts.scrollLock
      ? { ...opts.scrollLock, ...overwriteOpts.scrollLock }
      : opts.scrollLock,
    style: overwriteOpts.style
      ? { ...opts.style, ...overwriteOpts.style }
      : opts.style,
    on: mergeElEventHandlers(opts.on ?? {}, overwriteOpts.on ?? {}),
    children: opts.children,
  });
}

export type SlotFn<T> = (slot: T, opts: SingleElementComponentBase) => Node;

export function createSlotsFn<T extends SlottedComponentOpts>(
  overwrite: T
): SlotFn<keyof NonNullable<T["slots"]> | "root"> {
  return (
    slot: keyof NonNullable<T["slots"]> | "root",
    opts: SingleElementComponentBase
  ) => {
    if (slot === "root") {
      return mergeEls(opts, overwrite);
    }
    return mergeEls(opts, (overwrite.slots as any)?.[slot] ?? {});
  };
}

export function mergeElEventHandlers(
  a: ElementEventHandlers,
  b: ElementEventHandlers
) {
  const newHandlers: ElementEventHandlers = {};
  for (const [key, value] of Object.entries(a)) {
    const typedKey = key as keyof ElementEventHandlers;
    if (key in b) {
      newHandlers[typedKey] = mergeEventHandler(value, b[typedKey]!);
    } else {
      newHandlers[typedKey] = value;
    }
  }
  for (const [key, value] of Object.entries(b)) {
    if (!(key in a)) {
      newHandlers[key as keyof ElementEventHandlers] = value;
    }
  }
  return newHandlers;
}

export function mergeEventHandler(
  a: EventHandler,
  b: EventHandler
): EventHandler {
  if (Array.isArray(a)) {
    if (Array.isArray(b)) {
      return [...a, ...b];
    }
    const newHandler = { ...b };
    newHandler.procedure = [...a, ...b.procedure];
    return newHandler;
  }
  if (Array.isArray(b)) {
    const newHandler = { ...a };
    newHandler.procedure = [...a.procedure, ...b];
    return newHandler;
  }
  return {
    detachedFromNode: a.detachedFromNode || b.detachedFromNode,
    procedure: [...a.procedure, ...b.procedure],
  };
}

const componentOverwrite = new Map<string, (...args: any[]) => Node>();

export function addComponentOverwrite(
  name: string,
  overwrite: (...args: any[]) => Node
) {
  componentOverwrite.set(name, overwrite);
}

export function getComponentOverwrite(name: string) {
  return componentOverwrite.get(name);
}

const uniqueUiIdGenerator = new SequentialIDGenerator();

export function getUniqueUiId() {
  return uniqueUiIdGenerator.next();
}
