import type * as yom from "./yom";
import * as util from "util";

export const BACKING_ARRAY = Symbol("BACKING_ARRAY");

export abstract class StatementsBase<Statement extends object> {
  private [BACKING_ARRAY]: Statement[] = [];

  protected pushToBacking(statement: Statement) {
    this[BACKING_ARRAY].push(statement);
  }

  get statementsIsEmpty() {
    return this[BACKING_ARRAY].length === 0;
  }

  modify(sql: string) {
    this.pushToBacking({ t: "Modify", sql } as yom.ModifyStatement as any);
    return this;
  }

  break() {
    this.pushToBacking({ t: "Break" } as yom.BreakStatement as any);
    return this;
  }

  continue() {
    this.pushToBacking({ t: "Continue" } as yom.ContinueStatement as any);
    return this;
  }

  throwError(message: yom.SqlExpression, description?: yom.SqlExpression) {
    this.pushToBacking({
      t: "Throw",
      message,
      description,
    } as yom.ThrowStatement as any);
    return this;
  }

  return(expr?: yom.SqlExpression) {
    this.pushToBacking({
      t: "ReturnExpr",
      expr: expr ?? "null",
    } as yom.ReturnExprStatement as any);
    return this;
  }

  table(name: string, query: string): this;
  table(name: string, fields: yom.ProcTableField[]): this;
  table(name: string, fields: yom.ProcTableField[], query: string): this;
  table(
    name: string,
    queryOrFields: string | yom.ProcTableField[],
    query?: string,
  ): this {
    this.pushToBacking({
      t: "TableDeclaration",
      name,
      query:
        typeof queryOrFields === "string"
          ? queryOrFields
          : typeof query === "string"
            ? query
            : undefined,
      fields: Array.isArray(queryOrFields) ? queryOrFields : undefined,
    } as yom.TableDeclaration as any);
    return this;
  }

  record(name: string, queryOrFields: string | yom.ProcTableField[]) {
    this.pushToBacking({
      t: "RecordDeclaration",
      name,
      query: typeof queryOrFields === "string" ? queryOrFields : undefined,
      fields: Array.isArray(queryOrFields) ? queryOrFields : undefined,
    } as yom.RecordDeclaration as any);
    return this;
  }

  scalar(name: string, ty: yom.FieldType, expr?: yom.SqlExpression): this;
  scalar(name: string, expr: yom.SqlExpression): this;
  scalar(
    name: string,
    exprOrTy: yom.SqlExpression | yom.FieldType,
    expr?: yom.SqlExpression,
  ) {
    this.pushToBacking({
      t: "ScalarDeclaration",
      name,
      expr: typeof exprOrTy === "string" ? exprOrTy : expr,
      type: typeof exprOrTy === "string" ? undefined : exprOrTy,
    } as yom.ScalarDeclaration as any);
    return this;
  }

  setScalar(name: string, expr: yom.SqlExpression) {
    this.pushToBacking({ t: "SetScalar", name, expr } as yom.SetScalar as any);
    return this;
  }

  debugExpr(expr: yom.SqlExpression) {
    this.pushToBacking({
      t: "DebugExpr",
      expr,
    } as yom.DebugExprStatement as any);
    return this;
  }

  debugQuery(query: yom.SqlQuery) {
    this.pushToBacking({
      t: "DebugQuery",
      query,
    } as yom.DebugQueryStatement as any);
    return this;
  }

  createQueryCursor(name: string, query: yom.SqlQuery) {
    this.pushToBacking({
      t: "CreateQueryCursor",
      name,
      query,
    } as yom.CreateQueryCursorStatement as any);
    return this;
  }

  advanceCursor(cursor: string) {
    this.pushToBacking({
      t: "AdvanceCursor",
      cursor,
    } as yom.AdvanceCursorStatement as any);
    return this;
  }

  pushSource(source: string) {
    this.pushToBacking({
      t: "PushSource",
      source,
    } as yom.PushSourceStatement as any);
    return this;
  }

  popSource() {
    this.pushToBacking({ t: "PopSource" } as yom.PopSourceStatement as any);
    return this;
  }

  protected addGenericStatements(
    statements: StatementsOrFn<this> | undefined | null | false,
  ) {
    if (!statements) {
      return;
    }
    if (typeof statements === "function") {
      statements(this);
      return;
    }
    if (statements[BACKING_ARRAY]) {
      for (const statement of statements[BACKING_ARRAY]) {
        this.pushToBacking(statement as any);
      }
    }
  }

