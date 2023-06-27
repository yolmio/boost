import { IconName } from "../../components/materialIconNames.js";
import {
  MultiTableSearchDialogTable,
  TableSearchDisplay,
} from "../../components/searchDialog.js";
import { Authorization } from "../../modelTypes.js";

export interface GlobalSearchOpts {
  searchDialog?: {
    table: string;
    displayValues?: TableSearchDisplay[];
  };
  multiTableSearchDialog?: {
    tables: MultiTableSearchDialogTable[];
  };
}
