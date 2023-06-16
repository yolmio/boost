import { model } from "../singleton.js";

export function escapeStringLiteral(s: string) {
  return s.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char: string) {
    switch (char) {
      case "'":
        return "''";
      default:
        return char;
    }
  });
}

export function stringLiteral(s: string): string {
  return `'${escapeStringLiteral(s)}'`;
}

export const sqlEmailRegex = `'^[a-zA-Z0-9.!#$%&''*+/=?^_\`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'`;

export function parenWrap(s: string) {
  if (s.startsWith("(") && s.endsWith(")")) {
    return s;
  }
  return "(" + s + ")";
}

export function ident(s: string): string {
  return `"${s}"`;
}

export function recordDisplayNameExpr(table: string, recordName?: string) {
  const displayNameFn = model.database.tables[table].recordDisplayName;
  if (!displayNameFn) {
    throw new Error("table " + table + " has no recordDisplayName");
  }
  return displayNameFn.expr(
    ...displayNameFn.fields.map((f) => `${recordName ?? table}.${f}`)
  );
}

export function tableFieldSql(tableName: string, field: string) {
  const table = model.database.tables[tableName];
  if (!table) {
    throw new Error(
      `Tried to create sql for table ${tableName} but table does not exist`
    );
  }
  if (!table.fields[field]) {
    throw new Error(
      `Tried to create sql for table ${tableName} field ${field} but field does not exist`
    );
  }
  return `${ident(tableName)}.${ident(field)}`;
}

export function tableIdSql(tableName: string) {
  const table = model.database.tables[tableName];
  if (!table) {
    throw new Error(
      `Tried to create sql for table ${tableName} but table does not exist`
    );
  }
  const field = table.primaryKeyFieldName
    ? ident(table.primaryKeyFieldName)
    : "id";
  return `${ident(tableName)}.${field}`;
}
