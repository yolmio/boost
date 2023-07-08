import { addDecisionTable, addEnum, addTable } from "../../modelHelpers.js";
import { Authorization } from "../../modelTypes.js";
import { queryParams, state } from "../../nodeHelpers.js";
import { DataGridStyles, Node } from "../../nodeTypes.js";
import {
  block,
  commitTransaction,
  forEachQuery,
  forEachTable,
  if_,
  modify,
  record,
  scalar,
  setScalar,
  startTransaction,
  table,
  while_,
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import {
  BaseStatement,
  ClientProcStatement,
  ServiceProcStatement,
  StateStatement,
} from "../../yom.js";

export interface DefaultView {
  columnOrder?: string[];
  sort?: { column: string; sort: "asc" | "desc" }[];
  filter?: { column: string; op: string; value_1: string }[];
}

export interface BaseDatagridOpts {
  datagridStyles: DataGridStyles;
  children: (dgNode: Node) => Node;
  dts: DatagridDts;
  datagridName: string;
  quickSearchMatchConfig?: string;
  columns: BaseColumn[];
  enableFiltering?: boolean;
  enableViews: boolean;
  pageSize?: number;
  defaultRowHeight?: number;
  extraState?: StateStatement[];
  idField: string;
  source: string;
  defaultView?: DefaultView;
}

/**
 * Creates a datagrid that handles the state needed for loading data and very configurable display of
 * the data.
 *
 * This handles keeping filter state, sort state, hiding/showing columns, pagination and loading from views.
 *
 * It does not expose controls for the above, but it does expose the state needed to build those controls.
 *
 * This is used as the base for higher level functions.
 */
export function baseDatagrid(opts: BaseDatagridOpts) {
  const { columns, datagridStyles, dts } = opts;
  if (opts.enableViews) {
    addViewTables();
    model.enums.datagrid_view_name.values[opts.datagridName] = {
      name: opts.datagridName,
      displayName: model.displayNameConfig.default(opts.datagridName),
    };
  }
  addDgFilterOp();
  const columnToResultField = new Map<number, string>();
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.queryGeneration) {
      columnToResultField.set(i, `field_${columnToResultField.size}`);
    }
  }
  const getResultsProc: StateStatement[] = [];
  // getResultsProc.push(
  //   scalar(
  //     `query`,
  //     makeDynamicQuery(dts, opts.source, opts.quickSearchMatchConfig)
  //   )
  // );
  // getResultsProc.push(debugExpr(`query`));
  getResultsProc.push({
    t: "DynamicQuery",
    resultTable: "dg_table",
    query: makeDynamicQuery(dts, opts.source, opts.quickSearchMatchConfig),
    columnCount: columns.filter((v) => Boolean(v.queryGeneration)).length,
  });
  let children = opts.children({
    t: "DataGrid",
    table: "dg_table",
    tableKey: opts.idField,
    recordName: "record",
    rowHeight: "row_height",
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
      const field = columnToResultField.get(i);
      return {
        cell: col.cell({
          value: field ? `record.` + field : `null`,
          editing: `editing_state.is_editing and editing_state.column = ${i} and editing_state.row - 1 = record.iteration_index`,
          setValue: (v) =>
            field
              ? [
                  modify(
                    `update ui.dg_table set ${field} = ${v} where dg_table.${opts.idField} = record.${opts.idField}`
                  ),
                ]
              : [],
          recordId: `cast(record.${opts.idField} as bigint)`,
          nextCol: `(select id from ui.column where displaying and ordering > (select ordering from ui.column where id = ${i}) order by ordering limit 1)`,
          stopEditing: [
            modify(`update ui.editing_state set is_editing = false`),
            modify(`update ui.focus_state set should_focus = true`),
          ],
          row: `record.iteration_index + 1`,
          column: i.toString(),
        }),
        header: col.header,
        width: `(select width from column where id = ${i})`,
        ordering: `(select ordering from column where id = ${i})`,
        visible: `(select displaying from column where id = ${i})`,
      };
    }),
  });
  children = state({
    watch: opts.enableViews
      ? ["refresh_key", "view", "reset_key"]
      : ["refresh_key"],
    procedure: getResultsProc,
    statusScalar: "status",
    errorRecord: "dg_error",
    children,
  });
  children = state({
    watch: opts.enableViews ? ["view", "reset_key"] : [],
    procedure: [
      // instead of intelligently recomputing, we just imperatively increment this whenever a change is made
      scalar("refresh_key", { type: "Int" }, "0"),
    ],
    children,
  });
  const mainStateProc = editFocusState();
  if (opts.pageSize) {
    mainStateProc.push(scalar(`row_count`, opts.pageSize.toString()));
  }
  const initialColumnInsertValues = opts.columns
    .map((col, i) => {
      const generate = col.queryGeneration?.alwaysGenerate ?? false;
      return `(${i}, ${col.initialWidth}, ${col.initiallyDisplaying}, ordering.n_after(${i}), ${generate})`;
    })
    .join(",");
  mainStateProc.push(
    table("column", [
      { name: "id", type: { type: "SmallUint" } },
      { name: "width", type: { type: "SmallUint" } },
      { name: "displaying", type: { type: "Bool" } },
      { name: "sort_index", type: { type: "TinyUint" } },
      { name: "sort_asc", type: { type: "Bool" } },
      { name: "ordering", notNull: true, type: { type: "Ordering" } },
      { name: "always_generate", notNull: true, type: { type: "Bool" } },
    ]),
    modify(
      `insert into column (id, width, displaying, ordering, always_generate) values ${initialColumnInsertValues}`
    ),
    scalar(`row_height`, (opts.defaultRowHeight ?? 56).toString())
  );
  if (opts.enableFiltering) {
    mainStateProc.push(
      scalar("root_filter_is_any", "false"),
      table("filter_term", [
        { name: "id", notNull: true, type: { type: "SmallUint" } },
        { name: "group", type: { type: "SmallUint" } },
        // if this is null, this is a filter on a column and column_id is expected to exist
        // if this is provided, it acts as a group
        { name: "is_any", type: { type: "Bool" } },
        { name: "column_id", type: { type: "SmallUint" } },
        { name: "ordering", type: { type: "Ordering" }, notNull: true },
        { name: "op", type: { type: "Enum", enum: "dg_filter_op" } },
        { name: "value_1", type: { type: "String", maxLength: 2000 } },
        { name: "value_2", type: { type: "String", maxLength: 2000 } },
        { name: "value_3", type: { type: "String", maxLength: 2000 } },
      ]),
      scalar(`next_filter_id`, { type: "BigUint" }, `0`)
    );
  }
  if (opts.quickSearchMatchConfig) {
    mainStateProc.push(scalar(`quick_search_query`, `''`));
  }
  if (opts.enableViews) {
    const loadFilter = opts.enableFiltering
      ? [
          modify(`insert into filter_term
            select id,
              dt.${dts.storageNameToId}(column_name) as column_id,
              group,
              ordering,
              is_any,
              op,
              value_1,
              value_2,
              value_3
            from db.datagrid_view_filter_term where view = view_record.id`),
          setScalar(
            `next_filter_id`,
            `coalesce((select max(id) from filter_term), 0) + 1`
          ),
        ]
      : [];
    const loadDefault: StateStatement[] = [];
    if (opts.defaultView) {
      const reordered = opts.columns.map((col, id) => ({
        name: col.viewStorageName,
        id,
      }));
      if (opts.defaultView.columnOrder) {
        for (let i = 0; i < opts.defaultView.columnOrder.length; i++) {
          const name = opts.defaultView.columnOrder[i];
          const oldIndex = reordered.findIndex((x) => x.name === name);
          if (oldIndex === -1) {
            throw new Error(
              `Invalid default view column order: column ${name} not found`
            );
          }
          const column = reordered.splice(oldIndex, 1)[0];
          reordered.splice(i, 0, column);
        }
      }
      for (let i = 0; i < reordered.length; i++) {
        const { name, id } = reordered[i];
        let sortFields = "";
        if (opts.defaultView.sort) {
          const sortIndex = opts.defaultView.sort.findIndex(
            (col) => name === col.column
          );
          if (sortIndex !== -1) {
            const asc = opts.defaultView.sort[sortIndex].sort === "asc";
            sortFields = `, sort_index = ${sortIndex}, sort_asc = ${asc} `;
          }
        }
        loadDefault.push(
          modify(
            `update column set ordering = ordering.n_after(${i})${sortFields} where id = ${id}`
          )
        );
      }
      if (opts.defaultView.filter) {
        for (let i = 0; i < opts.defaultView.filter.length; i++) {
          const filter = opts.defaultView.filter[i];
          const id = reordered.find((x) => x.name === filter.column)?.id;
          if (!id) {
            throw new Error(
              `Invalid default view filter: column ${filter.column} not found`
            );
          }
          loadDefault.push(
            modify(
              `insert into filter_term (id, column_id, ordering, op, value_1) values
            (next_filter_id, ${id}, ordering.n_after(${i}), cast(${stringLiteral(
                filter.op
              )} as enums.dg_filter_op), ${stringLiteral(filter.value_1)})}`
            ),
            setScalar(`next_filter_id`, `next_filter_id + 1`)
          );
        }
      }
    } else {
      loadDefault.push(
        forEachQuery(`select id from column`, `column_record`, [
          modify(
            `update column
                  set ordering = ordering.new((select max(ordering) from column))
                  where id = column_record.id`
          ),
        ])
      );
    }
    const loadColumnsFromView = block([
      scalar(`using_view`, `false`),
      if_("view is not null", [
        record(`view_record`, `select * from db.datagrid_view where id = view`),
        if_(`view_record.id is not null`, [
          setScalar(`using_view`, `true`),
          setScalar(`root_filter_is_any`, `view_record.root_filter_is_any`),
          setScalar(`row_height`, `view_record.row_height`),
          forEachQuery(
            `select * from db.datagrid_view_column where view = view_record.id`,
            `view_column`,
            [
              modify(
                `update column set ordering = view_column.ordering,
                  sort_asc = view_column.sort_asc,
                  sort_index = view_column.sort_index,
                  displaying = view_column.displaying
                where id = dt.${dts.storageNameToId}(view_column.name)`
              ),
            ]
          ),
          forEachQuery(
            `select id from column where id not in (select dt.${dts.storageNameToId}(name) from db.datagrid_view_column where view = view_record.id)`,
            `column_record`,
            [
              modify(
                `update column
                  set ordering = ordering.new((select max(ordering) from column))
                  where id = column_record.id`
              ),
            ]
          ),
          ...loadFilter,
        ]),
      ]),
      if_("not using_view", loadDefault),
    ]);
    mainStateProc.push(loadColumnsFromView);
  }
  if (opts.extraState) {
    mainStateProc.push(...opts.extraState);
  }
  children = state({
    watch: opts.enableViews ? ["view", "reset_key"] : [],
    procedure: mainStateProc,
    children,
  });
  if (opts.enableViews) {
    children = state({
      procedure: [
        scalar("view_drawer_open", "false"),
        scalar("reset_key", "0"),
      ],
      children,
    });
    children = queryParams(
      [{ name: "view", type: { type: "BigUint" } }],
      children
    );
  }
  return children;
}

