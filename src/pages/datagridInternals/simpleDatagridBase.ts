import { nodes } from "../../nodeHelpers";
import { DataGridStyles, Node } from "../../nodeTypes";
import { StateStatements, StateStatementsOrFn } from "../../statements";
import { ident } from "../../utils/sqlHelpers";
import * as yom from "../../yom";
import {
  DgStateHelpers,
  colClickHandlers,
  colKeydownHandlers,
  dgState,
  editFocusState,
  refreshKeyState,
  rowHeightInPixels,
  RowHeight,
  ColumnEventHandlers,
  CellNode,
  CellHelpers,
} from "./shared";

export interface SimpleDatagridBaseOpts {
  datagridStyles: DataGridStyles;
  children: (dgNode: Node, state: DgStateHelpers) => Node;
  columns: SimpleBaseColumn[];
  idField: string;
  source: string;
  idFieldSource: string;
  rowHeight: RowHeight;
  pageSize?: number;
  allow?: yom.SqlExpression;
  /**
   * Extra state, kept outside of the query state, so only refreshed on view change.
   */
  extraState?: StateStatementsOrFn;
  /**
   * Re-evaluated every time the datagrid query is refreshed.
   */
  extraQueryState?: StateStatementsOrFn;
}

export interface SimpleBaseColumn extends ColumnEventHandlers {
  queryGeneration?: SimpleBaseColumnQueryGeneration;
  initialWidth: number;
  cell: CellNode;
  header: Node;
}

export interface SimpleBaseColumnQueryGeneration {
  expr: yom.SqlExpression;
  sqlName: string;
  alwaysGenerate: boolean;
  procFieldType: yom.FieldType;
}

export function simpleDatagridBase(opts: SimpleDatagridBaseOpts) {
  const { columns, datagridStyles, allow } = opts;
  const getResultsProc = getQuery(
    columns,
    opts.source,
    opts.idFieldSource,
    opts.idField,
    typeof opts.pageSize === "number"
  );
  getResultsProc.statements(opts.extraQueryState);
  const rowHeight = rowHeightInPixels(opts.rowHeight);
  let children = opts.children(
    nodes.dataGrid({
      table: "dg_table",
      tableKey: opts.idField,
      recordName: "dg_record",
      rowHeight: rowHeight.toString(),
      headerHeight: "44",
      focusedColumn: "focus_state.column",
      focusedRow: "focus_state.row",
      shouldFocusCell: "focus_state.should_focus",
      styles: datagridStyles,
      on: {
        keyboardNavigation: (s) =>
          s
            .modify(
              `update ui.focus_state set column = cell.column, row = cell.row, should_focus = true`
            )
            .modify(`update ui.editing_state set is_editing = false`),
        cellClick: (s) =>
          s
            .modify(
              `update ui.focus_state set column = cell.column, row = cell.row, should_focus = true`
            )
            .modify(`update ui.editing_state set is_editing = false`)
            .statements(colClickHandlers(columns)),
        cellDoubleClick: (s) =>
          s
            .modify(
              `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`
            )
            .modify(
              `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`
            )
            .setScalar(`ui.start_edit_with_char`, `null`),
        cellKeydown: colKeydownHandlers(columns),
        fetchMore:
          typeof opts.pageSize === "number"
            ? (s) =>
                s
                  .setScalar(`ui.row_count`, `ui.row_count + ${opts.pageSize}`)
                  .statements(dgState.triggerRefresh)
            : undefined,
      },
      columns: columns.map((col, i) => {
        const fieldIdent = col.queryGeneration?.sqlName
          ? ident(col.queryGeneration.sqlName)
          : undefined;
        const name =
          col.queryGeneration?.sqlName ??
          (typeof col.header === "string" ? col.header : `cell_${i}`);
        return {
          cell: nodes.sourceMap(
            "cell " + name,
            col.cell(
              new CellHelpers(
                {
                  column: i,
                  field: fieldIdent,
                  idField: opts.idField,
                },
                i + 1 === columns.length ? `null` : (i + 1).toString(),
                `dg_record.${opts.idField}`
              ),
              dgState
            )
          ),
          header: nodes.sourceMap("cell header " + name, col.header),
          width: `(select width from column_width where col = ${i})`,
        };
      }),
    }),
    dgState
  );
  children = nodes.state({
    watch: ["dg_refresh_key"],
    procedure: getResultsProc,
    allow,
    statusScalar: "status",
    errorRecord: "dg_error",
    children,
  });
  children = nodes.state({
    procedure: refreshKeyState(),
    children,
  });
  const mainStateProc = editFocusState();
  if (typeof opts.pageSize === "number") {
    mainStateProc.scalar(`row_count`, opts.pageSize.toString());
  }
  mainStateProc.record(`column_width`, [
    { name: "col", type: { type: "Uint" } },
    { name: "width", type: { type: "Uint" } },
  ]);
  let insertValues = columns
    .map((col, i) => `(${i}, ${col.initialWidth})`)
    .join(", ");
  mainStateProc
    .modify(`insert into column_width (col, width) values ${insertValues}`)
    .record(`sort_info`, [
      { name: "col", type: { type: "SmallUint" } },
      {
        name: "ascending",
        type: { type: "Bool" },
      },
    ])
    .modify(`insert into sort_info (col, ascending) values (null, true)`)
    .statements(opts.extraState);
  return nodes.state({
    procedure: mainStateProc,
    children,
  });
}

function getQuery(
  columns: SimpleBaseColumn[],
  source: string,
  idFieldSource: string,
  idField: string,
  paginated: boolean
): StateStatements {
  const queryColumns: string[] = [];
  const tableFields: yom.ProcTableField[] = [
    { name: idField, type: { type: "BigInt" } },
  ];
  for (const col of columns) {
    if (col.queryGeneration) {
      queryColumns.push(
        col.queryGeneration.expr + " as " + col.queryGeneration.sqlName
      );
      tableFields.push({
        name: col.queryGeneration.sqlName,
        type: col.queryGeneration.procFieldType,
      });
    }
  }
  let queryBase = `select ${idFieldSource} as ${idField}, ${queryColumns.join(
    ","
  )} from ${source} as record`;
  if (paginated) {
    queryBase += ` limit ui.row_count`;
  }
  let currentStatements: StateStatements | undefined;
  for (let i = columns.length - 1; i >= 0; i--) {
    const col = columns[i];
    if (!col.queryGeneration) {
      continue;
    }
    currentStatements = new StateStatements().if({
      condition: `sort_info.col = ${i}`,
      then: (s) =>
        s.if({
          condition: `sort_info.ascending`,
          then: (s) =>
            s.modify(
              `insert into dg_table ${queryBase} order by ${
                col.queryGeneration!.sqlName
              } nulls last`
            ),
          else: (s) =>
            s.modify(
              `insert into dg_table ${queryBase} order by ${
                col.queryGeneration!.sqlName
              } desc nulls last`
            ),
        }),
      else: currentStatements,
    });
  }
  return new StateStatements().table("dg_table", tableFields).if({
    condition: `sort_info.col is null`,
    then: (s) => s.modify(`insert into dg_table ${queryBase}`),
    else: currentStatements,
  });
}

export function getCountQuery(source: string) {
  return `select count(*) from ${source}`;
}
