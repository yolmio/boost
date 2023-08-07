import { nodes, HelperEventHandlers, HelperEventHandler } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import {
  BasicStatements,
  DomStatements,
  DomStatementsOrFn,
} from "../statements";
import { Style } from "../styleTypes";
import { SequentialIDGenerator } from "../utils/SequentialIdGenerator";
import * as yom from "../yom";

export interface SlottedComponentOpts extends SingleElementComponentOpts {
  slots?: Record<string, SingleElementComponentOpts>;
}

export type SlottedComponentWithSlotNames<T extends string> =
  SingleElementComponentOpts & {
    slots?: Partial<Record<T, SingleElementComponentOpts>>;
  };

/** Options for a component concerned with only a single component */
export interface SingleElementComponentOpts {
  tag?: yom.AllHtmlTags;
  props?: yom.ElementProps;
  styles?: Style;
  testId?: string;
  dynamicClasses?: yom.DynamicClass[];
  floating?: yom.FloatingOpts;
  focusLock?: {};
  scrollLock?: yom.ScrollLockOpts;
  on?: HelperEventHandlers;
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
  tag: yom.AllHtmlTags;
  children?: Node;
}

export function mergeEls(
  opts: SingleElementComponentBase,
  overwriteOpts: SingleElementComponentOpts = {}
) {
  return nodes.element(overwriteOpts.tag ?? opts.tag, {
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
  a: HelperEventHandlers,
  b: HelperEventHandlers
) {
  const newHandlers: HelperEventHandlers = {};
  for (const [key, value] of Object.entries(a)) {
    const typedKey = key as keyof HelperEventHandlers;
    if (key in b) {
      newHandlers[typedKey] = mergeEventHandler(value, b[typedKey]!);
    } else {
      newHandlers[typedKey] = value;
    }
  }
  for (const [key, value] of Object.entries(b)) {
    if (!(key in a)) {
      newHandlers[key as keyof HelperEventHandlers] = value;
    }
  }
  return newHandlers;
}

function mergeEventHandlerProc(a: DomStatementsOrFn, b: DomStatementsOrFn) {
  return (s: DomStatements) => s.statements(a).statements(b);
}

export function mergeEventHandler(
  a: HelperEventHandler,
  b: HelperEventHandler
): HelperEventHandler {
  if (
    typeof a === "function" ||
    a instanceof DomStatements ||
    a instanceof BasicStatements
  ) {
    if (
      typeof b === "function" ||
      b instanceof DomStatements ||
      b instanceof BasicStatements
    ) {
      return mergeEventHandlerProc(a, b);
    }
    const newHandler = { ...b };
    newHandler.procedure = mergeEventHandlerProc(a, b.procedure);
    return newHandler;
  }
  if (
    typeof b === "function" ||
    b instanceof DomStatements ||
    b instanceof BasicStatements
  ) {
    const newHandler = { ...a };
    newHandler.procedure = mergeEventHandlerProc(a.procedure, b);
    return newHandler;
  }
  return {
    detachedFromNode: a.detachedFromNode || b.detachedFromNode,
    procedure: mergeEventHandlerProc(a.procedure, b.procedure),
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
