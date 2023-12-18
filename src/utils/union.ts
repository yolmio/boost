import { Field, hub } from "../hub";
import { SequentialIDGenerator } from "../utils/SequentialIdGenerator";
import * as yom from "../yom";
import { tableFieldSql } from "./sqlHelpers";

export interface TableUnionSource {
  type: "Table";
  table: string;
  customFrom?: string;
  orderByExprs: string[];
  fields?: string[];
  exprs?: UnionExpr[];
}

export type UnionExprType =
  | "String"
  | yom.SimpleScalarTypes
  | yom.ScalarIntegerTypes
  | { type: yom.SimpleScalarTypes | yom.ScalarIntegerTypes }
  | { type: "Enum"; enum: string };

export interface UnionExpr {
  name: string;
  expr: yom.SqlExpression;
  type: UnionExprType;
}

export interface QueryUnionSource {
  type: "Query";
  orderByExprs: string[];
  selectColumns: UnionExpr[];
  /**
   * This is not the full query for the source, but rather the part after the select i.e. the from clause on
   */
  query: string;
}

export type UnionSource = TableUnionSource | QueryUnionSource;

/**
 * This is a helper function to create a union query from multiple sources
 *
 * It will merge the fields from each source together and order them by the orderBy clause provided.
 * The merging is done by expression type and makes it possible to merge fields from different sources
 * and not end up with a union with a hundred columns.
 */
export interface UnionOpts {
  /**
   * Anything that fits as an order by clause
   *
   * e.g. "id desc, name asc" or just "id"
   */
  orderBy: string;
  /**
   * The names of the fields that should be specified by each source
   * so we can merge them together and order by them with the orderBy clause
   */
  orderByFields: string[];
  sources: UnionSource[];
  limit?: yom.SqlExpression;
}

export interface Union {
  query: string;
  getField: (source: number, recordName: string, field: string) => string;
}

function normalizeIntTypes(ty: yom.FieldIntegerTypes): string {
  switch (ty) {
    case "TinyInt":
    case "TinyUint":
    case "SmallInt":
      return "SmallInt";
    case "SmallUint":
    case "Int":
      return "Int";
    case "Uint":
    case "BigInt":
    case "BigUint":
      return "BigInt";
  }
}

function getTypeKey(field: Field): string {
  switch (field.type) {
    case "TinyInt":
    case "TinyUint":
    case "SmallInt":
    case "SmallUint":
    case "Int":
    case "Uint":
    case "BigInt":
    case "BigUint":
      return normalizeIntTypes(field.type);

    case "String":
      return "String";

    case "Enum":
      return "enum_" + field.enum;
    case "ForeignKey":
      return "BigInt";
  }
  return field.type;
}

function getExprTypeKey(ty: UnionExprType): string {
  if (typeof ty === "string") {
    return ty;
  }
  if (ty.type === "Enum") {
    return "enum_" + ty.enum;
  }
  return ty.type;
}

export function createUnionQuery(opts: UnionOpts): Union {
  const fieldIdGen = new SequentialIDGenerator();
  type Source = { idx: number } & (
    | { field: string; table: string }
    | { expr: string; exprName: string }
  );
  const mergedFields: {
    id: string;
    type: string;
    sources: Source[];
  }[] = [];
  function mergeField(typeKey: string, source: Source) {
    const mergeField = mergedFields.find(
      (mergeField) =>
        mergeField.type === typeKey &&
        // We cannot merge fields from the same source
        !mergeField.sources.some((s) => s.idx === source.idx),
    );
    if (mergeField) {
      mergeField.sources.push(source);
    } else {
      mergedFields.push({
        id: fieldIdGen.next(),
        type: typeKey,
        sources: [source],
      });
    }
  }
  for (let i = 0; i < opts.sources.length; i++) {
    const source = opts.sources[i];
    if (source.type === "Table") {
      const table = hub.db.tables[source.table];
      if (source.fields) {
        for (const f of source.fields) {
          let typeKey: string;
          if (
            f === table.primaryKeyFieldName ||
            f === "created_by_tx" ||
            f === "last_modified_by_tx"
          ) {
            typeKey = "BigInt";
          } else {
            typeKey = getTypeKey(table.fields[f]);
          }
          mergeField(typeKey, { idx: i, field: f, table: source.table });
        }
      }
      if (source.exprs) {
        for (const e of source.exprs) {
          const typeKey = getExprTypeKey(e.type);
          mergeField(typeKey, { idx: i, expr: e.expr, exprName: e.name });
        }
      }
    } else {
      for (const e of source.selectColumns) {
        const typeKey = getExprTypeKey(e.type);
        mergeField(typeKey, { idx: i, expr: e.expr, exprName: e.name });
      }
    }
  }
  const queries: string[] = [];
  for (let sourceIdx = 0; sourceIdx < opts.sources.length; sourceIdx++) {
    const source = opts.sources[sourceIdx];
    let query = ` select ${sourceIdx} as union_source_idx`;
    for (let i = 0; i < source.orderByExprs.length; i++) {
      const name = opts.orderByFields[i];
      const expr = source.orderByExprs[i];
      query += `,${expr} as ${name}`;
    }
    for (const mergedField of mergedFields) {
      const onSource = mergedField.sources.find((s) => s.idx === sourceIdx);
      if (onSource) {
        const expr =
          "field" in onSource
            ? tableFieldSql(onSource.table, onSource.field)
            : onSource.expr;
        query += `,${expr} as ${mergedField.id}`;
      } else {
        query += `,null as ${mergedField.id}`;
      }
    }
    if (source.type === "Query") {
      query += " " + source.query;
    } else if (source.customFrom) {
      query += " " + source.customFrom;
    }
    queries.push(query);
  }
  let query = queries.join(" union all ") + ` order by ${opts.orderBy}`;
  if (opts.limit) {
    query += ` limit ${opts.limit}`;
  }
  return {
    query,
    getField: (idx, recordName, field) => {
      const foundField = mergedFields.find((f) =>
        f.sources.some(
          (s) =>
            s.idx === idx &&
            (("expr" in s && s.exprName === field) ||
              ("field" in s && s.field === field)),
        ),
      );
      if (foundField) {
        return recordName + "." + foundField.id;
      }
      throw new Error(
        `Field '${field}' does not exist in union for source '${idx}'`,
      );
    },
  };
}
