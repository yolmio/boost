import type * as ui from "./nodeTypes.js";
import type * as yom from "./yom.js";

export function each(props: Omit<ui.EachNode, "t">): ui.EachNode {
  return { t: "Each", ...props };
}

export function state(props: Omit<ui.StateNode, "t">): ui.StateNode {
  return { t: "State", ...props };
}

export function mode(props: Omit<ui.ModeNode, "t">): ui.ModeNode {
  return { t: "Mode", ...props };
}

export function ifNode(
  expr: string,
  then: ui.Node,
  else_?: ui.Node
): ui.IfNode {
  return { t: "If", expr, then, else: else_ };
}

export function switchNode(
  ...cases: [string, ui.Node | undefined][]
): ui.SwitchNode {
  return {
    t: "Switch",
    cases: cases.map(([condition, node]) => ({ condition, node })),
  };
}

export function route(props: Omit<ui.RouteNode, "t">): ui.RouteNode {
  return { t: "Route", ...props };
}

export function routes(...routes: ui.RouteNode[]): ui.RoutesNode {
  return { t: "Routes", children: routes };
}

export function portal(children: ui.Node): ui.PortalNode {
  return { t: "Portal", children };
}

export function queryParams(
  params: yom.QueryParam[],
  children: ui.Node
): ui.QueryParamsNode {
  return {
    t: "QueryParams",
    params,
    children,
  };
}

export function element(
  tag: yom.AllHtmlTags,
  el: Omit<ui.ElementNode, "t" | "tag">
): ui.ElementNode {
  return { t: "Element", tag, ...el };
}

export function dataGrid(opts: Omit<ui.DataGridNode, "t">): ui.DataGridNode {
  return { t: "DataGrid", ...opts };
}

export function eventHandlers(
  node: Omit<yom.EventHandlersNode, "t">
): yom.EventHandlersNode {
  return { t: "EventHandlers", ...node };
}

export function sourceMap(source: string, children: ui.Node): ui.SourceMapNode {
  return { t: "SourceMap", source, children };
}