export interface CellProps {
  value: string;
  editing: string;
  recordId: string;
  row: string;
  column: string;
  setValue: (v: string) => BaseStatement[];
  nextCol: string;
  stopEditing: BaseStatement[];
  auth?: Authorization;
}

export type Cell = (props: CellProps) => Node;

export interface BaseColumnQueryGeneration {
  expr: string;
  sqlName: string;
  alwaysGenerate: boolean;
}

export interface BaseColumn extends ColumnEventHandlers {
  queryGeneration?: BaseColumnQueryGeneration;
  viewStorageName?: string;
  initialWidth: number;
  cell: Cell;
  header: Node;
  initiallyDisplaying: boolean;
}

export interface ColumnEventHandlers {
  keydownCellHandler?: ClientProcStatement[];
  keydownHeaderHandler?: ClientProcStatement[];
  headerClickHandler?: ClientProcStatement[];
}

export interface DatagridDts {
  idToSqlExpr: string;
  idToSqlName: string;
  idToStorageName: string;
  storageNameToId: string;
}

/**
 * Create decision tables that help handle the query generation for the datagrid.
 */
export function addDatagridDts(
  datagridName: string,
  columns: BaseColumn[]
): DatagridDts {
  const sqlNames: string[] = [];
  const sqlExprs: string[] = [];
  const storageNamesToIds: string[] = [];
  const idsToStorageNames: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.queryGeneration) {
      const sqlName = stringLiteral(ident(col.queryGeneration.sqlName));
      sqlNames.push([i, sqlName].join(","));
      sqlExprs.push([i, stringLiteral(col.queryGeneration.expr)].join(","));
    }
    if (col.viewStorageName) {
      const storageName = stringLiteral(col.viewStorageName);
      storageNamesToIds.push([storageName, i].join(","));
      idsToStorageNames.push([i, storageName].join(","));
    }
  }
  const idToSqlNameDt = `${datagridName}_dg_col_id_to_sql_name`;
  addDecisionTable({
    bound: false,
    parameters: [{ name: "id", type: "SmallUint" }],
    csv: `input.id,sql_name\n` + sqlNames.join("\n"),
    name: idToSqlNameDt,
    output: { name: "sql_name", type: "String" },
  });
  const storageNameToIdDt = `${datagridName}_dg_col_storage_name_to_id`;
  addDecisionTable({
    bound: false,
    parameters: [
      {
        name: "sql_name",
        type: { type: "String", maxLength: 2000 },
      },
    ],
    csv: `input.sql_name,id\n` + storageNamesToIds.join("\n"),
    name: storageNameToIdDt,
    output: { name: "id", type: "Int" },
  });
  const idToStorageName = `${datagridName}_dg_col_id_to_storage_name`;
  addDecisionTable({
    bound: false,
    parameters: [{ name: "id", type: "SmallUint" }],
    csv: `input.id,storage_name\n` + idsToStorageNames.join("\n"),
    name: idToStorageName,
    output: { name: "storage_name", type: "String" },
  });
  const idToSqlExprDt = `${datagridName}_dg_col_id_to_sql_expr`;
  addDecisionTable({
    bound: false,
    parameters: [{ name: "id", type: "SmallUint" }],
    csv: `input.id,sql_expr\n` + sqlExprs.join("\n"),
    name: idToSqlExprDt,
    output: { name: "sql_expr", type: "String" },
  });
  return {
    idToSqlExpr: idToSqlExprDt,
    idToSqlName: idToSqlNameDt,
    storageNameToId: storageNameToIdDt,
    idToStorageName,
  };
}

