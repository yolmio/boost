import type * as ui from "./nodeTypes";
import {
  BasicStatements,
  DomStatements,
  DomStatementsOrFn,
  StateStatements,
  StateStatementsOrFn,
} from "./statements";
import type * as yom from "./yom";

function each(props: Omit<ui.EachNode, "t">): ui.EachNode {
  return { t: "Each", ...props };
}

interface StateNodeOpts extends Omit<ui.StateNode, "t" | "procedure"> {
  procedure: StateStatementsOrFn;
}

function state(props: StateNodeOpts): ui.StateNode {
  return {
    t: "State",
    ...props,
    procedure: StateStatements.normalizeToArray(props.procedure),
  };
}

function mode(props: Omit<ui.ModeNode, "t">): ui.ModeNode {
  return { t: "Mode", ...props };
}

function if_(expr: string, then: ui.Node): ui.IfNode;
function if_(opts: Omit<ui.IfNode, "t">): ui.IfNode;
function if_(expr: string | Omit<ui.IfNode, "t">, then?: ui.Node): ui.IfNode {
  if (typeof expr === "string") {
    return { t: "If", expr, then };
  }
  return { t: "If", expr: expr.expr, then: expr.then, else: expr.else };
}

function switch_(
  ...cases: { condition: string; node: ui.Node | undefined }[]
): ui.SwitchNode {
  return {
    t: "Switch",
    cases: cases,
  };
}

function route(props: Omit<ui.RouteNode, "t">): ui.RouteNode {
  return { t: "Route", ...props };
}

function routes(...routes: ui.RouteNode[]): ui.RoutesNode {
  return { t: "Routes", children: routes };
}

function portal(children: ui.Node): ui.PortalNode {
  return { t: "Portal", children };
}

function queryParams(
  params: yom.QueryParam[],
  children: ui.Node
): ui.QueryParamsNode {
  return {
    t: "QueryParams",
    params,
    children,
  };
}

export type HelperEventHandler = DomStatementsOrFn | HelperEventHandlerObject;

export interface HelperEventHandlerObject
  extends Omit<yom.EventHandlerObject, "procedure"> {
  procedure: DomStatementsOrFn;
}

export type HelperEventHandlers = Partial<
  Record<yom.EventHandlerName, HelperEventHandler>
>;

interface ElementOpts extends Omit<ui.ElementNode, "t" | "tag" | "on"> {
  on?: HelperEventHandlers;
}

function normalizeEventHandler(
  helper: HelperEventHandler | undefined
): yom.EventHandler | undefined {
  if (!helper) {
    return undefined;
  }
  if (typeof helper === "function") {
    return DomStatements.normalizeToArray(helper);
  } else if (
    helper instanceof DomStatements ||
    helper instanceof BasicStatements
  ) {
    return DomStatements.normalizeToArray(helper);
  } else {
    return {
      ...helper,
      procedure: DomStatements.normalizeToArray(helper.procedure),
    };
  }
}

function normalizeEventHandlers(
  helper: HelperEventHandlers | undefined
): yom.ElementEventHandlers | undefined {
  if (!helper) {
    return undefined;
  }
  const result: yom.ElementEventHandlers = {};
  for (const [k, v] of Object.entries(helper)) {
    result[k as yom.EventHandlerName] = normalizeEventHandler(v);
  }
  return result;
}

function element(tag: yom.AllHtmlTags, el: ElementOpts): ui.ElementNode {
  return {
    t: "Element",
    tag,
    ...el,
    on: normalizeEventHandlers(el.on),
  };
}

function dataGrid(opts: Omit<ui.DataGridNode, "t">): ui.DataGridNode {
  return { t: "DataGrid", ...opts };
}

interface EventHandlersOpts {
  window?: HelperEventHandlers;
  document?: HelperEventHandlers;
  mount?: HelperEventHandler;
}

function eventHandlers(opts: EventHandlersOpts): yom.EventHandlersNode {
  return {
    t: "EventHandlers",
    window: normalizeEventHandlers(opts.window),
    document: normalizeEventHandlers(opts.document),
    mount: normalizeEventHandler(opts.mount),
  };
}

function sourceMap(source: string, children: ui.Node): ui.SourceMapNode {
  return { t: "SourceMap", source, children };
}

export const nodes = {
  each,
  state,
  mode,
  if: if_,
  switch: switch_,
  route,
  routes,
  portal,
  queryParams,
  element,
  dataGrid,
  eventHandlers,
  sourceMap,
};
