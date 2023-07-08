import { Authorization } from "../../modelTypes.js";
import { sourceMap, state } from "../../nodeHelpers.js";
import { DataGridStyles, Node } from "../../nodeTypes.js";
import {
  debugExpr,
  debugQuery,
  exit,
  if_,
  modify,
  record,
  scalar,
  setScalar,
  table,
  throwError,
} from "../../procHelpers.js";
import { expectCurrentUserAuthorized } from "../../utils/auth.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import {
  ClientProcStatement,
  FieldType,
  ProcTableField,
  StateStatement,
} from "../../yom.js";
import {
  Cell,
  ColumnEventHandlers,
  colHeaderClickHandlers,
  colKeydownHandlers,
  editFocusState,
} from "./baseDatagrid.js";

export interface SimpleBaseDatagridOpts {
  datagridStyles: DataGridStyles;
  children: (dgNode: Node) => Node;
  quickSearchMatchConfig?: string;
  columns: SimpleBaseColumn[];
  extraState?: StateStatement[];
  idField: string;
  source: string;
  idFieldSource: string;
  pageSize?: number;
  useDynamicQuery?: boolean;
  auth?: Authorization;
}

export interface SimpleBaseColumn extends ColumnEventHandlers {
  queryGeneration?: SimpleBaseColumnQueryGeneration;
  initialWidth: number;
  cell: Cell;
  header: Node;
}

export interface SimpleBaseColumnQueryGeneration {
  expr: string;
  sqlName: string;
  alwaysGenerate: boolean;
  procFieldType: FieldType;
}

export function simpleBaseDatagrid(opts: SimpleBaseDatagridOpts) {
  const { columns, datagridStyles, auth: requiredRole } = opts;
  const getResultsProc: StateStatement[] = [
    expectCurrentUserAuthorized(requiredRole),
    ...getQuery(
      columns,
      opts.source,
      opts.idFieldSource,
      opts.idField,
      typeof opts.pageSize === "number"
    ),
  ];
  let children = opts.children({
    t: "DataGrid",
    table: "dg_table",
    tableKey: opts.idField,
    recordName: "record",
    rowHeight: "44",
    headerHeight: "44",
    focusedColumn: "focus_state.column",
    focusedRow: "focus_state.row",
    shouldFocusCell: "focus_state.should_focus",
    styles: datagridStyles,
    on: {
      keyboardNavigation: [
        modify(
          `update ui.focus_state set column = cell.column, row = cell.row, should_focus = true`
        ),
        modify(`update ui.editing_state set is_editing = false`),
      ],
      cellClick: [
        modify(
          `update ui.focus_state set column = cell.column, row = cell.row, should_focus = true`
        ),
        modify(`update ui.editing_state set is_editing = false`),
        ...colHeaderClickHandlers(columns),
      ],
      cellDoubleClick: [
        modify(
          `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`
        ),
        modify(
          `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`
        ),
        setScalar(`ui.start_edit_with_char`, `null`),
      ],
      cellKeydown: colKeydownHandlers(columns),
      fetchMore:
        typeof opts.pageSize === "number"
          ? [
              setScalar(`ui.row_count`, `ui.row_count + ${opts.pageSize}`),
              triggerQueryRefresh(),
            ]
          : undefined,
    },
    columns: columns.map((col, i) => {
      const fieldIdent = col.queryGeneration?.sqlName
        ? ident(col.queryGeneration.sqlName)
        : null;
      return {
        cell: sourceMap(
          col.queryGeneration?.sqlName ??
            (typeof col.header === "string" ? col.header : `cell_${i}`),
          col.cell({
            value: fieldIdent ? `record.` + fieldIdent : `null`,
            editing: `editing_state.is_editing and editing_state.column = ${i} and editing_state.row - 1 = record.iteration_index`,
            setValue: (v) =>
              fieldIdent
                ? [
                    modify(
                      `update ui.dg_table set ${fieldIdent} = ${v} where dg_table.${opts.idField} = record.${opts.idField}`
                    ),
                  ]
                : [],
            recordId: `record.${opts.idField}`,
            nextCol: i + 1 === columns.length ? `null` : (i + 1).toString(),
            stopEditing: [
              modify(`update ui.editing_state set is_editing = false`),
              modify(`update ui.focus_state set should_focus = true`),
            ],
            column: i.toString(),
            row: `record.iteration_index + 1`,
            auth: opts.auth,
          })
        ),
        header: col.header,
        width: `(select width from column_width where col = ${i})`,
      };
    }),
  });
  children = state({
    watch: ["refresh_key"],
    procedure: getResultsProc,
    statusScalar: "status",
    errorRecord: "dg_error",
    children,
  });
  children = state({
    procedure: [
      // instead of intelligently recomputing, we just imperatively increment this whenever a change is made
      scalar("refresh_key", { type: "Int" }, "0"),
    ],
    children,
  });
  const mainStateProc = editFocusState();
  if (typeof opts.pageSize === "number") {
    mainStateProc.push(scalar(`row_count`, opts.pageSize.toString()));
  }
  if (opts.quickSearchMatchConfig) {
    mainStateProc.push(scalar(`quick_search_query`, `''`));
  }
  mainStateProc.push(
    record(`column_width`, [
      { name: "col", type: { type: "Uint" } },
      { name: "width", type: { type: "Uint" } },
    ])
  );
  let insertValues = columns
    .map((col, i) => `(${i}, ${col.initialWidth})`)
    .join(", ");
  mainStateProc.push(
    modify(`insert into column_width (col, width) values ${insertValues}`)
  );
  mainStateProc.push(
    record(`sort_info`, [
      { name: "col", type: { type: "SmallUint" } },
      {
        name: "ascending",
        type: { type: "Bool" },
      },
    ]),
    modify(`insert into sort_info (col, ascending) values (null, true)`)
  );
  if (opts.extraState) {
    mainStateProc.push(...opts.extraState);
  }
  return state({
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
) {
  const queryColumns: string[] = [];
  const tableFields: ProcTableField[] = [
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
  const rootIf = if_<StateStatement>(`sort_info.col is null`, [
    modify(`insert into dg_table ${queryBase}`),
  ]);
  let leafIf = rootIf;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (!col.queryGeneration) {
      continue;
    }
    const ifBranch = if_<StateStatement>(`sort_info.col = ${i}`, [
      if_(
        `sort_info.ascending`,
        [
          modify(
            `insert into dg_table ${queryBase} order by ${col.queryGeneration.sqlName} nulls last`
          ),
        ],
        [
          modify(
            `insert into dg_table ${queryBase} order by ${col.queryGeneration.sqlName} desc nulls last`
          ),
        ]
      ),
    ]);
    leafIf.onFalse.push(ifBranch);
    leafIf = ifBranch;
  }
  return [table("dg_table", tableFields), rootIf];
}

export function getCountQuery(source: string) {
  return `select count(*) from ${source}`;
}

export function triggerQueryRefresh() {
  return setScalar(`ui.refresh_key`, `ui.refresh_key + 1`);
}
