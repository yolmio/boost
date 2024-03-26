import { nodes } from "../../nodeHelpers";
import { DataGridStyles, Node } from "../../nodeTypes";
import { system } from "../../system";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import {
  CellHelpers,
  CellNode,
  DgStateHelpers as DgStateHelpers,
  colClickHandlers,
  colKeydownHandlers,
  editFocusState,
  refreshKeyState,
  rowHeightInPixels,
  ColumnEventHandlers,
  RowHeight,
  dgState,
} from "./shared";
import {
  DomStatements,
  ServiceStatements,
  StateStatements,
  StateStatementsOrFn,
} from "../../statements";
import * as yom from "../../yom";

export interface DefaultView {
  columnOrder?: string[];
  sort?: { column: string; sort: "asc" | "desc" }[];
  filter?: { column: string; op: string; value_1: string }[];
}

export interface DatagridBaseOpts {
  datagridStyles: DataGridStyles;
  children: (dgNode: Node, state: DgStateHelpers) => Node;
  dts: DatagridRfns;
  datagridName: string;
  additionalWhere?: yom.SqlExpression;
  columns: BaseColumn[];
  enableFiltering?: boolean;
  enableViews: boolean;
  pageSize?: number;
  defaultRowHeight?: RowHeight;
  /**
   * Extra state, kept outside of the query state, so only refreshed on view change.
   */
  extraState?: StateStatementsOrFn;
  /**
   * Re-evaluated every time the datagrid query is refreshed.
   */
  extraQueryState?: StateStatementsOrFn;
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
export function datagridBase(opts: DatagridBaseOpts) {
  const { columns, datagridStyles, dts } = opts;
  addDgFilterOp();
  const columnToResultField = new Map<number, string>();
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.queryGeneration) {
      columnToResultField.set(i, `field_${columnToResultField.size}`);
    }
  }
  const getResultsProc = new StateStatements();
  getResultsProc.dynamicQuery({
    resultTable: "dg_table",
    query: makeDynamicQuery(dts, opts.source, opts.additionalWhere),
    columnCount: columns.filter((v) => Boolean(v.queryGeneration)).length,
  });
  getResultsProc.statements(opts.extraQueryState);
  let children = opts.children(
    nodes.dataGrid({
      table: "dg_table",
      tableKey: opts.idField,
      recordName: "dg_record",
      rowHeight: "row_height",
      headerHeight: "44",
      focusedColumn: "focus_state.column",
      focusedRow: "focus_state.row",
      shouldFocusCell: "focus_state.should_focus",
      styles: datagridStyles,
      on: {
        keyboardNavigation: (s) =>
          s
            .modify(
              `update ui.focus_state set column = cell.column, row = cell.row, should_focus = true`,
            )
            .modify(`update ui.editing_state set is_editing = false`),
        cellClick: (s) =>
          s
            .modify(
              `update ui.focus_state set column = cell.column, row = cell.row, should_focus = true`,
            )
            .modify(`update ui.editing_state set is_editing = false`)
            .statements(colClickHandlers(columns)),
        cellDoubleClick: (s) =>
          s
            .modify(
              `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`,
            )
            .modify(
              `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`,
            )
            .setScalar(`ui.start_edit_empty`, `false`),
        cellKeydown: colKeydownHandlers(columns),
        fetchMore:
          typeof opts.pageSize === "number"
            ? new DomStatements()
                .setScalar(`ui.row_count`, `ui.row_count + ${opts.pageSize}`)
                .statements(dgState.triggerRefresh)
            : undefined,
      },
      columns: columns
        .map((col, i) => [col, i] as const)
        .filter(([col]) => Boolean(col.displayInfo))
        .map(([col, i]) => {
          const field = columnToResultField.get(i);
          const { cell, header } = col.displayInfo!;
          return {
            cell: nodes.sourceMap(
              "cell " + col.viewStorageName ?? `(${i})`,
              cell(
                new CellHelpers(
                  {
                    column: i,
                    field: field,
                    idField: opts.idField,
                  },
                  `(select id from ui.column where displaying and ordering > (select ordering from ui.column where id = ${i}) order by ordering limit 1)`,
                  `cast(dg_record.${opts.idField} as bigint)`,
                ),
                dgState,
              ),
            ),
            header: nodes.sourceMap(
              "header cell " + col.viewStorageName ?? `(${i})`,
              header(dgState),
            ),
            width: `(select width from column where id = ${i})`,
            ordering: `(select ordering from column where id = ${i})`,
            visible: `(select displaying from column where id = ${i})`,
          };
        }),
    }),
    dgState,
  );
  children = nodes.state({
    watch: opts.enableViews
      ? ["dg_refresh_key", "view", "reset_key", "global_refresh_key"]
      : ["dg_refresh_key", "global_refresh_key"],
    procedure: getResultsProc,
    statusScalar: "status",
    errorRecord: "dg_error",
    children,
  });
  children = nodes.state({
    watch: opts.enableViews ? ["view", "reset_key"] : [],
    procedure: refreshKeyState(),
    children,
  });
  const mainStateProc = editFocusState();
  if (opts.pageSize) {
    mainStateProc.scalar(`row_count`, opts.pageSize.toString());
  }
  const initialColumnInsertValues = opts.columns
    .map((col, i) => {
      const generate = col.queryGeneration?.alwaysGenerate ?? false;
      const prevDisplayCount = opts.columns
        .slice(0, i)
        .filter((v) => Boolean(v.displayInfo)).length;
      const initialWidth = col.displayInfo?.initialWidth ?? 0;
      const initiallyDisplaying = col.displayInfo?.initiallyDisplaying ?? false;
      return `(${i}, ${initialWidth}, ${initiallyDisplaying}, ordering.n_after(${prevDisplayCount}), ${generate}, ${Boolean(
        col.queryGeneration,
      )})`;
    })
    .join(",");
  mainStateProc
    .table("column", [
      { name: "id", type: { type: "SmallUint" } },
      { name: "width", type: { type: "SmallUint" } },
      { name: "displaying", type: { type: "Bool" } },
      { name: "sort_index", type: { type: "TinyUint" } },
      { name: "sort_asc", type: { type: "Bool" } },
      { name: "ordering", notNull: true, type: { type: "Ordering" } },
      { name: "always_generate", notNull: true, type: { type: "Bool" } },
      { name: "has_query_generation", notNull: true, type: { type: "Bool" } },
    ])
    .modify(
      `insert into column (id, width, displaying, ordering, always_generate, has_query_generation) values ${initialColumnInsertValues}`,
    )
    .scalar(
      `row_height`,
      rowHeightInPixels(opts.defaultRowHeight ?? "medium").toString(),
    );
  if (opts.enableFiltering) {
    mainStateProc
      .scalar("root_filter_is_any", "false")
      .table("filter_term", [
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
      ])
      .scalar(`next_filter_id`, { type: "BigUint" }, `0`);
  }
  if (opts.enableViews) {
    const loadFilter = new StateStatements();
    if (opts.enableFiltering) {
      loadFilter
        .modify(
          `insert into filter_term
            select id,
              fn.${dts.storageNameToId}(column_name) as column_id,
              group,
              ordering,
              is_any,
              op,
              value_1,
              value_2,
              value_3
            from db.datagrid_view_filter_term where view = view_record.id`,
        )
        .setScalar(
          `next_filter_id`,
          `coalesce((select max(id) from filter_term), 0) + 1`,
        );
    }
    const loadDefault = new StateStatements();
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
              `Invalid default view column order: column ${name} not found`,
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
            (col) => name === col.column,
          );
          if (sortIndex !== -1) {
            const asc = opts.defaultView.sort[sortIndex].sort === "asc";
            sortFields = `, sort_index = ${sortIndex}, sort_asc = ${asc} `;
          }
        }
        loadDefault.modify(
          `update column set ordering = ordering.n_after(${i})${sortFields} where id = ${id}`,
        );
      }
      if (opts.defaultView.filter) {
        for (let i = 0; i < opts.defaultView.filter.length; i++) {
          const filter = opts.defaultView.filter[i];
          const id = reordered.find((x) => x.name === filter.column)?.id;
          if (!id) {
            throw new Error(
              `Invalid default view filter: column ${filter.column} not found`,
            );
          }
          loadDefault
            .modify(
              `insert into filter_term (id, column_id, ordering, op, value_1) values
            (next_filter_id, ${id}, ordering.n_after(${i}), cast(${stringLiteral(
              filter.op,
            )} as enums.dg_filter_op), ${stringLiteral(filter.value_1)})`,
            )
            .setScalar(`next_filter_id`, `next_filter_id + 1`);
        }
      }
    } else {
      loadDefault.forEachQuery(`select id from column`, `column_record`, (s) =>
        s.modify(
          `update column
                  set ordering = ordering.new((select max(ordering) from column))
                  where id = column_record.id`,
        ),
      );
    }
    mainStateProc.block((s) =>
      s
        .scalar(`using_view`, `false`)
        .if("view is not null", (s) =>
          s
            .record(
              `view_record`,
              `select * from db.datagrid_view where id = view`,
            )
            .if(`view_record.id is not null`, (s) =>
              s
                .setScalar(`using_view`, `true`)
                .setScalar(
                  `root_filter_is_any`,
                  `view_record.root_filter_is_any`,
                )
                .setScalar(`row_height`, `view_record.row_height`)
                .forEachQuery(
                  `select * from db.datagrid_view_column where view = view_record.id`,
                  `view_column`,
                  (s) =>
                    s.modify(
                      `update column set ordering = view_column.ordering,
                  sort_asc = view_column.sort_asc,
                  sort_index = view_column.sort_index,
                  displaying = view_column.displaying
                where id = fn.${dts.storageNameToId}(view_column.name)`,
                    ),
                )
                .forEachQuery(
                  `select id from column where id not in (select fn.${dts.storageNameToId}(name) from db.datagrid_view_column where view = view_record.id)`,
                  `column_record`,
                  (s) =>
                    s.modify(
                      `update column
                  set ordering = ordering.new((select max(ordering) from column))
                  where id = column_record.id`,
                    ),
                )
                .statements(loadFilter),
            ),
        )
        .if("not using_view", loadDefault),
    );
  }
  mainStateProc.statements(opts.extraState);
  children = nodes.state({
    watch: opts.enableViews ? ["view", "reset_key"] : [],
    procedure: mainStateProc,
    children,
  });
  if (opts.enableViews) {
    children = nodes.state({
      procedure: (s) =>
        s.scalar("view_drawer_open", "false").scalar("reset_key", "0"),
      children,
    });
    children = nodes.queryParams(
      [{ name: "view", type: { type: "BigUint" } }],
      children,
    );
  }
  return children;
}

