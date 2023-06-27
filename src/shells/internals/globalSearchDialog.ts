import {
  multiTableSearchDialog,
  tableSearchDialog,
} from "../../components/searchDialog.js";
import { eventHandlers } from "../../nodeHelpers.js";
import { if_, setScalar } from "../../procHelpers.js";
import { BaseStatement } from "../../yom.js";
import { GlobalSearchOpts } from "./types.js";

export function globalSearchDialog(
  opts: GlobalSearchOpts,
  open: string,
  setOpen: (open: string) => BaseStatement
) {
  let searchDialog;
  if (opts.searchDialog) {
    searchDialog = tableSearchDialog({
      open,
      onClose: [setOpen(`not ${open}`)],
      table: opts.searchDialog.table,
      displayValues: opts.searchDialog?.displayValues,
    });
  }
  if (opts.multiTableSearchDialog) {
    searchDialog = multiTableSearchDialog({
      open,
      onClose: [setOpen(`not ${open}`)],
      tables: opts.multiTableSearchDialog.tables,
    });
  }
  if (!searchDialog) {
    return undefined;
  }
  return [
    searchDialog,
    eventHandlers({
      document: {
        keydown: [
          if_(`event.key = 'k' and (event.ctrl_key or event.meta_key)`, [
            setOpen(`not ${open}`),
          ]),
        ],
      },
    }),
  ];
}
