import { Node } from "../../nodeTypes";
import { BasicStatements, DomStatementsOrFn } from "../../statements";

export interface CellProps {
  value: string;
  editing: string;
  recordId: string;
  row: string;
  column: string;
  setValue: (v: string) => BasicStatements;
  nextCol: string;
  stopEditing: BasicStatements;
}

export type Cell = (props: CellProps) => Node;

export interface ColumnEventHandlers {
  keydownCellHandler?: DomStatementsOrFn;
  keydownHeaderHandler?: DomStatementsOrFn;
  headerClickHandler?: DomStatementsOrFn;
  cellClickHandler?: DomStatementsOrFn;
}

export type RowHeight = "short" | "medium" | "tall" | "extraTall";