  protected normalizeGenericStatements(
    s: StatementsOrFn<this> | undefined | null | false,
  ): Statement[] | undefined {
    if (typeof s === "function") {
      const arr = new (this.constructor as any)();
      s(arr);
      return arr[BACKING_ARRAY];
    } else if (s === this) {
      throw new Error(
        "Cannot call any helper functions with itself, i.e. \n" +
        " const statements = new BasicStatements();\n" +
        "statements.statements(statements); statements.if('true', statements);\n" +
        "You did something like the above",
      );
    } else if (s) {
      return s[BACKING_ARRAY] as any;
    }
  }

  statements(
    ...statements: (StatementsOrFn<this> | undefined | null | false)[]
  ) {
    for (const s of statements) {
      this.addGenericStatements(s);
    }
    return this;
  }

  conditionalStatements(condition: boolean, statements: StatementsOrFn<this>) {
    if (condition) {
      this.addGenericStatements(statements);
    }
    return this;
  }

  mapArrayToStatements<T>(arr: Array<T>, fn: (item: T, s: this) => this) {
    for (const item of arr) {
      fn(item, this);
    }
    return this;
  }

  if(condition: yom.SqlExpression, then: StatementsOrFn<this>): this;
  if(opts: If<StatementsOrFn<this>>): this;
  if(
    condition: yom.SqlExpression | If<StatementsOrFn<this>>,
    then?: StatementsOrFn<this>,
  ) {
    if (typeof condition === "string") {
      this.pushToBacking({
        t: "If",
        condition,
        onTrue: this.normalizeGenericStatements(then),
      } as yom.IfStatement<any> as any);
    } else {
      this.pushToBacking({
        t: "If",
        condition: condition.condition,
        onTrue: this.normalizeGenericStatements(condition.then),
        onFalse: this.normalizeGenericStatements(condition.else),
      } as yom.IfStatement<any> as any);
    }
    try {
      JSON.stringify(this[BACKING_ARRAY]);
    } catch (e) {
      console.trace();
      console.log(util.inspect(this[BACKING_ARRAY]));
    }
    return this;
  }

  while(condition: yom.SqlExpression, body: StatementsOrFn<this>): this;
  while(opts: While<StatementsOrFn<this>>): this;
  while(
    condition: yom.SqlExpression | While<StatementsOrFn<this>>,
    body?: StatementsOrFn<this>,
  ) {
    if (typeof condition === "string") {
      this.pushToBacking({
        t: "While",
        condition,
        body: this.normalizeGenericStatements(body),
      } as yom.WhileStatement<any> as any);
    } else {
      this.pushToBacking({
        t: "While",
        condition: condition.condition,
        body: this.normalizeGenericStatements(condition.body),
        label: condition.label,
      } as yom.WhileStatement<any> as any);
    }
    return this;
  }

  forEachCursor(cursor: string, body: StatementsOrFn<this>): this;
  forEachCursor(opts: ForEachCursor<StatementsOrFn<this>>): this;
  forEachCursor(
    cursor: string | ForEachCursor<StatementsOrFn<this>>,
    body?: StatementsOrFn<this>,
  ) {
    if (typeof cursor === "string") {
      this.pushToBacking({
        t: "ForEachCursor",
        cursor,
        body: this.normalizeGenericStatements(body),
      } as yom.ForEachCursorStatement<any> as any);
    } else {
      this.pushToBacking({
        t: "ForEachCursor",
        cursor: cursor.cursor,
        body: this.normalizeGenericStatements(cursor.body),
        label: cursor.label,
      } as yom.ForEachCursorStatement<any> as any);
    }
    return this;
  }

  forEachTable(
    table: string,
    cursorName: string,
    body: StatementsOrFn<this>,
  ): this;
  forEachTable(opts: ForEachTable<StatementsOrFn<this>>): this;
  forEachTable(
    table: string | ForEachTable<StatementsOrFn<this>>,
    cursorName?: string,
    body?: StatementsOrFn<this>,
  ) {
    if (typeof table === "string") {
      this.pushToBacking({
        t: "ForEachTable",
        table,
        cursorName,
        body: this.normalizeGenericStatements(body),
      } as yom.ForEachTableStatement<any> as any);
    } else {
      this.pushToBacking({
        t: "ForEachTable",
        table: table.table,
        cursorName: table.cursorName,
        body: this.normalizeGenericStatements(table.body),
      } as yom.ForEachTableStatement<any> as any);
    }
    return this;
  }