export function editFocusState(): StateStatement[] {
  return [
    record(
      "focus_state",
      "select 0 as column, 0 as row, false as should_focus"
    ),
    record(
      "editing_state",
      "select 0 as column, 0 as row, false as is_editing"
    ),
    scalar(`start_edit_with_char`, { type: "String", maxLength: 1 }),
    scalar("saving_edit_count", "0"),
    scalar(`display_edit_failure`, `false`),
  ];
}

export function colKeydownHandlers(columns: ColumnEventHandlers[]) {
  const statements: ClientProcStatement[] = [];
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.keydownHeaderHandler) {
      statements.push(
        if_(`cell.row = 0 and cell.column = ${i}`, column.keydownHeaderHandler)
      );
    }
    if (column.keydownCellHandler) {
      statements.push(
        if_(`cell.row != 0 and cell.column = ${i}`, column.keydownCellHandler)
      );
    }
  }
  return statements;
}

export function colHeaderClickHandlers(columns: ColumnEventHandlers[]) {
  const statements: ClientProcStatement[] = [];
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.headerClickHandler) {
      statements.push(if_(`cell.column = ${i}`, column.headerClickHandler));
    }
  }
  if (statements.length === 0) {
    return [];
  }
  return [if_(`cell.row = 0`, statements)];
}

