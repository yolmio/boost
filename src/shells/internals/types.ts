import {
  MultiTableSearchDialogTable,
  TableSearchDisplay,
} from "../../components/searchDialog.js";

export interface GlobalSearchOpts {
  searchDialog?: {
    table: string;
    displayValues?: (string | TableSearchDisplay)[];
  };
  multiTableSearchDialog?: {
    tables: MultiTableSearchDialogTable[];
  };
}
