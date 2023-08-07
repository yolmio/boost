import type * as yom from "./yom";
import type { Style } from "./styleTypes";

export type Node =
  | string
  | (Node | null | undefined)[]
  | EachNode
  | IfNode
  | SwitchNode
  | StateNode
  | ModeNode
  | RouteNode
  | RoutesNode
  | PortalNode
  | ElementNode
  | QueryParamsNode
  | LineChartNode
  | BarChartNode
  | PieChartNode
  | DataGridNode
  | SourceMapNode
  | yom.EventHandlersNode;

export type EachNode = Omit<yom.EachNode, "children"> & { children: Node };
export type StateNode = Omit<yom.StateNode, "children"> & { children: Node };
export type ModeNode = Omit<yom.ModeNode, "children"> & { children: Node };
export type RouteNode = Omit<yom.RouteNode, "children"> & { children: Node };
export type PortalNode = Omit<yom.PortalNode, "children"> & { children: Node };
export type QueryParamsNode = Omit<yom.QueryParamsNode, "children"> & {
  children: Node;
};
export type IfNode = Omit<yom.IfNode, "then" | "else"> & {
  then?: Node;
  else?: Node;
};
export type SourceMapNode = Omit<yom.SourceMapNode, "children"> & {
  children: Node;
};

export interface SwitchNode {
  t: "Switch";
  cases: SwitchNodeCase[];
}

export interface SwitchNodeCase {
  condition: string;
  node?: Node;
}

export interface RoutesNode {
  t: "Routes";
  children: RouteNode[];
}

export type DataGridStyles = {
  [K in keyof yom.DataGridNode["classes"]]?: Style;
};

export type DataGridNode = Omit<yom.DataGridNode, "columns" | "classes"> & {
  columns: DataGridColumn[];
  styles: DataGridStyles;
};

export interface DataGridColumn {
  header: Node;
  cell: Node;
  width: string;
  ordering?: string;
  visible?: string;
}

export type ElementNode = Omit<yom.ElementNode, "children"> & {
  styles?: Style;
  children?: Node;
};

export type PartialElNode = Partial<ElementNode>;

export type LineChartNode = Omit<yom.LineChartNode, "classes"> & {
  styles: { [K in keyof yom.LineChartClasses]: Style };
};

export type BarChartNode = Omit<yom.BarChartNode, "classes"> & {
  styles: { [K in keyof yom.BarChartClasses]: Style };
};

export type PieChartNode = Omit<yom.PieChartNode, "classes"> & {
  styles: { [K in keyof yom.PieChartClasses]: Style };
};