export function triggerQueryRefresh() {
  return setScalar(`ui.refresh_key`, `ui.refresh_key + 1`);
}

function insertViewColumnsAndFilters(dts: DatagridDts, viewId: string) {
  return [
    modify(
      `insert into db.datagrid_view_column
          select ${viewId} as view, displaying, ordering, sort_asc, sort_index, dt.${dts.idToStorageName}(id) as name
          from ui.column
          where dt.${dts.idToStorageName}(id) is not null`
    ),
    table("filter_mapping", [
      { name: "ui_id", type: { type: "BigUint" } },
      {
        name: "db_id",
        type: { type: "BigUint" },
      },
    ]),
    forEachQuery(
      "select id from ui.filter_term where group is null",
      "filter_term_record",
      [
        modify(
          `insert into db.datagrid_view_filter_term select *, ${viewId} as view, dt.${dts.idToStorageName}(column_id) as column_name from ui.filter_term where id = filter_term_record.id`
        ),
        modify(
          `insert into filter_mapping (ui_id, db_id) values (filter_term_record.id, (select max(id) from db.datagrid_view_filter_term))`
        ),
      ]
    ),
    table(
      `sub_root_term`,
      `select id from ui.filter_term where group in (select ui_id from filter_mapping)`
    ),
    forEachTable("sub_root_term", "filter_term_record", [
      modify(
        `insert into db.datagrid_view_filter_term
              select *, db_id as group, ${viewId} as view, dt.${dts.idToStorageName}(column_id) as column_name
                from ui.filter_term
                  join filter_mapping on ui_id = group
                where id = filter_term_record.id`
      ),
      modify(
        `insert into filter_mapping (ui_id, db_id) values (filter_term_record.id, (select max(id) from db.datagrid_view_filter_term))`
      ),
    ]),
    forEachQuery(
      "select id from ui.filter_term where group in (select id from sub_root_term)",
      "filter_term_record",
      modify(
        `insert into db.datagrid_view_filter_term
              select *, db_id as group, ${viewId} as view, dt.${dts.idToStorageName}(column_id) as column_name
                from ui.filter_term
                  join filter_mapping on ui_id = group
                where id = filter_term_record.id`
      )
    ),
  ];
}