  forEachQuery(
    table: string,
    cursorName: string,
    body: StatementsOrFn<this>,
  ): this;
  forEachQuery(opts: ForEachQuery<StatementsOrFn<this>>): this;
  forEachQuery(
    query: yom.SqlQuery | ForEachQuery<StatementsOrFn<this>>,
    cursorName?: string,
    body?: StatementsOrFn<this>,
  ) {
    if (typeof query === "string") {
      this.pushToBacking({
        t: "ForEachQuery",
        query,
        cursorName,
        body: this.normalizeGenericStatements(body),
      } as yom.ForEachQueryStatement<any> as any);
    } else {
      this.pushToBacking({
        t: "ForEachQuery",
        query: query.query,
        cursorName: query.cursorName,
        body: this.normalizeGenericStatements(query.body),
      } as yom.ForEachQueryStatement<any> as any);
    }
    return this;
  }

  try(opts: Try<StatementsOrFn<this>>) {
    this.pushToBacking({
      t: "Try",
      body: this.normalizeGenericStatements(opts.body),
      errorName: opts.errorName,
      catch: this.normalizeGenericStatements(opts.catch),
      finally: this.normalizeGenericStatements(opts.finally),
    } as yom.TryStatement<any> as any);
    return this;
  }

  block(body: StatementsOrFn<this>) {
    this.pushToBacking({
      t: "Block",
      body: this.normalizeGenericStatements(body),
    } as yom.BlockStatement<any> as any);
    return this;
  }

  [Symbol.iterator]() {
    return this[BACKING_ARRAY][Symbol.iterator]();
  }
}

type StatementsOrFn<S> = ((statements: S) => unknown) | S | BasicStatements;

interface Try<S> {
  body: S;
  errorName?: string;
  catch?: S;
  finally?: S;
}

interface If<S> {
  condition: yom.SqlExpression;
  then: S;
  else?: S;
}

interface While<S> {
  condition: yom.SqlExpression;
  label?: string;
  body?: S;
}

interface ForEachCursor<S> {
  cursor: string;
  label?: string;
  body?: S;
}

interface ForEachTable<S> {
  table: string;
  cursorName: string;
  label?: string;
  body?: S;
}

interface ForEachQuery<S> {
  query: string;
  cursorName: string;
  label?: string;
  body?: S;
}

export type BasicStatementsOrFn = StatementsOrFn<BasicStatements>;

export class BasicStatements extends StatementsBase<yom.BasicStatement> {
  static normalize(p: BasicStatementsOrFn | undefined | false | null) {
    return p instanceof BasicStatements
      ? p
      : new BasicStatements().statements(p);
  }

  static normalizeToArray(p: BasicStatementsOrFn | undefined | false | null) {
    return BasicStatements.normalize(p)[BACKING_ARRAY];
  }
}

export type DomStatementsOrFn = StatementsOrFn<DomStatements>;

export class DomStatements extends StatementsBase<yom.DomProcStatement> {
  static normalize(p: DomStatementsOrFn | undefined | false | null) {
    return p instanceof DomStatements ? p : new DomStatements().statements(p);
  }

  static normalizeToArray(p: DomStatementsOrFn | undefined | false | null) {
    return DomStatements.normalize(p)[BACKING_ARRAY];
  }

  navigate(to: string, replace?: string) {
    this.pushToBacking({ t: "Navigate", to, replace });
    return this;
  }

  download(filename: string, content: string) {
    this.pushToBacking({ t: "Download", filename, content });
    return this;
  }

  preventDefault() {
    this.pushToBacking({ t: "PreventDefault" });
    return this;
  }

  stopPropagation() {
    this.pushToBacking({ t: "StopPropagation" });
    return this;
  }

  delay(ms: string) {
    this.pushToBacking({ t: "Delay", ms });
    return this;
  }

  commitUiTreeChanges() {
    this.pushToBacking({ t: "CommitUiTreeChanges" });
    return this;
  }

  runTreeChangeEffects() {
    this.pushToBacking({ t: "RunTreeChangeEffects" });
    return this;
  }

  logOut() {
    this.pushToBacking({ t: "LogOut" });
    return this;
  }

