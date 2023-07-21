import { Node } from "../../nodeTypes.js";
import { BaseStatement, ClientProcStatement } from "../../yom.js";

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
