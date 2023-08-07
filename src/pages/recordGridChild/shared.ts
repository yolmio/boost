import { Table } from "../../appTypes";
import { BaseStatement } from "../../yom";

export interface RecordGridContext {
  table: Table;
  recordId: string;
  refreshKey: string;
  triggerRefresh: BaseStatement;
  pathBase: string;
}