  spawn(procedure: StatementsOrFn<this>): this;
  spawn(opts: SpawnOpts<this>): this;
  spawn(proc: StatementsOrFn<this> | SpawnOpts<this>) {
    if (typeof proc === "function" || BACKING_ARRAY in proc) {
      this.pushToBacking({
        t: "Spawn",
        statements: DomStatements.normalizeToArray(proc as any),
      });
      return this;
    }
    this.pushToBacking({
      t: "Spawn",
      statements: DomStatements.normalizeToArray(proc.procedure as any),
      detached: proc.detached,
      handleScalar: proc.handleScalar,
    });
    return this;
  }

  waitOnTask(handle: string) {
    this.pushToBacking({ t: "WaitOnTask", handle });
    return this;
  }

  joinTasks(tasks: string[]) {
    this.pushToBacking({ t: "JoinTasks", tasks });
    return this;
  }

  selectTasks(tasks: string[]) {
    this.pushToBacking({ t: "SelectTasks", tasks });
    return this;
  }

  abortTask(handle: string) {
    this.pushToBacking({ t: "Abort", handle });
    return this;
  }

  setQueryParam(param: string, value: string, replace?: string) {
    this.pushToBacking({ t: "SetQueryParam", param, value, replace });
    return this;
  }

  serviceProc(statements: StatementsOrFn<ServiceStatements>) {
    this.pushToBacking({
      t: "ServiceProc",
      statements: ServiceStatements.normalizeToArray(statements),
    });
    return this;
  }

  scrollElIntoView(
    el: yom.SqlExpression | Omit<yom.ScrollIntoViewStatement, "t">,
  ) {
    this.pushToBacking(
      typeof el === "string"
        ? { t: "ScrollElIntoView", elementId: el }
        : { t: "ScrollElIntoView", ...el },
    );
    return this;
  }

  focusEl(el: string) {
    this.pushToBacking({ t: "FocusEl", elementId: el });
    return this;
  }

  queryToCsv(query: string, scalar: string) {
    this.pushToBacking({ t: "QueryToCsv", query, scalar });
    return this;
  }

  addImage(opts: Omit<yom.AddImageStatement, "t">) {
    this.pushToBacking({ t: "AddImage", ...opts });
    return this;
  }

  addFile(opts: Omit<yom.AddFileStatement, "t">) {
    this.pushToBacking({ t: "AddFile", ...opts });
    return this;
  }

  getWindowProperty(property: yom.WindowProperty, scalar: string) {
    this.pushToBacking({ t: "GetWindowProperty", property, scalar });
    return this;
  }

  getBoundingClientRect(el: string, record: string) {
    this.pushToBacking({ t: "GetBoundingClientRect", elementId: el, record });
    return this;
  }

  getElProperty(property: yom.ElProperty, scalar: string, el: string) {
    this.pushToBacking({ t: "GetElProperty", property, scalar, elementId: el });
    return this;
  }

  logout() {
    this.pushToBacking({ t: "LogOut" });
    return this;
  }

  triggerViewTransition(on: yom.ViewTransitionTiming, type?: string) {
    this.pushToBacking({ t: "TriggerViewTransition", on, type });
    return this;
  }
}

interface SpawnOpts<T> {
  procedure: StatementsOrFn<T>;
  detached?: boolean;
  handleScalar?: string;
}

interface AddUsersOpts {
  app: string;
  /**
   * Expects a sql query with the following fields:
   *
   * db_id: biguint (id of the user in the database)
   *
   * eamil: string (email of the user, will be sent an email and invited to yolm)
   *
   * notification_type: string (either "none" or "new_app" or "user")
   */
  query: yom.SqlQuery
  /**
   * @default "added_user"
   *
   * The name of the table that should be created to store the users that have been added.
   *
   * It has the following fields:
   *
   * db_id: biguint (id of the user in the database)
   *
   * global_id: uuid (id of the user in yolm's authentication system)
   */
  outputTable?: string
}

export type ServiceStatementsOrFn = StatementsOrFn<ServiceStatements>;

export class ServiceStatements extends StatementsBase<yom.ServiceProcStatement> {
  static normalize(p: ServiceStatementsOrFn | false | undefined | null) {
    return p instanceof ServiceStatements
      ? p
      : new ServiceStatements().statements(p);
  }

  static normalizeToArray(p: ServiceStatementsOrFn | false | undefined | null) {
    return ServiceStatements.normalize(p)[BACKING_ARRAY];
  }

