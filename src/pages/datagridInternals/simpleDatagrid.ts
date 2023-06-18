import { alert } from "../../components/alert.js";
import { iconButton } from "../../components/iconButton.js";
import {
  insertDialog,
  InsertDialogOpts,
} from "../../components/insertDialog.js";
import { materialIcon } from "../../components/materialIcon.js";
import { typography } from "../../components/typography.js";
import { addPage } from "../../modelHelpers.js";
import { Authorization, Table } from "../../modelTypes.js";
import { element, ifNode, sourceMap, state } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { scalar, setScalar } from "../../procHelpers.js";
import { createStyles, flexGrowStyles } from "../../styleUtils.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import { ClientProcStatement, StateStatement } from "../../yom.js";
import { Cell } from "./baseDatagrid.js";
import {
  SimpleBaseColumn,
  SimpleBaseColumnQueryGeneration,
  simpleBaseDatagrid,
} from "./simpleBaseDatgrid.js";
import { styles as sharedStyles } from "./styles.js";

export interface ToolbarConfig {
  header: Node;
  delete: boolean;
  export: boolean;
  search?: { matchConfig: string };
  add?:
    | { type: "dialog"; opts?: Partial<InsertDialogOpts> }
    | { type: "href"; href: string };
}

export interface SimpleColumn {
  queryGeneration?: SimpleBaseColumnQueryGeneration;
  displayName?: string;
  width: number;
  header: Node;
  keydownCellHandler?: ClientProcStatement[];
  keydownHeaderHandler?: ClientProcStatement[];
  cell: Cell;
}

export interface SimpleGridConfig {
  tableModel: Table;
  toolbar: ToolbarConfig;
  path: string;
  columns: SimpleColumn[];
  idField: string;
  pageSize?: number;
  extraState?: StateStatement[];
  useDynamicQuery: boolean;
  auth?: Authorization;
  sourceMapName?: string;
}

const styles = createStyles({
  toolbar: {
    display: "flex",
    px: 2,
    py: 1,
  },
});

export function simpleDatagrid(config: SimpleGridConfig) {
  const baseColumns = config.columns.map(
    (c): SimpleBaseColumn => ({
      cell: c.cell,
      header: c.header,
      keydownCellHandler: c.keydownCellHandler,
      keydownHeaderHandler: c.keydownHeaderHandler,
      queryGeneration: c.queryGeneration,
      width: c.width,
    })
  );
  let addButton: Node | undefined;
  if (config.toolbar.add?.type === "href") {
    addButton = iconButton({
      variant: "soft",
      color: "primary",
      size: "sm",
      children: materialIcon("Add"),
      href: stringLiteral(config.toolbar.add.href),
    });
  } else if (config.toolbar.add?.type === "dialog") {
    const withValues: Record<string, string> =
      config.toolbar.add.opts?.withValues ?? {};
    addButton = state({
      procedure: [scalar(`adding`, `false`)],
      children: [
        iconButton({
          variant: "soft",
          color: "primary",
          size: "sm",
          children: materialIcon("Add"),
          on: { click: [setScalar(`adding`, `true`)] },
        }),
        insertDialog({
          ...config.toolbar.add.opts,
          table: config.tableModel.name.name,
          open: `adding`,
          onClose: [setScalar(`adding`, `false`)],
          content: {
            type: "AutoLabelOnLeft",
            ignoreFields: Object.keys(withValues),
          },
          afterSubmitService: (state) => [
            ...((config.toolbar.add as any).opts?.afterSubmitService?.(state) ??
              []),
            setScalar(`ui.refresh_key`, `ui.refresh_key + 1`),
          ],
        }),
      ],
    });
  }
  let content: Node = simpleBaseDatagrid({
    source: "db." + ident(config.tableModel.name.name),
    idFieldSource: config.tableModel.primaryKeyFieldName
      ? ident(config.tableModel.primaryKeyFieldName)
      : "id",
    children: (dg) =>
      ifNode(
        `status = 'failed'`,
        alert({
          color: "danger",
          children: `'Unable to load data.'`,
        }),
        [
          element("div", {
            styles: styles.toolbar,
            children: [
              typography({
                level: "h4",
                children: config.toolbar.header,
              }),
              element("div", { styles: flexGrowStyles }),
              addButton,
            ],
          }),
          ifNode(
            `(status = 'requested' or status = 'fallback_triggered') and refresh_key = 0`,
            element("div", {
              styles: sharedStyles.emptyGrid,
            }),
            dg
          ),
        ]
      ),
    columns: baseColumns,
    idField: config.idField,
    datagridStyles: {
      root: sharedStyles.root,
      row: sharedStyles.row,
      cell: sharedStyles.cell(),
      headerCell: sharedStyles.headerCell(),
      header: sharedStyles.header,
    },
    pageSize: config.pageSize,
    quickSearchMatchConfig: config.toolbar.search?.matchConfig,
    extraState: config.extraState,
    useDynamicQuery: config.useDynamicQuery,
    auth: config.auth,
  });
  if (config.sourceMapName) {
    content = sourceMap(config.sourceMapName, content);
  }
  addPage({
    path: config.path,
    content,
  });
}