export function saveToExistingView(
  dts: DatagridDts,
  viewId: string
): ServiceProcStatement[] {
  return [
    startTransaction(),
    modify(
      `update db.datagrid_view set root_filter_is_any = ui.root_filter_is_any, row_height = ui.row_height where id = ${viewId}`
    ),
    // just deleting and re-inserting is much easier
    modify(`delete from db.datagrid_view_column where view = ${viewId}`),
    modify(`delete from db.datagrid_view_filter_term where view = ${viewId}`),
    ...insertViewColumnsAndFilters(dts, viewId),
    commitTransaction(),
  ];
}

export function saveAsNewView(
  datagridName: string,
  dts: DatagridDts,
  name: string,
  isPersonal: string
): ServiceProcStatement[] {
  const maxOrdering = `(select max(ordering) from db.datagrid_view where datagrid_name = ${stringLiteral(
    datagridName
  )} and case when ${isPersonal} then user = current_user() else user is null end)`;
  return [
    startTransaction(),
    modify(
      `insert into db.datagrid_view (name, ordering, datagrid_name, root_filter_is_any, user, row_height)
          values (
            ${name},
            ordering.new(${maxOrdering}),
            ${stringLiteral(datagridName)},
            ui.root_filter_is_any,
            case when ${isPersonal} then current_user() else null end,
            ui.row_height
          )`
    ),
    scalar(`view_id`, `last_record_id(db.datagrid_view)`),
    ...insertViewColumnsAndFilters(dts, `view_id`),
    commitTransaction(),
  ];
}

export function duplicateView(viewId: string) {
  const sameUserAsOldView = `case when old_view.user is null then user is null else old_view.user = user end`;
  return [
    startTransaction(),
    record(`old_view`, `select * from db.datagrid_view where id = ${viewId}`),
    scalar(`base_name`, `old_view.name || ' copy'`),
    scalar(`check_count`, `1`),
    scalar(`new_name`, `base_name`),
    while_(
      `exists (select 1 from db.datagrid_view where name = new_name and datagrid_name = old_view.datagrid_name and ${sameUserAsOldView})`,
      [
        setScalar(`check_count`, `check_count + 1`),
        setScalar(`new_name`, `base_name || ' ' || check_count`),
      ]
    ),
    modify(
      `insert into db.datagrid_view
        select
          new_name as name,
          datagrid_name,
          root_filter_is_any,
          row_height,
          ordering.new(
            ordering,
            (select
                min(ordering)
              from db.datagrid_view
                where ordering > original.ordering and
                  datagrid_name = original.datagrid_name and 
                  ${sameUserAsOldView}
            )
          ) as ordering,
          user
          from db.datagrid_view as original where id = ${viewId}`
    ),
    scalar(`new_view_id`, `last_record_id(db.datagrid_view)`),
    modify(
      `insert into db.datagrid_view_column select *, new_view_id as view from db.datagrid_view_column where view = ${viewId}`
    ),
    table("filter_mapping", [
      { name: "old_id", type: { type: "BigUint" } },
      {
        name: "new_id",
        type: { type: "BigUint" },
      },
    ]),
    forEachQuery(
      `select id from db.datagrid_view_filter_term where group is null and view = ${viewId}`,
      "filter_term_record",
      [
        modify(
          `insert into db.datagrid_view_filter_term select *, new_view_id as view from db.datagrid_view_filter_term where id = filter_term_record.id`
        ),
        modify(
          `insert into filter_mapping (old_id, new_id) values (filter_term_record.id, (select max(id) from db.datagrid_view_filter_term))`
        ),
      ]
    ),
    table(
      `sub_root_term`,
      `select id from db.datagrid_view_filter_term where view = ${viewId} and group in (select old_id from filter_mapping)`
    ),
    forEachTable("sub_root_term", "filter_term_record", [
      modify(
        `insert into db.datagrid_view_filter_term
              select *, new_id as group, new_view_id as view
                from db.datagrid_view_filter_term
                  join filter_mapping on old_id = group
                where id = filter_term_record.id`
      ),
      modify(
        `insert into filter_mapping (old_id, new_id) values (filter_term_record.id, (select max(id) from db.datagrid_view_filter_term))`
      ),
    ]),
    forEachQuery(
      `select id from db.datagrid_view_filter_term where view = ${viewId} and group in (select id from sub_root_term)`,
      "filter_term_record",
      modify(
        `insert into db.datagrid_view_filter_term
              select *, new_id as group, new_view_id as view
                from db.datagrid_view_filter_term
                  join filter_mapping on old_id = group
                where id = filter_term_record.id`
      )
    ),
    commitTransaction(),
  ];
}

