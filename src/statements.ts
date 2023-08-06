import type * as yom from "./yom.js";

function modify(this: Array<any>, sql: string) {
  this.push({ t: "Modify", sql });
  return this;
}

function throwError(message: string, description?: string): yom.ThrowStatement {
  return { t: "Throw", message, description };
}

function table(name: string, query: string): yom.TableDeclaration;
function table(
  name: string,
  fields: yom.ProcTableField[]
): yom.TableDeclaration;
function table(
  name: string,
  fields: yom.ProcTableField[],
  query: string
): yom.TableDeclaration;
function table(
  name: string,
  queryOrFields: string | yom.ProcTableField[],
  query?: string
): yom.TableDeclaration {
  return {
    t: "TableDeclaration",
    name,
    query:
      typeof queryOrFields === "string"
        ? queryOrFields
        : typeof query === "string"
        ? query
        : undefined,
    fields: Array.isArray(queryOrFields) ? queryOrFields : undefined,
  };
}

function record(
  name: string,
  queryOrFields: string | yom.ProcTableField[]
): yom.RecordDeclaration {
  return {
    t: "RecordDeclaration",
    name,
    query: typeof queryOrFields === "string" ? queryOrFields : undefined,
    fields: Array.isArray(queryOrFields) ? queryOrFields : undefined,
  };
}

function createTableCursor(
  name: string,
  table: string
): yom.CreateTableCursorStatement {
  return {
    t: "CreateTableCursor",
    name,
    table: table,
  };
}

function createQueryCursor(
  name: string,
  query: string
): yom.CreateQueryCursorStatement {
  return {
    t: "CreateQueryCursor",
    name,
    query,
  };
}

function advanceCursor(cursor: string): yom.AdvanceCursorStatement {
  return { t: "AdvanceCursor", cursor };
}

function continue_(label?: string): yom.ContinueStatement {
  return { t: "Continue", label };
}

function break_(label?: string): yom.BreakStatement {
  return { t: "Break", label };
}

function scalar(name: string, ty: yom.FieldType): yom.ScalarDeclaration;
function scalar(
  name: string,
  ty: yom.FieldType,
  expr: string
): yom.ScalarDeclaration;
function scalar(name: string, expr: string): yom.ScalarDeclaration;
function scalar(
  name: string,
  exprOrTy: string | yom.FieldType,
  expr?: string
): yom.ScalarDeclaration {
  return {
    t: "ScalarDeclaration",
    name,
    expr: typeof exprOrTy === "string" ? exprOrTy : expr,
    type: typeof exprOrTy === "string" ? undefined : exprOrTy,
  };
}

function setScalar(name: string, expr: string): yom.SetScalar {
  return { t: "SetScalar", name, expr };
}

function if_<T>(
  condition: string,
  onTrue: T[] | T,
  onFalse?: T[] | T
): yom.IfStatement<T> {
  return {
    t: "If",
    condition,
    onTrue: Array.isArray(onTrue) ? onTrue : [onTrue],
    onFalse: Array.isArray(onFalse) ? onFalse : onFalse ? [onFalse] : [],
  };
}

function block<T>(body: T[] | T): yom.BlockStatement<T> {
  return { t: "Block", body: Array.isArray(body) ? body : [body] };
}

function while_<T>(condition: string, body: T[] | T): yom.WhileStatement<T>;
function while_<T>(
  condition: string,
  label: string,
  body: T[] | T
): yom.WhileStatement<T>;
function while_<T>(
  condition: string,
  label: T[] | T | string,
  body?: T[] | T
): yom.WhileStatement<T> {
  let resolvedBody = typeof label === "string" ? body : label;
  return {
    t: "While",
    condition,
    body: Array.isArray(resolvedBody)
      ? (resolvedBody as T[])
      : [resolvedBody as T],
    label: typeof label === "string" ? label : undefined,
  };
}

function forEachCursor<T>(
  cursor: string,
  body: T[] | T
): yom.ForEachCursorStatement<T>;
function forEachCursor<T>(
  cursor: string,
  label: string,
  body: T[] | T
): yom.ForEachCursorStatement<T>;
function forEachCursor<T>(
  cursor: string,
  label: T[] | T | string,
  body?: T[] | T
): yom.ForEachCursorStatement<T> {
  let resolvedBody = typeof label === "string" ? body : label;
  return {
    t: "ForEachCursor",
    cursor,
    body: Array.isArray(resolvedBody)
      ? (resolvedBody as T[])
      : [resolvedBody as T],
    label: typeof label === "string" ? label : undefined,
  };
}

function forEachQuery<T>(
  query: string,
  cursorName: string,
  body: T[] | T
): yom.ForEachQueryStatement<T>;
function forEachQuery<T>(
  query: string,
  cursorName: string,
  label: string,
  body: T[] | T
): yom.ForEachQueryStatement<T>;
function forEachQuery<T>(
  query: string,
  cursorName: string,
  label: T[] | T | string,
  body?: T[] | T
): yom.ForEachQueryStatement<T> {
  let resolvedBody = typeof label === "string" ? body : label;
  return {
    t: "ForEachQuery",
    cursorName,
    query,
    body: Array.isArray(resolvedBody)
      ? (resolvedBody as T[])
      : [resolvedBody as T],
    label: typeof label === "string" ? label : undefined,
  };
}

