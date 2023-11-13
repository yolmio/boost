import {
  multiTableSearchDialog,
  tableSearchDialog,
} from "../../components/searchDialog";
import { nodes } from "../../nodeHelpers";
import { BasicStatements } from "../../statements";
import { GlobalSearchOpts } from "./types";

export function globalSearchDialog(
  opts: GlobalSearchOpts,
  open: string,
  setOpen: (open: string, s: BasicStatements) => BasicStatements
) {
  let searchDialog;
  const toggleOpen = setOpen(`not ${open}`, new BasicStatements());
  if (opts.searchDialog) {
    searchDialog = tableSearchDialog({
      open,
      onClose: toggleOpen,
      table: opts.searchDialog.table,
      displayValues: opts.searchDialog?.displayValues,
    });
  }
  if (opts.multiTableSearchDialog) {
    searchDialog = multiTableSearchDialog({
      open,
      onClose: toggleOpen,
      tables: opts.multiTableSearchDialog.tables,
    });
  }
  if (!searchDialog) {
    return undefined;
  }
  return [
    searchDialog,
    nodes.eventHandlers({
      document: {
        keydown: (s) =>
          s.if(`event.key = 'k' and (event.ctrl_key or event.meta_key)`, (s) =>
            s
              .statements(toggleOpen)
              .triggerViewTransition("all", "'open-dialog'")
          ),
      },
    }),
  ];
}