  startTransaction(opts: Omit<yom.StartTransactionStatement, "t"> = {}) {
    this.pushToBacking({ t: "StartTransaction", ...opts });
    return this;
  }

  commitTransaction() {
    this.pushToBacking({ t: "CommitTransaction" });
    return this;
  }

  dynamicQueryToCsv(query: yom.SqlExpression, scalar: string) {
    this.pushToBacking({ t: "DynamicQueryToCsv", query, scalar });
    return this;
  }

  dynamicQuery(props: Omit<yom.DynamicQueryStatement, "t">) {
    this.pushToBacking({ t: "DynamicQuery", ...props });
    return this;
  }

  dynamicModify(sql: yom.SqlExpression) {
    this.pushToBacking({ t: "DynamicModify", sql });
    return this;
  }

  undoTx(txId: yom.SqlExpression) {
    this.pushToBacking({ t: "UndoTx", tx: txId });
    return this;
  }

  search(opts: Omit<yom.SearchStatement, "t">) {
    this.pushToBacking({ t: "Search", ...opts });
    return this;
  }

  navigate(to: string, replace?: string) {
    this.pushToBacking({ t: "Navigate", to, replace });
    return this;
  }

  /**
   * This is how you actually add the users to our authorization system, just inserting into the users table is not enough.
   */
  addUsers(opts: AddUsersOpts) {
    this.pushToBacking({ t: "AddUsers", ...opts });
    return this;
  }

  removeFiles(query: yom.SqlExpression) {
    this.pushToBacking({ t: "RemoveFiles", query });
    return this;
  }

  setQueryParam(param: string, value: string, replace?: string) {
    this.pushToBacking({ t: "SetQueryParam", param, value, replace });
    return this;
  }
}

export type StateStatementsOrFn = StatementsOrFn<StateStatements>;

export class StateStatements extends StatementsBase<yom.StateStatement> {
  static normalize(p: StateStatementsOrFn | undefined | null | false) {
    return p instanceof StateStatements
      ? p
      : new StateStatements().statements(p);
  }

  static normalizeToArray(p: StateStatementsOrFn | undefined | null | false) {
    return StateStatements.normalize(p)[BACKING_ARRAY];
  }

  search(opts: Omit<yom.SearchStatement, "t">) {
    this.pushToBacking({ t: "Search", ...opts });
    return this;
  }

  dynamicQuery(props: Omit<yom.DynamicQueryStatement, "t">) {
    this.pushToBacking({ t: "DynamicQuery", ...props });
    return this;
  }
}

export type ScriptStatementsOrFn = StatementsOrFn<ScriptStatements>;

export class ScriptStatements extends StatementsBase<yom.ScriptStatement> {
  static normalize(p: ScriptStatementsOrFn | undefined | false | null) {
    return p instanceof ScriptStatements
      ? p
      : new ScriptStatements().statements(p);
  }

  static normalizeToArray(p: ScriptStatementsOrFn | undefined | false | null) {
    return ScriptStatements.normalize(p)[BACKING_ARRAY];
  }

  importCsv(db: string, dir: string) {
    this.pushToBacking({ t: "ImportCsv", db, dir });
    return this;
  }

  saveDbToDir(dir: string, db?: string) {
    this.pushToBacking({ t: "SaveDbToDir", dir, db });
    return this;
  }

  loadDbFromDir(dir: string, db?: string) {
    this.pushToBacking({ t: "LoadDb", dir, db });
    return this;
  }

  pull(dir?: string) {
    this.pushToBacking({ t: "Pull", dir });
    return this;
  }

  push() {
    this.pushToBacking({ t: "Push" });
    return this;
  }

  /**
   * This is how you actually add the users to our authorization system, just inserting into the users table is not enough.
   */
  addUsers(opts: AddUsersOpts) {
    this.pushToBacking({ t: "AddUsers", ...opts });
    return this;
  }

  uploadDb(opts?: Omit<yom.UploadDbStatement, "t">) {
    this.pushToBacking({ t: "UploadDb", ...opts });
    return this;
  }

  startTransaction(db: string) {
    this.pushToBacking({ t: "StartTransaction", db });
    return this;
  }

  commitTransaction(db: string) {
    this.pushToBacking({ t: "CommitTransaction", db });
    return this;
  }

  rollbackTransaction(db: string) {
    this.pushToBacking({ t: "RollbackTransaction", db });
    return this;
  }
}