export interface BaseColumnQueryGeneration {
  expr: yom.SqlExpression;
  alwaysGenerate: boolean;
}

export interface BaseColumnDisplayInfo {
  initialWidth: number;
  cell: CellNode;
  header: (state: DgStateHelpers) => Node;
  initiallyDisplaying: boolean;
}

export interface BaseColumn extends ColumnEventHandlers {
  queryGeneration?: BaseColumnQueryGeneration;
  filterExpr?: (
    value1: yom.SqlExpression,
    value2: yom.SqlExpression,
    value3: yom.SqlExpression,
  ) => yom.SqlExpression;
  displayInfo?: BaseColumnDisplayInfo;
  viewStorageName?: string;
  downloadName?: string;
}

export interface DatagridRfns {
  idToFilterExpr?: string;
  idToSqlExpr: string;
  idToStorageName: string;
  storageNameToId: string;
  idToDownloadName?: string;
}

export function addDatagridRfns(
  datagridName: string,
  columns: BaseColumn[],
): DatagridRfns {
  const sqlExprs: string[][] = [];
  const storageNamesToIds: string[][] = [];
  const idsToStorageNames: string[][] = [];
  const idsToFilterExpr: string[][] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.queryGeneration) {
      sqlExprs.push([i.toString(), stringLiteral(col.queryGeneration.expr)]);
    }
    if (col.viewStorageName) {
      const storageName = stringLiteral(col.viewStorageName);
      storageNamesToIds.push([storageName, i.toString()]);
      idsToStorageNames.push([i.toString(), storageName]);
    }
    if (col.filterExpr) {
      idsToFilterExpr.push([
        i.toString(),
        col.filterExpr(`input.value_1`, `input.value_2`, `input.value_3`),
      ]);
    }
  }
  const storageNameToIdDt = `${datagridName}_dg_col_storage_name_to_id`;
  system.rulesFunction({
    parameters: [
      {
        name: "sql_name",
        type: { type: "String", maxLength: 2000 },
      },
    ],
    rules: [["input.sql_name", "id"], ...storageNamesToIds],
    name: storageNameToIdDt,
    returnType: "Int",
  });
  const idToStorageName = `${datagridName}_dg_col_id_to_storage_name`;
  system.rulesFunction({
    parameters: [{ name: "id", type: "SmallUint" }],
    rules: [["input.id", "storage_name"], ...idsToStorageNames],
    name: idToStorageName,
    returnType: "String",
  });
  const idToSqlExprDt = `${datagridName}_dg_col_id_to_sql_expr`;
  system.rulesFunction({
    parameters: [{ name: "id", type: "SmallUint", notNull: true }],
    rules: [["input.id", "sql_expr"], ...sqlExprs],
    name: idToSqlExprDt,
    returnType: "String",
  });
  let idToFilterExpr;
  if (idsToFilterExpr.length > 0) {
    idToFilterExpr = `${datagridName}_dg_col_id_to_filter_expr`;
    system.rulesFunction({
      parameters: [
        { name: "id", type: "SmallUint", notNull: true },
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
      rules: [["input.id", "sql_expr"], ...idsToFilterExpr],
      returnType: "String",
      name: idToFilterExpr,
    });
  }
  return {
    idToSqlExpr: idToSqlExprDt,
    storageNameToId: storageNameToIdDt,
    idToStorageName,
    idToFilterExpr,
  };
}

