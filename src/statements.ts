import type * as yom from "./yom";

export const INNER_ARRAY = Symbol("INNER_ARRAY");

abstract class StatementsBase<Statement extends object> {
  private [INNER_ARRAY]: Statement[] = [];

  protected push(statement: Statement) {
    this[INNER_ARRAY].push(statement);
  }

  modify(sql: string) {
    this.push({ t: "Modify", sql } as yom.ModifyStatement as any);
    return this;
  }

  return(expr?: yom.SqlExpression) {
    this.push({
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
    query?: string
  ): this {
    this.push({
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
    this.push({
      t: "RecordDeclaration",
      name,
      query: typeof queryOrFields === "string" ? queryOrFields : undefined,
      fields: Array.isArray(queryOrFields) ? queryOrFields : undefined,
    } as yom.RecordDeclaration as any);
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

  protected addGenericStatements(
    statements: StatementsOrFn<this> | undefined | null | false
  ) {
    if (!statements) {
      return;
    }
    if (typeof statements === "function") {
      statements(this);
      return;
    }
    if (statements[INNER_ARRAY]) {
      for (const statement of statements[INNER_ARRAY]) {
        this.push(statement as any);
      }
    }
  }

  protected normalizeGenericStatements(
    s: StatementsOrFn<this> | undefined | null | false
  ): Statement[] | undefined {
    if (typeof s === "function") {
      const arr = new (this.constructor as any)();
      s(arr);
      return arr[INNER_ARRAY];
    } else if (s) {
      return s[INNER_ARRAY] as any;
    }
  }

  statements(...statements: StatementsOrFn<this>[]) {
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

  mapArrayToStatements<T>(
    arr: Array<T>,
    fn: (item: T, s: this) => StatementsOrFn<this>
  ) {
    for (const item of arr) {
      this.addGenericStatements(fn(item, this));
    }
    return this;
  }

  if(condition: yom.SqlExpression, then: StatementsOrFn<this>): this;
  if(opts: If<StatementsOrFn<this>>): this;
  if(
    condition: yom.SqlExpression | If<StatementsOrFn<this>>,
    then?: StatementsOrFn<this>
  ) {
    if (typeof condition === "string") {
      this.push({
        t: "If",
        condition,
        onTrue: this.normalizeGenericStatements(then),
      } as yom.IfStatement<any> as any);
    } else {
      this.push({
        t: "If",
        condition: condition.condition,
        onTrue: this.normalizeGenericStatements(condition.then),
        onFalse: this.normalizeGenericStatements(condition.else),
      } as yom.IfStatement<any> as any);
    }
    return this;
  }

  forEachCursor(cursor: string, body: StatementsOrFn<this>) {
    this.push({
      t: "ForEachCursor",
      cursor,
      body: this.normalizeGenericStatements(body),
    } as yom.ForEachCursorStatement<any> as any);
    return this;
  }

  try(opts: Try<StatementsOrFn<this>>) {
    this.push({
      t: "Try",
      body: this.normalizeGenericStatements(opts.body),
      errorName: opts.errorName,
      catch: this.normalizeGenericStatements(opts.catch),
      finally: this.normalizeGenericStatements(opts.finally),
    } as yom.TryStatement<any> as any);
    return this;
  }

  block(body: StatementsOrFn<this>) {
    this.push({
      t: "Block",
      body: this.normalizeGenericStatements(body),
    } as yom.BlockStatement<any> as any);
    return this;
  }

  [Symbol.iterator]() {
    return this[INNER_ARRAY][Symbol.iterator]();
  }
}

type StatementsOrFn<S> = ((statements: S) => S) | S | BasicStatements;

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

export type BasicStatementsOrFn = StatementsOrFn<BasicStatements>;

export class BasicStatements extends StatementsBase<yom.BasicStatement> {
  static normalize(p: BasicStatementsOrFn) {
    return p instanceof BasicStatements
      ? p
      : new BasicStatements().statements(p);
  }

  static normalizeToArray(p: BasicStatementsOrFn) {
    return BasicStatements.normalize(p)[INNER_ARRAY];
  }
}

export type DomStatementsOrFn = StatementsOrFn<DomStatements>;

export class DomStatements extends StatementsBase<yom.DomProcStatement> {
  static normalize(p: DomStatementsOrFn) {
    return p instanceof DomStatements ? p : new DomStatements().statements(p);
  }

  static normalizeToArray(p: DomStatementsOrFn) {
    return DomStatements.normalize(p)[INNER_ARRAY];
  }

  navigate(to: string, replace?: string) {
    this.push({ t: "Navigate", to, replace });
    return this;
  }

  download(filename: string, content: string) {
    this.push({ t: "Download", filename, content });
    return this;
  }

  preventDefault() {
    this.push({ t: "PreventDefault" });
    return this;
  }

  stopPropagation() {
    this.push({ t: "StopPropagation" });
    return this;
  }

  delay(ms: string) {
    this.push({ t: "Delay", ms });
    return this;
  }

  commitUiChanges() {
    this.push({ t: "CommitUiChanges" });
    return this;
  }

  logOut() {
    this.push({ t: "LogOut" });
    return this;
  }

  spawn(procedure: StatementsOrFn<this>): this;
  spawn(opts: SpawnOpts<this>): this;
  spawn(proc: StatementsOrFn<this> | SpawnOpts<this>) {
    if (typeof proc === "function" || INNER_ARRAY in proc) {
      this.push({
        t: "Spawn",
        statements: DomStatements.normalizeToArray(proc as any),
      });
      return this;
    }
    this.push({
      t: "Spawn",
      statements: DomStatements.normalizeToArray(proc.procedure as any),
      detached: proc.detached,
      handleScalar: proc.handleScalar,
    });
    return this;
  }

  waitOnTask(handle: string) {
    this.push({ t: "WaitOnTask", handle });
    return this;
  }

  joinTasks(tasks: string[]) {
    this.push({ t: "JoinTasks", tasks });
    return this;
  }

  selectTasks(tasks: string[]) {
    this.push({ t: "SelectTasks", tasks });
    return this;
  }

  abortTask(handle: string) {
    this.push({ t: "Abort", handle });
    return this;
  }

  setQueryParam(param: string, value: string, replace?: string) {
    this.push({ t: "SetQueryParam", param, value, replace });
    return this;
  }

  serviceProc(statements: StatementsOrFn<ServiceStatements>) {
    this.push({
      t: "ServiceProc",
      statements: ServiceStatements.normalizeToArray(statements),
    });
    return this;
  }

  scrollElIntoView(
    el: yom.SqlExpression | Omit<yom.ScrollIntoViewStatement, "t">
  ) {
    this.push(
      typeof el === "string"
        ? { t: "ScrollElIntoView", elementId: el }
        : { t: "ScrollElIntoView", ...el }
    );
    return this;
  }

  focusEl(el: string) {
    this.push({ t: "FocusEl", elementId: el });
    return this;
  }

  queryToCsv(query: string, scalar: string) {
    this.push({ t: "QueryToCsv", query, scalar });
    return this;
  }

  addImage(opts: Omit<yom.AddImageStatement, "t">) {
    this.push({ t: "AddImage", ...opts });
    return this;
  }

  addFile(opts: Omit<yom.AddFileStatement, "t">) {
    this.push({ t: "AddFile", ...opts });
    return this;
  }

  getWindowProperty(property: yom.WindowProperty, scalar: string) {
    this.push({ t: "GetWindowProperty", property, scalar });
    return this;
  }

  getBoundingClientRect(el: string, record: string) {
    this.push({ t: "GetBoundingClientRect", elementId: el, record });
    return this;
  }

  getElProperty(property: yom.ElProperty, scalar: string, el: string) {
    this.push({ t: "GetElProperty", property, scalar, elementId: el });
    return this;
  }

  logout() {
    this.push({ t: "LogOut" });
    return this;
  }
}

interface SpawnOpts<T> {
  procedure: StatementsOrFn<T>;
  detached?: boolean;
  handleScalar?: string;
}

export type ServiceStatementsOrFn = StatementsOrFn<ServiceStatements>;

export class ServiceStatements extends StatementsBase<yom.ServiceProcStatement> {
  static normalize(p: ServiceStatementsOrFn) {
    return p instanceof ServiceStatements
      ? p
      : new ServiceStatements().statements(p);
  }

  static normalizeToArray(p: ServiceStatementsOrFn) {
    return ServiceStatements.normalize(p)[INNER_ARRAY];
  }
}

export type StateStatementsOrFn = StatementsOrFn<StateStatements>;

export class StateStatements extends StatementsBase<yom.StateStatement> {
  static normalize(p: StateStatementsOrFn) {
    return p instanceof StateStatements
      ? p
      : new StateStatements().statements(p);
  }

  static normalizeToArray(p: StateStatementsOrFn) {
    return StateStatements.normalize(p)[INNER_ARRAY];
  }

  search(opts: Omit<yom.SearchStatement, "t">) {
    this.push({ t: "Search", ...opts });
    return this;
  }
}