function filterExpr(dts: DatagridDts) {
  const serializeFilter = (filter: string) =>
    `dt.encode_dg_filter_op(
      op => ${filter}.op,
      col_name => dt.${dts.idToSqlName}(${filter}.column_id),
      value_1 => ${filter}.value_1,
      value_2 => ${filter}.value_2,
      value_3 => ${filter}.value_3
    )`;
  return `
(select
  string_agg(
    case
      when is_any is null then ${serializeFilter("root")}
      else (
        select 
          string_agg(
            case
              when is_any is null then ${serializeFilter("subroot")}
              else (select
                '(' || string_agg(
                  ${serializeFilter("filter_term")},
                  case when subroot.is_any then ' or ' else ' and ' end
                ) || ')'
                from ui.filter_term
                where group = subroot.id
              )
            end,
            case when root.is_any then ' or ' else ' and ' end
          )
        from ui.filter_term as subroot where subroot.group = root.id
      )
    end,
    case when ui.root_filter_is_any then ' or ' else ' and ' end
  )
  from ui.filter_term as root
  where group is null)`;
}

function fromAndWherePart(
  dts: DatagridDts,
  source: string,
  matchConfig: string | undefined
) {
  const matchWhereClause = matchConfig
    ? `' ||
      case when trim(ui.quick_search_query) != ''
        then ' where match(${matchConfig}, query => ' || literal.string(ui.quick_search_query) || ', record_id => id)'
        else ''
      end ||'`
    : ``;
  const hasFilterBranch = [
    `'(select '`,
    `(select string_agg(
          case
            when displaying or always_generate or sort_index is not null or id in (select column_id from ui.filter_term) then dt.${dts.idToSqlExpr}(id)
          end
          || ' as ' || dt.${dts.idToSqlName}(id), ',')
        from ui.column
      )`,
    `' from '`,
    stringLiteral(source),
    `' as record'`,
    `'${matchWhereClause}) as record where '`,
    filterExpr(dts),
  ].join(`||`);
  const noFilterBranch = `${stringLiteral(
    source
  )} || ' as record${matchWhereClause}'`;
  return [
    `' from '`,
    `case when exists (select column_id from ui.filter_term) then (${hasFilterBranch}) else (${noFilterBranch}) end`,
  ].join(`||`);
}

function orderByPart(dts: DatagridDts) {
  return `coalesce(
    ' order by ' || (select
      string_agg(dt.${dts.idToSqlName}(id) || (case when sort_asc then ' nulls last' else ' desc nulls last' end), ',')
      from (select id, sort_asc from ui.column where sort_index is not null order by sort_index)),
    ''
  )`;
}

const shouldGenerateColumn = `displaying or always_generate or sort_index is not null`;

export function makeDynamicQuery(
  dts: DatagridDts,
  source: string,
  matchConfig: string | undefined
): string {
  return [
    `'select ' `,
    `(select string_agg(
        case
          when exists (select column_id from ui.filter_term) and (${shouldGenerateColumn}) then dt.${dts.idToSqlName}(id)
          when ${shouldGenerateColumn} then dt.${dts.idToSqlExpr}(id)
          else 'null'
        end
        || ' as ' || dt.${dts.idToSqlName}(id), ',')
      from ui.column
    )`,
    fromAndWherePart(dts, source, matchConfig),
    orderByPart(dts),
    `' limit '`,
    `ui.row_count`,
  ].join("||");
}

export function makeDownloadQuery(
  dts: DatagridDts,
  source: string,
  matchConfig: string | undefined
): string {
  return [
    `'select ' `,
    `(select string_agg(
        case
          when exists (select column_id from ui.filter_term) and (${shouldGenerateColumn}) then dt.${dts.idToSqlName}(id)
          when ${shouldGenerateColumn} then dt.${dts.idToSqlExpr}(id) || ' as ' || dt.${dts.idToSqlName}(id)
        end
      from ui.column
    )`,
    fromAndWherePart(dts, source, matchConfig),
    orderByPart(dts),
    `' limit ' || ui.row_count`,
  ].join("||");
}

export function makeCountQuery(
  dts: DatagridDts,
  source: string,
  matchConfig: string | undefined
): string {
  return [
    `'select count(*) '`,
    fromAndWherePart(dts, source, matchConfig),
  ].join("||");
}

