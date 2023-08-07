import { Node } from "../../nodeTypes";
import { BaseStatement, ClientProcStatement } from "../../yom";

export interface CellProps {
  value: string;
  editing: string;
  recordId: string;
  row: string;
  column: string;
  setValue: (v: string) => BaseStatement[];
  nextCol: string;
  stopEditing: BaseStatement[];
}

export type Cell = (props: CellProps) => Node;

export interface ColumnEventHandlers {
  keydownCellHandler?: ClientProcStatement[];
  keydownHeaderHandler?: ClientProcStatement[];
  headerClickHandler?: ClientProcStatement[];
  cellClickHandler?: ClientProcStatement[];
}

export type RowHeight = "short" | "medium" | "tall" | "extraTall";
