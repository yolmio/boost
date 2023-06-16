import type * as yom from "./yom.js";

///
/// PROCEDURE
///

export function modify(sql: string): yom.ModifyStatement {
  return { t: "Modify", sql };
}

export function throwError(
  message: string,
  description?: string
): yom.ThrowStatement {
  return { t: "Throw", message, description };
}

export function table(name: string, query: string): yom.TableDeclaration;
export function table(
  name: string,
  fields: yom.ProcTableField[]
): yom.TableDeclaration;
export function table(
  name: string,
  fields: yom.ProcTableField[],
  query: string
): yom.TableDeclaration;
export function table(
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

export function record(
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

export function createTableCursor(
  name: string,
  table: string
): yom.CreateTableCursorStatement {
  return {
    t: "CreateTableCursor",
    name,
    table: table,
  };
}

export function createQueryCursor(
  name: string,
  query: string
): yom.CreateQueryCursorStatement {
  return {
    t: "CreateQueryCursor",
    name,
    query,
  };
}

export function advanceCursor(cursor: string): yom.AdvanceCursorStatement {
  return { t: "AdvanceCursor", cursor };
}

export function continue_(label?: string): yom.ContinueStatement {
  return { t: "Continue", label };
}

export function break_(label?: string): yom.BreakStatement {
  return { t: "Break", label };
}

export function scalar(name: string, ty: yom.FieldType): yom.ScalarDeclaration;
export function scalar(
  name: string,
  ty: yom.FieldType,
  expr: string
): yom.ScalarDeclaration;
export function scalar(name: string, expr: string): yom.ScalarDeclaration;
export function scalar(
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

export function setScalar(name: string, expr: string): yom.SetScalar {
  return { t: "SetScalar", name, expr };
}

export function if_<T>(
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

export function block<T>(body: T[] | T): yom.BlockStatement<T> {
  return { t: "Block", body: Array.isArray(body) ? body : [body] };
}

export function while_<T>(
  condition: string,
  body: T[] | T
): yom.WhileStatement<T>;
export function while_<T>(
  condition: string,
  label: string,
  body: T[] | T
): yom.WhileStatement<T>;
export function while_<T>(
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

export function forEachCursor<T>(
  cursor: string,
  body: T[] | T
): yom.ForEachCursorStatement<T>;
export function forEachCursor<T>(
  cursor: string,
  label: string,
  body: T[] | T
): yom.ForEachCursorStatement<T>;
export function forEachCursor<T>(
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

export function forEachQuery<T>(
  query: string,
  cursorName: string,
  body: T[] | T
): yom.ForEachQueryStatement<T>;
export function forEachQuery<T>(
  query: string,
  cursorName: string,
  label: string,
  body: T[] | T
): yom.ForEachQueryStatement<T>;
export function forEachQuery<T>(
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

export function forEachTable<T>(
  table: string,
  cursorName: string,
  body: T[] | T
): yom.ForEachTableStatement<T>;
export function forEachTable<T>(
  table: string,
  cursorName: string,
  label: string,
  body: T[] | T
): yom.ForEachTableStatement<T>;
export function forEachTable<T>(
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

export function try_<T>(
  opts: Omit<yom.TryStatement<T>, "t">
): yom.TryStatement<T> {
  return { t: "Try", ...opts };
}

export function pushSource(source: string): yom.PushSourceStatement {
  return { t: "PushSource", source };
}

export function popSource(): yom.PopSourceStatement {
  return { t: "PopSource" };
}

export function exit(): yom.ReturnExprStatement {
  return { t: "ReturnExpr", expr: `null` };
}

export function returnExpr(expr: string): yom.ReturnExprStatement {
  return { t: "ReturnExpr", expr };
}

export function debugExpr(expr: string): yom.DebugExprStatement {
  return { t: "DebugExpr", expr };
}

export function debugQuery(query: string): yom.DebugQueryStatement {
  return { t: "DebugQuery", query };
}

///
/// UI
///

export function dynamicQuery(
  props: Omit<yom.DynamicQueryStatement, "t">
): yom.DynamicQueryStatement {
  return { t: "DynamicQuery", ...props };
}

export function dynamicModify(sql: string): yom.DynamicModifyStatement {
  return { t: "DynamicModify", sql };
}

export function navigate(to: string, replace?: string): yom.NavigateStatement {
  return { t: "Navigate", to, replace };
}

export function download(filename: string, content: string): yom.Download {
  return { t: "Download", filename, content };
}

export function preventDefault(): yom.PreventDefault {
  return { t: "PreventDefault" };
}

export function stopPropagation(): yom.StopPropagation {
  return { t: "StopPropagation" };
}

export function delay(ms: string): yom.DelayStatement {
  return { t: "Delay", ms };
}

export function commitUiChanges(): yom.CommitUiChangesStatement {
  return { t: "CommitUiChanges" };
}

export function logOut(): yom.LogOutStatment {
  return { t: "LogOut" };
}

export function spawn(
  statements: yom.ClientProcStatement[] | Omit<yom.SpawnStatement, "t">
): yom.SpawnStatement {
  if (Array.isArray(statements)) {
    return { t: "Spawn", statements };
  }
  return { t: "Spawn", ...statements };
}

export function waitOnTask(handle: string): yom.WaitOnTaskStatement {
  return { t: "WaitOnTask", handle };
}

export function joinTasks(tasks: string[]): yom.JoinTasksStatement {
  return { t: "JoinTasks", tasks };
}

export function selectTasks(tasks: string[]): yom.SelectTasksStatement {
  return { t: "SelectTasks", tasks };
}

export function abortTask(handle: string): yom.AbortStatement {
  return { t: "Abort", handle };
}

export function setQueryParam(
  param: string,
  value: string,
  replace?: string
): yom.SetQueryParam {
  return { t: "SetQueryParam", param, value, replace };
}

export function startTransaction(
  opts: Omit<yom.StartTransactionStatement, "t"> = {}
): yom.StartTransactionStatement {
  return { t: "StartTransaction", ...opts };
}

export function commitTransaction(): yom.CommitTransactionStatement {
  return { t: "CommitTransaction" };
}

export function serviceProc(
  statements: yom.ServiceProcStatement[]
): yom.DoServiceProcStatement {
  return { t: "ServiceProc", statements };
}

export function scrollElIntoView(
  el: string | Omit<yom.ScrollIntoViewStatement, "t">
): yom.ScrollIntoViewStatement {
  return typeof el === "string"
    ? { t: "ScrollElIntoView", elementId: el }
    : { t: "ScrollElIntoView", ...el };
}

export function focusEl(el: string): yom.FocusElStatement {
  return { t: "FocusEl", elementId: el };
}

export function fileRefTable(
  name: string = "file_ref"
): yom.FileRefTableStatement {
  return { t: "FileRefTable", name };
}

export function queryToCsv(
  query: string,
  scalar: string
): yom.QueryToCsvStatement {
  return { t: "QueryToCsv", query, scalar };
}

export function dynamicQueryToCsv(
  query: string,
  scalar: string
): yom.DynamicQueryToCsv {
  return { t: "DynamicQueryToCsv", query, scalar };
}

export function addImage(
  opts: Omit<yom.AddImageStatement, "t">
): yom.AddImageStatement {
  return { t: "AddImage", ...opts };
}

export function addFile(
  opts: Omit<yom.AddFileStatement, "t">
): yom.AddFileStatement {
  return { t: "AddFile", ...opts };
}

export function getWindowProperty(
  property: yom.WindowProperty,
  scalar: string
): yom.GetWindowPropertyStatement {
  return { t: "GetWindowProperty", property, scalar };
}

export function getBoundingClientRect(
  el: string,
  record: string
): yom.GetBoundingClientRectStatement {
  return { t: "GetBoundingClientRect", elementId: el, record };
}

export function getElProperty(
  property: yom.ElProperty,
  scalar: string,
  el: string
): yom.GetElPropertyStatement {
  return { t: "GetElProperty", property, scalar, elementId: el };
}

///
/// SCRIPT
///

export function importCsv(db: string, dir: string): yom.ImportCsvStatement {
  return { t: "ImportCsv", db, dir };
}

export function saveDb(dir: string, db?: string): yom.SaveDbStatement {
  return { t: "SaveDb", dir, db };
}

export function loadDb(dir: string, db?: string): yom.LoadDbStatement {
  return { t: "LoadDb", dir, db };
}

export function pull(dir?: string): yom.PullStatement {
  return { t: "Pull", dir };
}

export function push(): yom.PushStatement {
  return { t: "Push" };
}

export function addUsers(
  query: string,
  outputTable?: string
): yom.AddUsersStatement {
  return { t: "AddUsers", query, outputTable };
}

export function setDb(
  opts?: Omit<yom.SetDbStatement, "t">
): yom.SetDbStatement {
  return { t: "SetDb", ...opts };
}

///
/// TEST
///

export function assertQuery(
  query: string,
  csv: string
): yom.TestAssertQueryStatement {
  return { t: "AssertQuery", query, csv };
}

export function snapshotQuery(query: string): yom.TestSnapshotQueryStatement {
  return { t: "SnapshotQuery", query };
}

export function snapshotUi(): yom.TestSnapshotUiStatement {
  return { t: "SnapshotUi" };
}

export function testNavigate(to: string): yom.TestNavigateStatement {
  return { t: "Navigate", to };
}

export function simulateClick(nodeId: string): yom.TestSimulateClickStatement {
  return { t: "SimulateClick", nodeId };
}

export function simulateSubmit(
  nodeId: string
): yom.TestSimulateSubmitStatement {
  return { t: "SimulateSubmit", nodeId };
}

export function simulateInput(
  nodeId: string,
  inputValue: string
): yom.TestSimulateInputStatement {
  return { t: "SimulateInput", nodeId, inputValue };
}

export function simulateFileChange(
  nodeId: string,
  files: yom.TestFileChangeStatement[]
): yom.TestSimulateFileChangeStatement {
  return { t: "SimulateFileChange", nodeId, files };
}

export function setRequestResponse(
  opts: Omit<yom.TestSetRequestResponseStatement, "t">
): yom.TestSetRequestResponseStatement {
  return { t: "SetRequestResponse", ...opts };
}

export function setTestTime(to: string): yom.TestSetTestTimeStatement {
  return { t: "SetTestTime", to };
}

export function advanceMs(ms: number): yom.TestAdvanceMsStatement {
  return { t: "AdvanceMs", ms };
}

export function setServiceRenderDelay(
  ms: number
): yom.TestSetServiceRenderDelayStatement {
  return { t: "SetServiceRenderDelay", ms };
}

export function setServiceLongRunningRenderDelay(
  ms: number
): yom.TestSetServiceLongRunningRenderDelayStatement {
  return { t: "SetServiceLongRunningRenderDelay", ms };
}

export function setServiceProcDelay(
  ms: number
): yom.TestSetServiceProcDelayStatement {
  return { t: "SetServiceProcDelay", ms };
}

export function assertApi(opts: Omit<yom.AssertApi, "t">): yom.AssertApi {
  return { t: "AssertApi", ...opts };
}

export function removeUsers(query: string): yom.RemoveUsersStatement {
  return { t: "RemoveUsers", query };
}

export function removeFiles(query: string): yom.RemoveFilesStatement {
  return { t: "RemoveFiles", query };
}

export function search(
  opts: Omit<yom.SearchStatement, "t">
): yom.SearchStatement {
  return { t: "Search", ...opts };
}