export function makeIdsQuery(
  dts: DatagridDts,
  source: string,
  matchConfig: string | undefined
): string {
  return [`'select '`, fromAndWherePart(dts, source, matchConfig)].join("||");
}

function addViewTables() {
  if ("datagrid_view" in model.database.tables) {
    return;
  }
  addEnum({
    name: "datagrid_view_name",
    values: [],
  });
  addTable("datagrid_view", (t) => {
    t.string("name", 200).notNull();
    t.enum("datagrid_name", "datagrid_view_name").notNull();
    t.fk("user", model.database.userTableName);
    t.bool("root_filter_is_any").notNull();
    t.smallUint("row_height").notNull();
    t.ordering("ordering").notNull();
    t.unique([
      "name",
      { field: "user", distinctNulls: false },
      "datagrid_name",
    ]);
  });
  addTable("datagrid_view_column", (t) => {
    t.fk("view", "datagrid_view").notNull();
    t.string("name", 200).notNull();
    t.bool("displaying").notNull();
    t.ordering("ordering").notNull();
    t.tinyUint("sort_index");
    t.bool("sort_asc");
  });
  addTable("datagrid_view_filter_term", (t) => {
    t.fk("view", "datagrid_view").notNull();
    t.fk("group", "datagrid_view_filter_term");
    t.ordering("ordering").notNull();
    t.bool("is_any");
    t.string("column_name", 200);
    t.enum("op", "dg_filter_op");
    t.string("value_1", 2000);
    t.string("value_2", 2000);
    t.string("value_3", 2000);
  });
}