function insertViewColumnsAndFilters(dts: DatagridRfns, viewId: string) {
  return new ServiceStatements()
    .modify(
      `insert into db.datagrid_view_column
          select ${viewId} as view, displaying, ordering, sort_asc, sort_index, fn.${dts.idToStorageName}(id) as name
          from ui.column
          where fn.${dts.idToStorageName}(id) is not null`,
    )
    .table("filter_mapping", [
      { name: "ui_id", type: { type: "BigUint" } },
      {
        name: "db_id",
        type: { type: "BigUint" },
      },
    ])
    .forEachQuery(
      "select id from ui.filter_term where group is null",
      "filter_term_record",
      (s) =>
        s
          .modify(
            `insert into db.datagrid_view_filter_term select *, ${viewId} as view, fn.${dts.idToStorageName}(column_id) as column_name from ui.filter_term where id = filter_term_record.id`,
          )
          .modify(
            `insert into filter_mapping (ui_id, db_id) values (filter_term_record.id, (select max(id) from db.datagrid_view_filter_term))`,
          ),
    )
    .table(
      `sub_root_term`,
      `select id from ui.filter_term where group in (select ui_id from filter_mapping)`,
    )
    .forEachTable("sub_root_term", "filter_term_record", (s) =>
      s
        .modify(
          `insert into db.datagrid_view_filter_term
              select *, db_id as group, ${viewId} as view, fn.${dts.idToStorageName}(column_id) as column_name
                from ui.filter_term
                  join filter_mapping on ui_id = group
                where id = filter_term_record.id`,
        )
        .modify(
          `insert into filter_mapping (ui_id, db_id) values (filter_term_record.id, (select max(id) from db.datagrid_view_filter_term))`,
        ),
    )
    .forEachQuery(
      "select id from ui.filter_term where group in (select id from sub_root_term)",
      "filter_term_record",
      (s) =>
        s.modify(
          `insert into db.datagrid_view_filter_term
              select *, db_id as group, ${viewId} as view, fn.${dts.idToStorageName}(column_id) as column_name
                from ui.filter_term
                  join filter_mapping on ui_id = group
                where id = filter_term_record.id`,
        ),
    );
}

