import { Field, VirtualType } from "../modelTypes.js";
import { model } from "../singleton.js";
import { SequentialIDGenerator } from "../utils/SequentialIdGenerator.js";
import { FieldIntegerTypes } from "../yom.js";
import { ident, tableFieldSql, tableIdSql } from "./sqlHelpers.js";

export interface RelatedUnionOpts {
  orderBy: string;
  orderByFields: string[];
  foreignKeyExpr: string;
  foreignKeyTable: string;
  tables: {
    table: string;
    customFrom?: string;
    orderByExprs: string[];
    fields: string[];
    exprs: { name: string; expr: string; type: VirtualType }[];
    foreignKeyField?: string;
  }[];
  limit?: string;
}

export interface UnionRecordHelper {
  field(s: string): string;
}

interface Union {
  query: string;
  getRecordHelper: (table: string, recordName: string) => UnionRecordHelper;
}

function normalizeIntTypes(ty: FieldIntegerTypes): string {
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

    case "Duration":
      return normalizeIntTypes(field.backing);

    case "String":
      return "String";

    case "Enum":
      return "enum_" + field.enum;
    case "ForeignKey":
      return "BigInt";
  }
  return field.type;
}

function getVirtualTypeKey(ty: VirtualType): string {
  switch (ty.type) {
    case "String":
      return "String";

    case "Enum":
      return "enum_" + ty.enum;
    case "ForeignKey":
      return "BigInt";
  }
  return ty.type;
}

export function createRelatedUnionQuery(opts: RelatedUnionOpts): Union {
  const fieldIdGen = new SequentialIDGenerator();
  type Source = { table: string } & (
    | { field: string }
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
        !mergeField.sources.some((s) => s.table === source.table)
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
  for (const t of opts.tables) {
    const table = model.database.tables[t.table];
    for (const f of t.fields) {
      const typeKey = getTypeKey(table.fields[f]);
      mergeField(typeKey, { table: t.table, field: f });
    }
    for (const e of t.exprs) {
      const typeKey = getVirtualTypeKey(e.type);
      mergeField(typeKey, { table: t.table, expr: e.expr, exprName: e.name });
    }
  }
  const queries: string[] = [];
  for (let i = 0; i < opts.tables.length; i++) {
    const t = opts.tables[i];
    let query = ` select ${tableIdSql(t.table)} as id, ${i} as event_type`;
    for (let i = 0; i < t.orderByExprs.length; i++) {
      const name = opts.orderByFields[i];
      const expr = t.orderByExprs[i];
      query += `,${expr} as ${name}`;
    }
    for (const mergedField of mergedFields) {
      const onSource = mergedField.sources.find((s) => s.table === t.table);
      if (onSource) {
        const expr =
          "field" in onSource
            ? tableFieldSql(t.table, onSource.field)
            : onSource.expr;
        query += `,${expr} as ${mergedField.id}`;
      } else {
        query += `,null as ${mergedField.id}`;
      }
    }
    let foreignKeyField = t.foreignKeyField;
    if (!foreignKeyField) {
      const table = model.database.tables[t.table];
      for (const f of Object.values(table.fields)) {
        if (f.type === "ForeignKey" && f.table === opts.foreignKeyTable) {
          if (foreignKeyField) {
            throw new Error(
              "Please specify a foreignKeyField when multiple fields could be used"
            );
          }
          foreignKeyField = f.name.name;
        }
      }
    }
    if (t.customFrom) {
      query += " " + t.customFrom;
    } else {
      const foreignKeyFieldSql = tableFieldSql(t.table, foreignKeyField!);
      query += ` from db.${ident(t.table)} where ${foreignKeyFieldSql} = ${
        opts.foreignKeyExpr
      }`;
    }
    queries.push(query);
  }
  let query = queries.join(" union all ") + ` order by ${opts.orderBy}`;
  if (opts.limit) {
    query += ` limit ${opts.limit}`;
  }
  return {
    query,
    getRecordHelper: (table, recordName) => ({
      field: (field) => {
        const foundField = mergedFields.find((f) =>
          f.sources.some(
            (s) =>
              s.table === table &&
              (("expr" in s && s.exprName === field) ||
                ("field" in s && s.field === field))
          )
        );
        if (foundField) {
          return recordName + "." + foundField.id;
        }
        throw new Error(
          `Field '${field}' does not exist in union for table '${table}'`
        );
      },
    }),
  };
}
