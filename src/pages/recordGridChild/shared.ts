import { Table } from "../../modelTypes.js";
import { BaseStatement } from "../../yom.js";

export interface RecordGridContext {
  table: Table;
  recordId: string;
  refreshKey: string;
  triggerRefresh: BaseStatement;
  pathBase: string;
}