export function saveToExistingView(dts: DatagridRfns, viewId: string) {
  return (
    new ServiceStatements()
      .startTransaction()
      .modify(
        `update db.datagrid_view set root_filter_is_any = ui.root_filter_is_any, row_height = ui.row_height where id = ${viewId}`,
      )
      // just deleting and re-inserting is much easier
      .modify(`delete from db.datagrid_view_column where view = ${viewId}`)
      .modify(`delete from db.datagrid_view_filter_term where view = ${viewId}`)
      .statements(insertViewColumnsAndFilters(dts, viewId))
      .commitTransaction()
  );
}

export function saveAsNewView(
  datagridName: string,
  dts: DatagridRfns,
  name: string,
  isPersonal: string,
) {
  const maxOrdering = `(select max(ordering) from db.datagrid_view where datagrid_name = ${stringLiteral(
    datagridName,
  )} and case when ${isPersonal} then user = current_user() else user is null end)`;
  return new ServiceStatements()
    .startTransaction()
    .modify(
      `insert into db.datagrid_view (name, ordering, datagrid_name, root_filter_is_any, user, row_height)
          values (
            ${name},
            ordering.new(${maxOrdering}),
            ${stringLiteral(datagridName)},
            ui.root_filter_is_any,
            case when ${isPersonal} then current_user() else null end,
            ui.row_height
          )`,
    )
    .statements(
      insertViewColumnsAndFilters(dts, `last_record_id(db.datagrid_view)`),
    )
    .scalar(`view_id`, `last_record_id(db.datagrid_view)`)
    .commitTransaction();
}