export type EndpointStatementsOrFn = StatementsOrFn<EndpointStatements>;

export class EndpointStatements extends StatementsBase<yom.ApiEndpointStatement> {
  static normalize(p: EndpointStatementsOrFn | false | undefined | null) {
    return p instanceof EndpointStatements
      ? p
      : new EndpointStatements().statements(p);
  }

  static normalizeToArray(
    p: EndpointStatementsOrFn | false | undefined | null,
  ) {
    return EndpointStatements.normalize(p)[BACKING_ARRAY];
  }

  startTransaction(opts: Omit<yom.StartTransactionStatement, "t"> = {}) {
    this.pushToBacking({ t: "StartTransaction", ...opts });
    return this;
  }

  commitTransaction() {
    this.pushToBacking({ t: "CommitTransaction" });
    return this;
  }

  dynamicQueryToCsv(query: yom.SqlExpression, scalar: string) {
    this.pushToBacking({ t: "DynamicQueryToCsv", query, scalar });
    return this;
  }

  dynamicQuery(props: Omit<yom.DynamicQueryStatement, "t">) {
    this.pushToBacking({ t: "DynamicQuery", ...props });
    return this;
  }

  dynamicModify(sql: yom.SqlExpression) {
    this.pushToBacking({ t: "DynamicModify", sql });
    return this;
  }

  undoTx(txId: yom.SqlExpression) {
    this.pushToBacking({ t: "UndoTx", tx: txId });
    return this;
  }

  search(opts: Omit<yom.SearchStatement, "t">) {
    this.pushToBacking({ t: "Search", ...opts });
    return this;
  }

  /**
   * This is how you actually add the users to our authorization system, just inserting into the users table is not enough.
   */
  addUsers(opts: AddUsersOpts) {
    this.pushToBacking({ t: "AddUsers", ...opts });
    return this;
  }

  removeFiles(query: yom.SqlExpression) {
    this.pushToBacking({ t: "RemoveFiles", query });
    return this;
  }

  returnJSON(f: (helper: ToJSONHelper) => yom.ToJSON) {
    this.pushToBacking({
      t: "ReturnJSON",
      json: f(new ToJSONHelper()),
    });
    return this;
  }

  setHttpStatus(status: yom.SqlExpression) {
    this.pushToBacking({ t: "SetHttpStatus", status });
    return this;
  }

  getHeader(name: yom.SqlExpression, scalar: string) {
    this.pushToBacking({ t: "GetHeader", name, scalar });
    return this;
  }

  setHeader(name: yom.SqlExpression, value: yom.SqlExpression) {
    this.pushToBacking({ t: "SetHeader", name, value });
    return this;
  }
}

export class ToJSONHelper {
  scalar(expr: yom.SqlExpression): yom.ToHierarchyScalar {
    return { type: "Scalar", expr };
  }

  object(fields: yom.ToHierarchyField[]): yom.ToHierarchyObject {
    return { type: "Object", fields };
  }

  if(
    condition: yom.SqlExpression,
    then: yom.ToJSON,
  ): yom.ToHierarchyConditional {
    return { type: "If", condition, then };
  }

  each(
    table: string,
    recordName: string,
    children: yom.ToJSON,
  ): yom.ToHierarchyEach {
    return { type: "Each", table, recordName, children };
  }

  state(s: BasicStatementsOrFn, children: yom.ToJSON): yom.ToHierarchyState {
    return {
      type: "State",
      procedure: BasicStatements.normalizeToArray(s),
      children,
    };
  }
}

export type ApiTestStatementsOrFn = StatementsOrFn<ApiTestStatements>;

export class ApiTestStatements extends StatementsBase<yom.ApiTestStatment> {
  static normalize(p: ApiTestStatementsOrFn | undefined | null | false) {
    return p instanceof ApiTestStatements
      ? p
      : new ApiTestStatements().statements(p);
  }

  static normalizeToArray(p: ApiTestStatementsOrFn | undefined | null | false) {
    return ApiTestStatements.normalize(p)[BACKING_ARRAY];
  }

  assertApi(props: Omit<yom.AssertApi, "t">) {
    this.pushToBacking({ t: "AssertApi", ...props });
    return this;
  }

  assertQuery(query: yom.SqlQuery, csv: string) {
    this.pushToBacking({ t: "AssertQuery", query, csv });
    return this;
  }
}
