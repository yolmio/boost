import {
  MultiTableSearchDialogTable,
  TableSearchDisplay,
} from "../../components/searchDialog";

export interface GlobalSearchOpts {
  searchDialog?: {
    table: string;
    displayValues?: (string | TableSearchDisplay)[];
  };
  multiTableSearchDialog?: {
    tables: MultiTableSearchDialogTable[];
  };
}