export function duplicateView(viewId: string) {
  const sameUserAsOldView = `case when old_view.user is null then user is null else old_view.user = user end`;
  return new ServiceStatements()
    .startTransaction()
    .record(`old_view`, `select * from db.datagrid_view where id = ${viewId}`)
    .scalar(`base_name`, `old_view.name || ' copy'`)
    .scalar(`check_count`, `1`)
    .scalar(`new_name`, `base_name`)
    .while(
      `exists (select 1 from db.datagrid_view where name = new_name and datagrid_name = old_view.datagrid_name and ${sameUserAsOldView})`,
      (s) =>
        s
          .setScalar(`check_count`, `check_count + 1`)
          .setScalar(`new_name`, `base_name || ' ' || check_count`),
    )
    .modify(
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
          from db.datagrid_view as original where id = ${viewId}`,
    )
    .scalar(`new_view_id`, `last_record_id(db.datagrid_view)`)
    .modify(
      `insert into db.datagrid_view_column select *, new_view_id as view from db.datagrid_view_column where view = ${viewId}`,
    )
    .table("filter_mapping", [
      { name: "old_id", type: { type: "BigUint" } },
      {
        name: "new_id",
        type: { type: "BigUint" },
      },
    ])
    .forEachQuery(
      `select id from db.datagrid_view_filter_term where group is null and view = ${viewId}`,
      "filter_term_record",
      (s) =>
        s
          .modify(
            `insert into db.datagrid_view_filter_term select *, new_view_id as view from db.datagrid_view_filter_term where id = filter_term_record.id`,
          )
          .modify(
            `insert into filter_mapping (old_id, new_id) values (filter_term_record.id, (select max(id) from db.datagrid_view_filter_term))`,
          ),
    )
    .table(
      `sub_root_term`,
      `select id from db.datagrid_view_filter_term where view = ${viewId} and group in (select old_id from filter_mapping)`,
    )
    .forEachTable("sub_root_term", "filter_term_record", (s) =>
      s
        .modify(
          `insert into db.datagrid_view_filter_term
              select *, new_id as group, new_view_id as view
                from db.datagrid_view_filter_term
                  join filter_mapping on old_id = group
                where id = filter_term_record.id`,
        )
        .modify(
          `insert into filter_mapping (old_id, new_id) values (filter_term_record.id, (select max(id) from db.datagrid_view_filter_term))`,
        ),
    )
    .forEachQuery(
      `select id from db.datagrid_view_filter_term where view = ${viewId} and group in (select id from sub_root_term)`,
      "filter_term_record",
      (s) =>
        s.modify(
          `insert into db.datagrid_view_filter_term
              select *, new_id as group, new_view_id as view
                from db.datagrid_view_filter_term
                  join filter_mapping on old_id = group
                where id = filter_term_record.id`,
        ),
    )
    .commitTransaction();
}

function filterExpr(dts: DatagridRfns) {
  function serializeFilter(filter: string) {
    const encodeFilterOp = `fn.encode_dg_filter_op(
      op => ${filter}.op,
      expr => fn.${dts.idToSqlExpr}(${filter}.column_id),
      value_1 => ${filter}.value_1,
      value_2 => ${filter}.value_2,
      value_3 => ${filter}.value_3
    )`;
    if (dts.idToFilterExpr) {
      return `case
        when ${filter}.op = 'custom' then
          fn.${dts.idToFilterExpr}(${filter}.column_id, ${filter}.value_1, ${filter}.value_2, ${filter}.value_3)
        else ${encodeFilterOp}
      end`;
    } else {
      return encodeFilterOp;
    }
  }
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
  dts: DatagridRfns,
  source: string,
  additionalWhere: yom.SqlExpression | undefined,
) {
  return [
    `' from '`,
    stringLiteral(source),
    `' as record where '`,
    `coalesce(${filterExpr(dts)}, 'true')`,
    additionalWhere
      ? `coalesce(' and (' || ${additionalWhere} || ')', '')`
      : false,
  ]
    .filter(Boolean)
    .join(`||`);
}

const orderByPart = `coalesce(
  ' order by ' || (select
    string_agg('col_' || id || (case when sort_asc then ' nulls last' else ' desc nulls last' end), ',')
    from (select id, sort_asc from ui.column where sort_index is not null order by sort_index)),
  ''
)`;

const shouldGenerateColumn = `displaying or always_generate or sort_index is not null`;

export function makeDynamicQuery(
  dts: DatagridRfns,
  source: string,
  additionalWhere: yom.SqlExpression | undefined,
): string {
  return [
    `'select ' `,
    `(select string_agg(
        case
          when not has_query_generation then null
          when ${shouldGenerateColumn} then fn.${dts.idToSqlExpr}(id) || ' as col_' || id
          else 'null'
        end, ',')
      from ui.column
    )`,
    fromAndWherePart(dts, source, additionalWhere),
    orderByPart,
    `' limit '`,
    `ui.row_count`,
  ].join("||");
}

export function makeDownloadQuery(
  dts: DatagridRfns,
  source: string,
  quickSearch: yom.SqlExpression | undefined,
): string {
  if (!dts.idToDownloadName) {
    throw new Error("idToDownloadName is required for download queries");
  }
  return [
    `'select ' `,
    `(select string_agg(
        case
          when ${shouldGenerateColumn} then fn.${dts.idToSqlExpr}(id) || ' as ' || fn.${dts.idToDownloadName}(id)
        end
      from ui.column
    )`,
    fromAndWherePart(dts, source, quickSearch),
    orderByPart,
    `' limit ' || ui.row_count`,
  ].join("||");
}

export function makeCountQuery(
  dts: DatagridRfns,
  source: string,
  quickSearch: yom.SqlExpression | undefined,
): string {
  return [
    `'select count(*) '`,
    fromAndWherePart(dts, source, quickSearch),
  ].join("||");
}

export function makeIdsQuery(
  dts: DatagridRfns,
  source: string,
  primaryKeyIdent: yom.SqlExpression,
  quickSearch: yom.SqlExpression | undefined,
): string {
  return [
    `'select ${primaryKeyIdent} '`,
    fromAndWherePart(dts, source, quickSearch),
  ].join("||");
}

export function addViewTables(datagridNames: string[]) {
  system.enum_({
    name: "datagrid_name",
    values: datagridNames,
  });
  system.db.table("datagrid_view", (t) => {
    t.string("name", 200).notNull();
    t.enum("datagrid_name").notNull();
    t.fk("user", system.db.userTableName);
    t.bool("root_filter_is_any").notNull();
    t.smallUint("row_height").notNull();
    t.ordering("ordering").notNull();
    t.unique([
      "name",
      { field: "user", distinctNulls: false },
      "datagrid_name",
    ]);
    t.skipAutoApi();
  });
  system.db.table("datagrid_view_column", (t) => {
    t.fk("view", "datagrid_view").notNull();
    t.string("name", 200).notNull();
    t.bool("displaying").notNull();
    t.ordering("ordering").notNull();
    t.tinyUint("sort_index");
    t.bool("sort_asc");
    t.skipAutoApi();
  });
  system.db.table("datagrid_view_filter_term", (t) => {
    t.fk("view", "datagrid_view").notNull();
    t.fk("group", "datagrid_view_filter_term");
    t.ordering("ordering").notNull();
    t.bool("is_any");
    t.string("column_name", 200);
    t.enum("op", "dg_filter_op");
    t.string("value_1", 2000);
    t.string("value_2", 2000);
    t.string("value_3", 2000);
    t.skipAutoApi();
  });
  addDgFilterOp();
}

function addDgFilterOp() {
  if (!system.enums.dg_filter_op) {
    system.enum_({
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
        "timestamp_eq",
        "timestamp_ne",
        "timestamp_lt",
        "timestamp_lte",
        "timestamp_gt",
        "timestamp_gte",
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
        "custom",
      ],
      withBoolRulesFn: [
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
          name: "is_timestamp_filter_op",
          trues: [
            "timestamp_eq",
            "timestamp_ne",
            "timestamp_lt",
            "timestamp_lte",
            "timestamp_gt",
            "timestamp_gte",
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
    system.rulesFunction({
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
      rules: [
        ["input.value_1", "input.value_2", "output"],
        ["'today'", "any", "'today()'"],
        ["'tomorrow'", "any", "'tomorrow()'"],
        ["'yesterday'", "any", "'yesterday()'"],
        ["'week ago'", "any", `'date.add(week, -1, today())'`],
        ["'week from now'", "any", `'date.add(week, 1, today())'`],
        ["'month ago'", "any", `'date.add(month, -1, today())'`],
        ["'month from now'", "any", `'date.add(month, 1, today())'`],
        [
          "'number of days ago'",
          "exists",
          `literal.date(date.add(day, -try_cast(input.value_2 as int), today()))`,
        ],
        [
          "'number of days from now'",
          "exists",
          `literal.date(date.add(day, try_cast(input.value_2 as int), today()))`,
        ],
        ["'exact date'", "exists", "literal.date(input.value_2)"],
      ],
      returnType: "String",
    });
    system.rulesFunction({
      name: "encode_dg_filter_op",
      parameters: [
        {
          name: "op",
          type: { type: "Enum", enum: "dg_filter_op" },
          notNull: true,
        },
        {
          name: "expr",
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
      rules: [
        ["input.op", "output"],
        ["'empty'", "input.expr || ' is null'"],
        ["'not_empty'", "input.expr || ' is not null'"],
        // string
        [
          "'str_eq'",
          `coalesce(input.expr || '=' || literal.string(input.value_1), 'true')`,
        ],
        [
          "'str_ne'",
          `coalesce(input.expr || '!=' || literal.string(input.value_1), 'true')`,
        ],
        [
          "'str_contains'",
          `coalesce(input.expr || ' like ''%'' || ' || literal.string(input.value_1) || '|| ''%''', 'true')`,
        ],
        [
          "'str_not_contains'",
          `coalesce(input.expr || ' not like ''%'' || ' || literal.string(input.value_1) || '|| ''%''', 'true')`,
        ],
        // number
        [
          "input.op = 'num_eq' or input.op = 'minute_duration_eq'",
          `coalesce(input.expr || '=' || literal.number(input.value_1), 'true')`,
        ],
        [
          "input.op = 'num_ne' or input.op = 'minute_duration_ne'",
          `coalesce(input.expr || '!=' || literal.number(input.value_1), 'true')`,
        ],
        [
          "input.op = 'num_lt' or input.op = 'minute_duration_lt'",
          `coalesce(input.expr || '<' || literal.number(input.value_1), 'true')`,
        ],
        [
          "input.op = 'num_lte' or input.op = 'minute_duration_lte'",
          `coalesce(input.expr || '<=' || literal.number(input.value_1), 'true')`,
        ],
        [
          "input.op = 'num_gt' or input.op = 'minute_duration_gt'",
          `coalesce(input.expr || '>' || literal.number(input.value_1), 'true')`,
        ],
        [
          "input.op = 'num_gte' or input.op = 'minute_duration_gte'",
          `coalesce(input.expr || '>=' || literal.number(input.value_1), 'true')`,
        ],
        // date
        [
          "'date_eq'",
          `coalesce(input.expr || '=' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'date_ne'",
          `coalesce(input.expr || '!=' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'date_lt'",
          `coalesce(input.expr || '<' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'date_lte'",
          `coalesce(input.expr || '<=' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'date_gt'",
          `coalesce(input.expr || '>' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'date_gte'",
          `coalesce(input.expr || '>=' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        // timestamp
        [
          "'timestamp_eq'",
          `coalesce('cast(' || input.expr || ' as date) =' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'timestamp_ne'",
          `coalesce('cast(' || input.expr || ' as date) !=' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'timestamp_lt'",
          `coalesce('cast(' || input.expr || ' as date) <' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'timestamp_lte'",
          `coalesce('cast(' || input.expr || ' as date) <=' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'timestamp_gt'",
          `coalesce('cast(' || input.expr || ' as date) >' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        [
          "'timestamp_gte'",
          `coalesce('cast(' || input.expr || ' as date) >=' || fn.encode_date_dg_filter_param(input.value_1, input.value_2), 'true')`,
        ],
        // enum
        [
          "'enum_eq'",
          `coalesce(input.expr || '=' || literal.string(input.value_1), 'true')`,
        ],
        [
          "'enum_ne'",
          `coalesce(input.expr || '!=' || literal.string(input.value_1), 'true')`,
        ],
        // foreign keys
        [
          "'fk_eq'",
          `coalesce(input.expr || '=' || literal.number(input.value_1), 'true')`,
        ],
        [
          "'fk_ne'",
          `coalesce(input.expr || '!=' || literal.number(input.value_1), 'true')`,
        ],
        // bool
        [
          "'bool_eq'",
          `case when input.value_1 = 'true' then input.expr || '=true' else '(' || input.expr || ' is null or ' || input.expr || '=false)' end`,
        ],
        [
          "'enum_like_bool_eq'",
          `case when input.value_1 = 'true' then input.expr || '=true' when input.value_1 = 'false' then input.expr || '=false' else input.expr || ' is null' end`,
        ],
        ["any", "'true'"],
      ],
      returnType: "String",
    });
  }
}