function forEachTable<T>(
  table: string,
  cursorName: string,
  body: T[] | T
): yom.ForEachTableStatement<T>;
function forEachTable<T>(
  table: string,
  cursorName: string,
  label: string,
  body: T[] | T
): yom.ForEachTableStatement<T>;
function forEachTable<T>(
  table: string,
  cursorName: string,
  label: T[] | T | string,
  body?: T[] | T
): yom.ForEachTableStatement<T> {
  let resolvedBody = typeof label === "string" ? body : label;
  return {
    t: "ForEachTable",
    cursorName,
    table,
    body: Array.isArray(resolvedBody)
      ? (resolvedBody as T[])
      : [resolvedBody as T],
    label: typeof label === "string" ? label : undefined,
  };
}

function try_<T>(this: Array<any>, opts: Omit<yom.TryStatement<T>, "t">) {
  this.push({ t: "Try", ...opts });
  return this;
}

function pushSource(source: string): yom.PushSourceStatement {
  return { t: "PushSource", source };
}

function popSource(): yom.PopSourceStatement {
  return { t: "PopSource" };
}

function exit(): yom.ReturnExprStatement {
  return { t: "ReturnExpr", expr: `null` };
}

function returnExpr(this: Array<any>, expr: string) {
  this.push({ t: "ReturnExpr", expr });
  return this;
}

function debugExpr(expr: string): yom.DebugExprStatement {
  return { t: "DebugExpr", expr };
}

function debugQuery(query: string): yom.DebugQueryStatement {
  return { t: "DebugQuery", query };
}

class BaseStatmentArray<T> extends Array<T> {
  modify(sql: string) {
    this.push({ t: "Modify", sql } as yom.ModifyStatement as any);
    return this;
  }

  returnExpr(expr: yom.SqlExpression) {
    this.push({ t: "ReturnExpr", expr } as yom.ReturnExprStatement as any);
    return this;
  }

  exit() {
    this.push({
      t: "ReturnExpr",
      expr: "null",
    } as yom.ReturnExprStatement as any);
    return this;
  }

  scalar(name: string, ty: yom.FieldType): this;
  scalar(name: string, ty: yom.FieldType, expr: yom.SqlExpression): this;
  scalar(name: string, expr: yom.SqlExpression): this;
  scalar(
    name: string,
    exprOrTy: yom.SqlExpression | yom.FieldType,
    expr?: yom.SqlExpression
  ) {
    this.push({
      t: "ScalarDeclaration",
      name,
      expr: typeof exprOrTy === "string" ? exprOrTy : expr,
      type: typeof exprOrTy === "string" ? undefined : exprOrTy,
    } as yom.ScalarDeclaration as any);
    return this;
  }

  setScalar(name: string, expr: yom.SqlExpression) {
    this.push({ t: "SetScalar", name, expr } as yom.SetScalar as any);
    return this;
  }

  createQueryCursor(name: string, query: yom.SqlQuery) {
    this.push({
      t: "CreateQueryCursor",
      name,
      query,
    } as yom.CreateQueryCursorStatement as any);
    return this;
  }

  advanceCursor(cursor: string) {
    this.push({
      t: "AdvanceCursor",
      cursor,
    } as yom.AdvanceCursorStatement as any);
    return this;
  }
}

interface Try<Arr> {
  body: (s: Arr) => Arr;
  errorName?: string;
  catch?: (s: Arr) => Arr;
  finally?: (s: Arr) => Arr;
}

export class BasicStatementArray extends BaseStatmentArray<yom.BasicStatement> {
  try(opts: Try<BasicStatementArray>) {
    this.push({
      t: "Try",
      body: opts.body(new BasicStatementArray()),
      errorName: opts.errorName,
      catch: opts.catch ? opts.catch(new BasicStatementArray()) : undefined,
      finally: opts.finally
        ? opts.finally(new BasicStatementArray())
        : undefined,
    });
    return this;
  }

  forEachCursor(
    cursor: string,
    body: (s: BasicStatementArray) => BasicStatementArray
  ) {
    this.push({
      t: "ForEachCursor",
      cursor,
      body: body(new BasicStatementArray()),
    });
    return this;
  }

  if(
    condition: yom.SqlExpression,
    onTrue: (s: BasicStatementArray) => BasicStatementArray,
    onFalse?: (s: BasicStatementArray) => BasicStatementArray
  ) {
    this.push({
      t: "If",
      condition,
      onTrue: onTrue(new BasicStatementArray()),
      onFalse: onFalse ? onFalse(new BasicStatementArray()) : [],
    });
    return this;
  }
}

export const statements = {
  get scalarFunction() {
    return new BasicStatementArray();
  },
};