function addDgFilterOp() {
  if (!model.enums.dg_filter_op) {
    addEnum({
      name: "dg_filter_op",
      values: [
        "empty",
        "not_empty",
        "num_eq",
        "num_ne",
        "num_lt",
        "num_lte",
        "num_gt",
        "num_gte",
        "str_eq",
        "str_ne",
        "str_contains",
        "str_not_contains",
        "date_eq",
        "date_ne",
        "date_lt",
        "date_lte",
        "date_gt",
        "date_gte",
        "enum_eq",
        "enum_ne",
        "fk_eq",
        "fk_ne",
        "bool_eq",
        "enum_like_bool_eq",
        "minute_duration_eq",
        "minute_duration_ne",
        "minute_duration_lt",
        "minute_duration_lte",
        "minute_duration_gt",
        "minute_duration_gte",
      ],
      withBoolDts: [
        {
          name: "is_string_filter_op",
          trues: ["str_eq", "str_ne", "str_contains", "str_not_contains"],
        },
        {
          name: "is_number_filter_op",
          trues: ["num_eq", "num_ne", "num_lt", "num_lte", "num_gt", "num_gte"],
        },
        {
          name: "is_date_filter_op",
          trues: [
            "date_eq",
            "date_ne",
            "date_lt",
            "date_lte",
            "date_gt",
            "date_gte",
          ],
        },
        {
          name: "is_enum_filter_op",
          trues: ["enum_eq", "enum_ne"],
        },
        {
          name: "is_fk_filter_op",
          trues: ["fk_eq", "fk_ne"],
        },
        {
          name: "is_minute_duration_filter_op",
          trues: [
            "minute_duration_eq",
            "minute_duration_ne",
            "minute_duration_lt",
            "minute_duration_lte",
            "minute_duration_gt",
            "minute_duration_gte",
          ],
        },
      ],
    });
    addDecisionTable({
      bound: false,
      name: "encode_date_dg_filter_param",
      parameters: [
        {
          name: "value_1",
          type: { type: "String", maxLength: 200 },
          notNull: false,
        },
        {
          name: "value_2",
          type: { type: "String", maxLength: 200 },
          notNull: false,
        },
      ],
      csv: [
        ["input.value_1", "input.value_2", "output"],
        ["'today'", "any", "'today()'"],
        ["'tomorrow'", "any", "'tomorrow()'"],
        ["'yesterday'", "any", "'yesterday()'"],
        ["'week ago'", "any", `"'date.add(week, -1, today())'"`],
        ["'week from now'", "any", `"'date.add(week, 1, today())'"`],
        ["'month ago'", "any", `"'date.add(month, -1, today())'"`],
        ["'month from now'", "any", `"'date.add(month, 1, today())'"`],
        [
          "'number of days ago'",
          "exists",
          `"literal.date(date.add(day, -try_cast(input.value_2 as int), today()))"`,
        ],
        [
          "'number of days from now'",
          "exists",
          `"literal.date(date.add(day, try_cast(input.value_2 as int), today()))"`,
        ],
        ["'exact date'", "exists", "literal.date(input.value_2)"],
      ]
        .map((v) => v.join(","))
        .join("\n"),
      output: { name: "output", type: { type: "String" } },
    });
    addDecisionTable({
      bound: false,
      name: "encode_dg_filter_op",
      parameters: [
        {
          name: "op",
          type: { type: "Enum", enum: "dg_filter_op" },
          notNull: true,
        },
        {
          name: "col_name",
          type: { type: "String", maxLength: 200 },
          notNull: true,
        },
        {
          name: "value_1",
          type: { type: "String", maxLength: 200 },
          notNull: false,
        },
        {
          name: "value_2",
          type: { type: "String", maxLength: 200 },
          notNull: false,
        },
        {
          name: "value_3",
          type: { type: "String", maxLength: 200 },
          notNull: false,
        },
      ],
      csv: [
        ["input.op", "sql"],
        ["'empty'", "input.col_name || ' is null'"],
        ["'not_empty'", "input.col_name || ' is not null'"],
        // string
        [
          "'str_eq'",
          `"coalesce(input.col_name || '=' || literal.string(input.value_1), 'true')"`,
        ],
        [
          "'str_ne'",
          `"coalesce(input.col_name || '!=' || literal.string(input.value_1), 'true')"`,
        ],
        [
          "'str_contains'",
          `"coalesce(input.col_name || ' like ''%'' || ' || literal.string(input.value_1) || '|| ''%''', 'true')"`,
        ],
        [
          "'str_not_contains'",
          `"coalesce(input.col_name || ' not like ''%'' || ' || literal.string(input.value_1) || '|| ''%''', 'true')"`,
        ],
        // number
        [
          "input.op = 'num_eq' or input.op = 'minute_duration_eq'",
          `"coalesce(input.col_name || '=' || literal.number(input.value_1), 'true')"`,
        ],
        [
          "input.op = 'num_ne' or input.op = 'minute_duration_ne'",
          `"coalesce(input.col_name || '!=' || literal.number(input.value_1), 'true')"`,
        ],
        [
          "input.op = 'num_lt' or input.op = 'minute_duration_lt'",
          `"coalesce(input.col_name || '<' || literal.number(input.value_1), 'true')"`,
        ],
        [
          "input.op = 'num_lte' or input.op = 'minute_duration_lte'",
          `"coalesce(input.col_name || '<=' || literal.number(input.value_1), 'true')"`,
        ],
        [
          "input.op = 'num_gt' or input.op = 'minute_duration_gt'",
          `"coalesce(input.col_name || '>' || literal.number(input.value_1), 'true')"`,
        ],
        [
          "input.op = 'num_gte' or input.op = 'minute_duration_gte'",
          `"coalesce(input.col_name || '>=' || literal.number(input.value_1), 'true')"`,
        ],
        // date
        [
          "'date_eq'",
          `"coalesce(input.col_name || '=' || dt.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')"`,
        ],
        [
          "'date_ne'",
          `"coalesce(input.col_name || '!=' || dt.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')"`,
        ],
        [
          "'date_lt'",
          `"coalesce(input.col_name || '<' || dt.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')"`,
        ],
        [
          "'date_lte'",
          `"coalesce(input.col_name || '<=' || dt.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')"`,
        ],
        [
          "'date_gt'",
          `"coalesce(input.col_name || '>' || dt.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')"`,
        ],
        [
          "'date_gte'",
          `"coalesce(input.col_name || '>=' || dt.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')"`,
        ],
        // enum
        [
          "'enum_eq'",
          `"coalesce(input.col_name || '=' || literal.string(input.value_1), 'true')"`,
        ],
        [
          "'enum_ne'",
          `"coalesce(input.col_name || '!=' || literal.string(input.value_1), 'true')"`,
        ],
        // foreign keys
        [
          "'fk_eq'",
          `"coalesce(input.col_name || '=' || literal.number(input.value_1), 'true')"`,
        ],
        [
          "'fk_ne'",
          `"coalesce(input.col_name || '!=' || literal.number(input.value_1), 'true')"`,
        ],
        // bool
        [
          "'bool_eq'",
          `"case when input.value_1 = 'true' then input.col_name || '=true' else '(' || input.col_name || ' is null or ' || input.col_name || '=false)' end"`,
        ],
        [
          "'enum_like_bool_eq'",
          `"case when input.value_1 = 'true' then input.col_name || '=true' when input.value_1 = 'false' then input.col_name || '=false' else input.col_name || ' is null' end"`,
        ],
        ["any", "'true'"],
      ]
        .map((v) => v.join(","))
        .join("\n"),
      output: { name: "sql", type: "String" },
    });
  }
}
