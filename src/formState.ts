import { Field, Table, app } from "./app";
import type * as yom from "./yom";
import { EachNode, Node, StateNode } from "./nodeTypes";
import { nodes } from "./nodeHelpers";
import { ident, stringLiteral } from "./utils/sqlHelpers";
import {
  BasicStatements,
  DomStatements,
  ServiceStatements,
  StateStatements,
} from "./statements";

export interface FormStateField {
  name: string;
  initialValue: yom.SqlExpression;
  notNull?: boolean;
  type: yom.FieldType;
}

const TOUCHED_SUFFIX = `_fs_touched`;
const ERROR_SUFFIX = `_fs_error`;
const FORM_ERROR_SCALAR = `fn_error`;
const FORM_SUBMITTING_SCALAR = `fs_submitting`;
const FORM_FIELDS_RECORD = `fs_fields`;
const FORM_STATE_TABLE_ID = `fs_id`;
const FORM_STATE_TABLE_ERR = `fs_err`;
const NEXT_ID_SCALAR = `fs_unique_id`;

function createProcFields(fields: FormStateField[]): yom.ProcTableField[] {
  const procFields: yom.ProcTableField[] = [];
  for (const field of fields) {
    procFields.push({
      name: field.name,
      type: field.type,
      notNull: field.notNull,
    });
    procFields.push({
      name: field.name + TOUCHED_SUFFIX,
      type: { type: "Bool" },
      notNull: true,
    });
    procFields.push({
      name: field.name + ERROR_SUFFIX,
      type: { type: "String", maxLength: 2000 },
    });
  }
  return procFields;
}

export interface FormStateTable {
  name: string;
  fields: FormStateField[];
}

export interface FormStateOpts {
  fields?: FormStateField[];
  tables?: FormStateTable[];
  /**
   * This is called as part of the initialization of the form state, so you can add empty table records,
   * set a field error, set something touched, etc.
   */
  initializeFormState?: (state: FormState, s: StateStatements) => unknown;
}

export class FormState {
  #fields: FormStateField[];
  #tables: FormStateTable[];
  #initializeFormState?: (state: FormState, s: StateStatements) => unknown;

  constructor(opts: FormStateOpts) {
    this.#fields = opts.fields ?? [];
    this.#tables = opts.tables ?? [];
    this.#initializeFormState = opts.initializeFormState;
  }

  #assertFieldExists(field: string, fnName: string) {
    if (this.#fields.some((f) => f.name === field)) {
      return;
    }
    throw new Error(
      `Passed field '${field}' to form state function ${fnName} which doesn't exist`
    );
  }
  #assertTableExists(table: string, fnName: string) {
    if (this.#tables.some((f) => f.name === table)) {
      return;
    }
    throw new Error(
      `Passed table '${table}' to form state function ${fnName} which doesn't exist`
    );
  }

  get stateProcedure() {
    const proc = new StateStatements()
      .scalar(FORM_ERROR_SCALAR, { type: "String", maxLength: 500 })
      .scalar(FORM_SUBMITTING_SCALAR, `false`);
    if (this.#fields && this.#fields.length !== 0) {
      proc.record(FORM_FIELDS_RECORD, createProcFields(this.#fields));
      const insertFields: string[] = [];
      const insertValues: string[] = [];
      for (const field of this.#fields) {
        insertFields.push(field.name);
        insertFields.push(field.name + TOUCHED_SUFFIX);
        insertValues.push(field.initialValue);
        insertValues.push(`false`);
      }
      proc.modify(
        `insert into ${FORM_FIELDS_RECORD} (${insertFields.join(
          ","
        )}) values (${insertValues.join(",")})`
      );
    }
    if (this.#tables && this.#tables.length !== 0) {
      proc.scalar(NEXT_ID_SCALAR, { type: "Int" }, "0");
      for (const optTable of this.#tables) {
        const fields = createProcFields(optTable.fields);
        fields.push({
          name: FORM_STATE_TABLE_ID,
          type: { type: "Int" },
          notNull: true,
        });
        fields.push({
          name: FORM_STATE_TABLE_ERR,
          type: { type: "String", maxLength: 2000 },
        });
        proc.table(optTable.name, fields);
      }
    }
    this.#initializeFormState?.(this, proc);
    return proc;
  }

  get setTouchedAllFields() {
    return new BasicStatements().modify(
      `update ui.${FORM_FIELDS_RECORD} set ${this.#fields
        .map((f) => `${f.name}${TOUCHED_SUFFIX} = true`)
        .join(",")}`
    );
  }

  get setTouchedNoneFields() {
    return new BasicStatements().modify(
      `update ui.${FORM_FIELDS_RECORD} set ${this.#fields
        .map((f) => `${f.name}${TOUCHED_SUFFIX} = false`)
        .join(",")}`
    );
  }

  get resetErrorStateFields() {
    return new BasicStatements().modify(
      `update ui.${FORM_FIELDS_RECORD} set ${this.#fields
        .map((f) => `${f.name}${ERROR_SUFFIX} = null`)
        .join(", ")}`
    );
  }

  get hasAnyFieldsError(): yom.SqlExpression {
    return this.#fields
      .map(
        (f) => `ui.${FORM_FIELDS_RECORD}.${f.name}${ERROR_SUFFIX} is not null`
      )
      .join(` or `);
  }

  field(name: string) {
    this.#assertFieldExists(name, `field`);
    return new FormStateFieldHelper(
      `ui.${FORM_FIELDS_RECORD}`,
      this.#fields.find((f) => f.name === name)!
    );
  }

  each(
    tableName: string,
    render: (opts: FormStateTableCursor) => Node
  ): EachNode {
    this.#assertTableExists(tableName, `each`);
    const recordName = `record` + tableName;
    return {
      t: "Each",
      table: tableName,
      recordName,
      key: FORM_STATE_TABLE_ID,
      children: render(
        new FormStateTableCursor(
          tableName,
          recordName,
          this.#tables.find((t) => t.name === tableName)!.fields
        )
      ),
    };
  }

  iterTableCursor(tableName: string) {
    this.#assertTableExists(tableName, `iterTableCursor`);
    const recordName = tableName + `_record`;
    return new FormStateTableCursor(
      tableName,
      recordName,
      this.#tables.find((t) => t.name === tableName)!.fields
    );
  }

  addRecordToTable(
    tableName: string,
    fields: Record<string, yom.SqlExpression>
  ) {
    this.#assertTableExists(tableName, `addRecordToTable`);
    const tableObj = this.#tables.find((t) => t.name === tableName)!;
    const insertFields: string[] = [];
    const insertValues: string[] = [];
    for (const field of tableObj.fields) {
      insertFields.push(field.name);
      insertFields.push(field.name + TOUCHED_SUFFIX);
      insertValues.push(fields[field.name] ?? field.initialValue);
      insertValues.push(`false`);
    }
    return new BasicStatements()
      .modify(
        `insert into ui.${tableName} (fs_id, ${insertFields.join(
          ","
        )}) values (ui.${NEXT_ID_SCALAR}, ${insertValues.join(`,`)})`
      )
      .setScalar(`ui.${NEXT_ID_SCALAR}`, `ui.${NEXT_ID_SCALAR} + 1`);
  }

  get formError(): yom.SqlExpression {
    return `ui.` + FORM_ERROR_SCALAR;
  }
  get hasFormError(): yom.SqlExpression {
    return `ui.` + FORM_ERROR_SCALAR + ` is not null`;
  }
  setFormError(value: yom.SqlExpression) {
    return new BasicStatements().setScalar(`ui.` + FORM_ERROR_SCALAR, value);
  }
  get submitting(): yom.SqlExpression {
    return `ui.${FORM_SUBMITTING_SCALAR}`;
  }
  setSubmitting(waiting: yom.SqlExpression) {
    return new BasicStatements().setScalar(
      `ui.${FORM_SUBMITTING_SCALAR}`,
      waiting
    );
  }

  get debugFormState() {
    return new BasicStatements()
      .debugQuery(`select * from ui.${FORM_FIELDS_RECORD}`)
      .mapArrayToStatements(this.#tables, (t, s) =>
        s.debugQuery(`select * from ui.${t.name}`)
      )
      .debugExpr(`'Form error: ' || ui.${FORM_ERROR_SCALAR}`)
      .debugExpr(`'Form waiting: ' || ui.${FORM_SUBMITTING_SCALAR}`);
  }

  get hasAnyError(): yom.SqlExpression {
    return (
      this.hasAnyFieldsError +
      ` or ${FORM_ERROR_SCALAR} is not null` +
      (this.#tables.length !== 0
        ? " or " +
          this.#tables
            .map((t) => {
              return `(select bool_or(${FORM_STATE_TABLE_ERR} is not null or ${t.fields
                .map((f) => f.name + ERROR_SUFFIX + " is not null")
                .join(` or `)}) from ui.${t.name})`;
            })
            .join(` or `)
        : ``)
    );
  }

  get resetErrorState() {
    return new BasicStatements()
      .statements(this.resetErrorStateFields)
      .setScalar(`ui.${FORM_ERROR_SCALAR}`, `null`)
      .mapArrayToStatements(this.#tables, (t, s) =>
        s.modify(
          `update ui.${t.name} set ${t.fields
            .map((f) => f.name + ERROR_SUFFIX + ` = null`)
            .join(`,`)}`
        )
      );
  }

  get setTouchedAll() {
    return new BasicStatements()
      .statements(this.setTouchedAllFields)
      .mapArrayToStatements(this.#tables, (t, s) =>
        s.modify(
          `update ui.${t.name} set ${t.fields
            .map((f) => `${f.name}${TOUCHED_SUFFIX} = true`)
            .join(`,`)}`
        )
      );
  }
  get setTouchedNone() {
    return new BasicStatements()
      .statements(this.setTouchedNoneFields)
      .mapArrayToStatements(this.#tables, (t, s) =>
        s.modify(
          `update ui.${t.name} set ${t.fields
            .map((f) => `${f.name}${TOUCHED_SUFFIX} = true`)
            .join(`,`)}`
        )
      );
  }
}

export class FormStateTableCursor {
  #tableName: string;
  #recordName: string;
  #fields: FormStateField[];

  constructor(tableName: string, recordName: string, fields: FormStateField[]) {
    this.#tableName = tableName;
    this.#recordName = recordName;
    this.#fields = fields;
  }

  get tableName() {
    return this.#tableName;
  }

  get cursorName() {
    return this.#recordName;
  }

  get idField(): yom.SqlExpression {
    return this.#recordName + "." + FORM_STATE_TABLE_ID;
  }

  field(name: string) {
    const field = this.#fields.find((f) => f.name === name);
    if (!field) {
      throw new Error(
        `Passed field '${field}' to form state table cursor which doesn't exist`
      );
    }
    return new FormStateFieldHelper(this.#recordName, field);
  }

  get delete() {
    return new BasicStatements().modify(
      `delete from ui.${this.#tableName} where ${FORM_STATE_TABLE_ID} = ${
        this.idField
      }`
    );
  }

  get recordError(): yom.SqlExpression {
    return `${this.#recordName}.${FORM_STATE_TABLE_ERR}`;
  }

  get hasRecordError(): yom.SqlExpression {
    return this.recordError + ` is not null`;
  }

  setRecordError(error: yom.SqlExpression) {
    return new BasicStatements().modify(
      `update ui.${
        this.#tableName
      } set ${FORM_STATE_TABLE_ERR} = ${error} where ${FORM_STATE_TABLE_ID} = ${
        this.idField
      }`
    );
  }
}

export class FormStateFieldHelper {
  #recordName: string;
  #field: FormStateField;

  constructor(recordName: string, field: FormStateField) {
    this.#recordName = recordName;
    this.#field = field;
  }

  get value(): yom.SqlExpression {
    return this.#recordName + `.` + this.#field.name;
  }

  setValue = (value: yom.SqlExpression) => {
    return new BasicStatements().modify(
      `update ${this.#recordName} set ${this.#field.name} = ${value}`
    );
  };

  get error(): yom.SqlExpression {
    return this.#recordName + "." + this.#field.name + ERROR_SUFFIX;
  }

  get hasError(): yom.SqlExpression {
    return this.error + ` is not null`;
  }

  setError = (error: yom.SqlExpression) => {
    return new BasicStatements().modify(
      `update ${this.#recordName} set ${
        this.#field.name
      }${ERROR_SUFFIX} = ${error}`
    );
  };

  get touched(): yom.SqlExpression {
    return this.#recordName + `.` + this.#field.name + TOUCHED_SUFFIX;
  }

  setTouched = (touched: yom.SqlExpression) => {
    return new BasicStatements().modify(
      `update ${this.#recordName} set ${
        this.#field.name
      }${TOUCHED_SUFFIX} = ${touched}`
    );
  };
}

export interface WithFormStateOpts extends FormStateOpts {
  children: (state: FormState) => Node;
}

export function withFormState(opts: WithFormStateOpts) {
  const formState = new FormState(opts);
  return nodes.state({
    procedure: formState.stateProcedure,
    children: opts.children(formState),
  });
}

export function getNormalizedValue(field: Field, valueExpr: string): string {
  if ("usage" in field) {
    if (field.usage?.type === "Duration") {
      if (field.usage?.size !== "minutes") {
        throw new Error("Only minutes duration is supported");
      }
      return `sfn.parse_minutes_duration(${valueExpr})`;
    }
  }
  switch (field.type) {
    case "String":
      return `case when trim(${valueExpr}) != '' then trim(${valueExpr}) end`;
    case "TinyInt":
    case "TinyUint":
    case "SmallInt":
      return `case when ${valueExpr} != '' then cast(${valueExpr} as smallint) end`;
    case "SmallUint":
    case "Int":
      return `case when ${valueExpr} != '' then cast(${valueExpr} as int) end`;
    case "Uint":
    case "BigInt":
    case "BigUint":
      return `case when ${valueExpr} != '' then cast(${valueExpr} as bigint) end`;
    case "Decimal":
      return `case when ${valueExpr} != '' then cast(${valueExpr} as decimal(${field.precision}, ${field.scale})) end`;
    case "Tx":
      return `case when ${valueExpr} != '' then cast(${valueExpr} as bigint) end`;
    case "Uuid":
      return `case when ${valueExpr} != '' then cast(${valueExpr} as uuid) end`;

    default:
      return valueExpr;
  }
}

export function formFieldType(field: Field): yom.FieldType {
  switch (field.type) {
    // in the ui procs, we don't want to error on going over max length so we can provide better error messages
    case "String":
    case "TinyUint":
    case "TinyInt":
    case "Decimal":
    case "SmallInt":
    case "SmallUint":
    case "Int":
    case "Uint":
    case "Uuid":
    case "BigInt":
    case "Real":
    case "Double":
    case "BigUint":
    case "Tx":
      return { type: "String", maxLength: 65_000 };
    case "ForeignKey":
      return { type: "BigUint" };
    case "Enum":
      return { type: "Enum", enum: field.enum };
    case "Bool":
    case "Date":
    case "Timestamp":
      return { type: field.type };
    case "Ordering":
    case "Time":
      throw new Error(`${field.type} not supported in forms`);
  }
}

export interface MultiInsertFormOpts extends FormStateProcedureExtensions {
  table: string;
  fields: InsertFormField[];
  sharedFields?: InsertFormField[];

  sharedStaticValues?: Record<string, string>;

  initializeFormState?: (state: FormState, s: StateStatements) => unknown;
}

export interface InsertFormField {
  field: string;
  initialValue?: string;
}

/** Using this you can extend what a form state helper does when submitting */
export interface FormStateProcedureExtensions {
  /**
   * Runs before the service proc starts
   *
   * You can set errors in the form state here and we will not start the service proc if there are errors.
   */
  beforeSubmitClient?: (state: FormState, s: DomStatements) => unknown;
  /**
   * Runs on the data service before the start of the transaction
   *
   * You can set errors in the form state here and we will not run the transaction if there are errors
   * and instead return the error to the client.
   */
  beforeTransactionStart?: (state: FormState, s: ServiceStatements) => unknown;
  /**
   * Runs after the start of the transaction, here you can set up any variables you would like to use
   * in the body of the transaction or you can just do some additional updates or inserts or deletes.
   */
  afterTransactionStart?: (state: FormState, s: ServiceStatements) => unknown;
  /**
   * Runs after the body of the transaction but before the commit, this lets you reference anything done
   * in the transaction body. For example if you insert a record and need to reference the id of the record
   * for an insert into another table you can do that here.
   */
  beforeTransactionCommit?: (state: FormState, s: ServiceStatements) => unknown;
  /**
   * Runs after the commit of the transaction, this lets you reference anything done and committed in the transaction body.
   */
  afterTransactionCommit?: (state: FormState, s: ServiceStatements) => unknown;
  /**
   * Runs on the client after the service procedure has completed successfully.
   */
  afterSubmitClient?: (state: FormState, s: DomStatements) => unknown;
}

export class MultiInsertFormState extends FormState {
  #table: Table;
  #fields: {
    field: Field;
    initialValue: yom.SqlExpression;
  }[];
  #sharedFields: {
    field: Field;
    initialValue: yom.SqlExpression;
  }[];
  #sharedStaticValues: Record<string, string>;
  #formStateExtensions?: FormStateProcedureExtensions;

  constructor(opts: MultiInsertFormOpts) {
    const table = app.db.tables[opts.table];
    if (!table) {
      throw new Error("Table " + opts.table + " does not exist in app db");
    }
    const fields = opts.fields.map((f) => {
      const fieldSchema = table.fields[f.field];
      if (!fieldSchema) {
        throw new Error(
          "Field " + f.field + " does not exist in table " + table
        );
      }
      return {
        field: fieldSchema,
        initialValue: f.initialValue ?? defaultInitialValue(fieldSchema),
      };
    });
    const sharedFields = opts.sharedFields
      ? opts.sharedFields.map((f) => {
          const fieldSchema = table.fields[f.field];
          return {
            field: fieldSchema,
            initialValue: f.initialValue ?? defaultInitialValue(fieldSchema),
          };
        })
      : [];
    super({
      tables: [
        {
          name: opts.table,
          fields: fields.map((f) => ({
            initialValue: f.initialValue,
            name: f.field.name,
            type: formFieldType(f.field),
          })),
        },
      ],
      fields: sharedFields.map((f) => ({
        initialValue: f.initialValue,
        name: f.field.name,
        type: formFieldType(f.field),
      })),
      initializeFormState: opts.initializeFormState,
    });
    this.#table = table;
    this.#fields = fields;
    this.#sharedFields = sharedFields;
    this.#sharedStaticValues = opts.sharedStaticValues ?? {};
    this.#formStateExtensions = opts;
  }

  get onSubmit() {
    const domProc = new DomStatements()
      .if(this.submitting, (s) => s.return())
      .statements(this.resetErrorState, this.setTouchedAll);
    for (const f of this.#sharedFields) {
      defaultValidate(f.field, this.field(f.field.name), domProc);
    }
    const tableCursor = this.iterTableCursor(this.#table.name);
    domProc.forEachTable(tableCursor.tableName, tableCursor.cursorName, (s) => {
      for (const f of this.#fields) {
        defaultValidate(f.field, tableCursor.field(f.field.name), s);
      }
      for (const check of this.#table.checks) {
        const fields = check.fields.map((f) => {
          if (this.#sharedStaticValues[f]) {
            return this.#sharedStaticValues[f];
          }
          const sharedField = this.#sharedFields.find(
            (sf) => sf.field.name === f
          );
          if (sharedField) {
            return this.field(sharedField.field.name).value;
          }
          return getNormalizedValue(
            this.#table.fields[f],
            tableCursor.field(f).value
          );
        });
        s.if(
          `not (` + check.check(fields) + `)`,
          tableCursor.setRecordError(check.errorMessage(fields))
        );
      }
    });
    this.#formStateExtensions?.beforeSubmitClient?.(this, domProc);
    domProc.if(this.hasAnyError, (s) => s.return());
    domProc.statements(this.setSubmitting(`true`));
    domProc.commitUiTreeChanges();
    domProc.try({
      body: (s) =>
        s.serviceProc((s) => {
          this.#formStateExtensions?.beforeTransactionStart?.(this, s);
          s.startTransaction();
          this.#formStateExtensions?.afterTransactionStart?.(this, s);
          const cursor = this.iterTableCursor(this.#table.name);
          s.forEachTable(cursor.tableName, cursor.cursorName, (s) => {
            const insertFields = [
              ...this.#sharedFields.map((f) => f.field.name),
              ...this.#fields.map((f) => f.field.name),
              ...Object.keys(this.#sharedStaticValues ?? {}),
            ].join(",");
            const insertValues = [
              ...this.#sharedFields.map((f) =>
                getNormalizedValue(f.field, this.field(f.field.name).value)
              ),
              ...this.#fields.map((f) =>
                getNormalizedValue(f.field, cursor.field(f.field.name).value)
              ),
              ...Object.values(this.#sharedStaticValues ?? {}),
            ].join(",");
            s.modify(
              `insert into db.${
                this.#table.name
              } (${insertFields}) values (${insertValues})`
            );
          });
          this.#formStateExtensions?.beforeTransactionCommit?.(this, s);
          s.commitTransaction();
          this.#formStateExtensions?.afterTransactionCommit?.(this, s);
        }),
      errorName: "err",
      catch: (s) =>
        s
          .debugExpr(`err.type`)
          .debugExpr(`err.message`)
          .debugExpr(`err.description`)
          .statements(
            this.setFormError("'Unable to submit form'"),
            this.setSubmitting(`false`)
          )
          .return(),
    });
    domProc.statements(this.setSubmitting(`false`));
    this.#formStateExtensions?.afterSubmitClient?.(this, domProc);
    return domProc;
  }
}

export interface WithMultiInsertFormOpts extends MultiInsertFormOpts {
  children: (state: MultiInsertFormState) => Node;
}

export function withMultiInsertFormState(
  opts: WithMultiInsertFormOpts
): StateNode {
  const state = new MultiInsertFormState(opts);
  return nodes.state({
    procedure: state.stateProcedure,
    children: opts.children(state),
  });
}

export interface InsertFormRelation {
  table: string;
  sharedFields?: InsertFormField[];
  fields: InsertFormField[];
  withValues?: Record<string, string>;
}

interface ComputedInsertField {
  formStateName: string;
  fieldModel: Field;
}

interface ComputedInsertRelation {
  tableModel: Table;
  sharedFields: ComputedInsertField[];
  withValues?: Record<string, string>;
  fields: ComputedInsertField[];
  formFields: FormStateField[];
  foreignKeyField: string;
}

export class InsertFormState extends FormState {
  #table: Table;
  #fields: ComputedInsertField[];
  #relations: ComputedInsertRelation[];
  #withValues: Record<string, string>;
  #formStateExtensions?: FormStateProcedureExtensions;

  constructor(opts: InsertFormStateOpts) {
    const table = app.db.tables[opts.table];
    const formFields: FormStateField[] = [];
    interface ComputedField {
      formStateName: string;
      fieldModel: Field;
    }
    const fields: ComputedField[] = [];
    for (const fieldConfig of opts.fields) {
      const fieldModel = table.fields[fieldConfig.field];
      if (!fieldModel) {
        throw new Error(`Field ${fieldConfig.field} not found`);
      }
      const formStateName = fieldModel.name;
      formFields.push({
        initialValue:
          fieldConfig.initialValue ?? defaultInitialValue(fieldModel),
        name: formStateName,
        type: formFieldType(fieldModel),
      });
      fields.push({
        fieldModel,
        formStateName,
      });
    }
    const relations: {
      tableModel: Table;
      sharedFields: ComputedField[];
      withValues?: Record<string, string>;
      fields: ComputedField[];
      formFields: FormStateField[];
      foreignKeyField: string;
    }[] = [];
    if (opts.relations) {
      for (const relation of opts.relations) {
        const relationTable = app.db.tables[relation.table];
        const sharedFields: ComputedField[] = [];
        if (relation.sharedFields) {
          for (const fieldConfig of relation.sharedFields) {
            const fieldModel = relationTable.fields[fieldConfig.field];
            const formStateName = fieldModel.name;
            formFields.push({
              initialValue:
                fieldConfig.initialValue ?? defaultInitialValue(fieldModel),
              name: formStateName,
              type: formFieldType(fieldModel),
            });
            sharedFields.push({ fieldModel, formStateName });
          }
        }
        const relationFormFields: FormStateField[] = [];
        const fields: ComputedField[] = [];
        for (const fieldConfig of relation.fields) {
          const fieldModel = relationTable.fields[fieldConfig.field];
          const formStateName = fieldModel.name;
          relationFormFields.push({
            initialValue:
              fieldConfig.initialValue ?? defaultInitialValue(fieldModel),
            name: formStateName,
            type: formFieldType(fieldModel),
          });
          fields.push({ fieldModel, formStateName });
        }
        const foreignKeyField = Object.values(relationTable.fields).find(
          (f) => f.type === "ForeignKey" && f.table === opts.table
        )!.name;
        relations.push({
          fields,
          formFields: relationFormFields,
          sharedFields,
          tableModel: relationTable,
          foreignKeyField,
          withValues: relation.withValues,
        });
      }
    }
    super({
      fields: formFields,
      tables: relations.map((r) => ({
        name: r.tableModel.name,
        fields: r.formFields,
      })),
    });
    this.#fields = fields;
    this.#relations = relations;
    this.#withValues = opts.withValues ?? {};
    this.#table = table;
    this.#formStateExtensions = opts;
  }

  get onSubmit() {
    const domProc = new DomStatements()
      .if(this.submitting, (s) => s.return())
      .statements(this.resetErrorState, this.setTouchedAll);
    for (const f of this.#fields) {
      defaultValidate(f.fieldModel, this.field(f.formStateName), domProc);
    }
    for (const f of this.#relations) {
      for (const field of f.sharedFields) {
        defaultValidate(
          field.fieldModel,
          this.field(field.formStateName),
          domProc
        );
      }
    }
    for (const check of this.#table.checks) {
      const fields = check.fields.map((f) => {
        if (this.#withValues && f in this.#withValues) {
          return this.#withValues[f];
        }
        return getNormalizedValue(this.#table.fields[f], this.field(f).value);
      });
      domProc.if(
        `not (` + check.check(fields) + `)`,
        this.setFormError(check.errorMessage(fields))
      );
    }
    // todo relation checks
    this.#formStateExtensions?.beforeSubmitClient?.(this, domProc);
    domProc.if(this.hasAnyError, (s) => s.return());
    domProc.statements(this.setSubmitting(`true`));
    domProc.commitUiTreeChanges();
    domProc.try({
      body: (s) =>
        s.serviceProc((s) => {
          this.#formStateExtensions?.beforeTransactionStart?.(this, s);
          s.startTransaction();
          this.#formStateExtensions?.afterTransactionStart?.(this, s);
          const insertCols = [
            ...this.#fields.map((f) => f.fieldModel.name),
            ...Object.keys(this.#withValues),
          ].join(",");
          const insertValues = [
            ...this.#fields.map((f) =>
              getNormalizedValue(
                f.fieldModel,
                this.field(f.formStateName).value
              )
            ),
            ...Object.values(this.#withValues),
          ].join(",");
          s.modify(
            `insert into db.${ident(
              this.#table.name
            )} (${insertCols}) values (${insertValues})`
          );
          for (const relation of this.#relations) {
            const cursor = this.iterTableCursor(relation.tableModel.name);
            s.forEachTable(cursor.tableName, cursor.cursorName, (s) => {
              const insertFields = [
                ...relation.sharedFields.map((f) => f.fieldModel.name),
                ...relation.fields.map((f) => f.fieldModel.name),
                ...(relation.withValues
                  ? Object.keys(relation.withValues)
                  : []),
              ].join(",");
              const insertValues = [
                ...relation.sharedFields.map((f) =>
                  getNormalizedValue(
                    f.fieldModel,
                    this.field(f.formStateName).value
                  )
                ),
                ...relation.fields.map((f) =>
                  getNormalizedValue(
                    f.fieldModel,
                    cursor.field(f.formStateName).value
                  )
                ),
                ...(relation.withValues
                  ? Object.values(relation.withValues)
                  : []),
              ].join(",");
              s.modify(
                `insert into db.${ident(
                  relation.tableModel.name
                )} (${insertFields}, ${
                  relation.foreignKeyField
                }) values (${insertValues}, last_record_id(db.${ident(
                  this.#table.name
                )}))`
              );
            });
          }
          this.#formStateExtensions?.beforeTransactionCommit?.(this, s);
          s.commitTransaction();
          this.#formStateExtensions?.afterTransactionCommit?.(this, s);
        }),
      errorName: "err",
      catch: (s) =>
        s
          .debugExpr(`err.type`)
          .debugExpr(`err.message`)
          .debugExpr(`err.description`)
          .statements(
            this.setFormError("'Unable to submit form'"),
            this.setSubmitting(`false`)
          )
          .return(),
    });
    domProc.statements(this.setSubmitting(`false`));
    this.#formStateExtensions?.afterSubmitClient?.(this, domProc);
    return domProc;
  }
}

export interface InsertFormStateOpts extends FormStateProcedureExtensions {
  table: string;
  fields: InsertFormField[];
  relations?: InsertFormRelation[];
  withValues?: Record<string, string>;
}

export interface withInsertFormStateOpts extends InsertFormStateOpts {
  children: (state: InsertFormState) => Node;
}

export function withInsertFormState(opts: withInsertFormStateOpts): StateNode {
  const state = new InsertFormState(opts);
  return nodes.state({
    procedure: state.stateProcedure,
    children: opts.children(state),
  });
}

export function defaultInitialValue(field: Field): string {
  if (field.default) {
    return field.default;
  }
  switch (field.type) {
    case "Bool":
      return field.notNull ? `false` : `null`;
    case "String":
    case "TinyUint":
    case "TinyInt":
    case "Decimal":
    case "SmallInt":
    case "SmallUint":
    case "Int":
    case "Uint":
    case "Uuid":
    case "BigInt":
    case "Real":
    case "Double":
    case "BigUint":
      return `''`;
    case "Enum":
      if (field.notNull) {
        const enum_ = app.enums[field.enum];
        const firstValue = Object.values(enum_.values)[0];
        return `cast(${stringLiteral(firstValue.name)} as enums.${enum_.name})`;
      }
      return `null`;
    case "Date":
    case "Timestamp":
    case "ForeignKey":
    case "Tx":
      return "null";
    case "Ordering":
    case "Time":
      throw new Error(`${field.type} not implemented for forms`);
  }
}

export function defaultValidate(
  field: Field,
  { error, value, setError }: FormStateFieldHelper,
  statements: DomStatements
) {
  if (field.checks) {
    for (const check of field.checks) {
      statements.if(
        `${error} is null and not (${check.check(value)})`,
        setError(check.errorMessage(value))
      );
    }
  }
  switch (field.type) {
    case "String":
      if (field.notNull) {
        statements.if(
          `${value} is null or trim(${value}) = ''`,
          setError(`'Required'`)
        );
      }
      if (field.minLength) {
        statements.if(
          `${error} is null and ${value} is not null and trim(${value}) != '' and char_length(${value}) < ${field.minLength}`,
          setError(`'Expected at least ${field.minLength} charcters'`)
        );
      }
      statements.if(
        `${error} is null and ${value} is not null and char_length(${value}) > ${field.maxLength}`,
        setError(`'Expected at most ${field.maxLength} characters'`)
      );
      break;
    case "ForeignKey":
      if (field.notNull) {
        statements.if(`${value} is null`, setError(`'Required'`));
      }
      break;
    case "Bool":
      break;
    case "TinyInt":
    case "TinyUint":
    case "SmallInt":
    case "SmallUint":
    case "Int":
    case "Uint":
    case "BigInt":
    case "BigUint": {
      if (field.usage) {
        if (field.usage.type === "Duration") {
          return;
        }
      }
      let min = field.min;
      let max = field.max;
      if (!min) {
        switch (field.type) {
          case "TinyUint":
          case "SmallUint":
          case "Uint":
          case "BigUint":
            min = "0";
            break;
          case "TinyInt":
            min = "-128";
            break;
          case "SmallInt":
            min = "-32768";
            break;
          case "Int":
            min = "-2147483648";
            break;
          case "BigInt":
            min = "-9223372036854775808";
            break;
        }
      }
      if (!max) {
        switch (field.type) {
          case "TinyUint":
            max = "255";
            break;
          case "SmallUint":
            max = "65535";
            break;
          case "Uint":
            max = "4294967295";
            break;
          case "TinyInt":
            max = "127";
            break;
          case "SmallInt":
            max = "32767";
            break;
          case "Int":
            max = "2147483647";
            break;
          case "BigUint":
          case "BigInt":
            max = "9223372036854775807";
            break;
        }
      }
      if (field.notNull) {
        statements.if(
          `${value} is null or trim(${value}) = ''`,
          setError(`'Required'`)
        );
      }
      statements.block((s) =>
        s
          .scalar(`as_bigint`, `try_cast(${value} as bigint)`)
          .if(
            `${error} is null and ${value} is not null and trim(${value}) != '' and as_bigint is null`,
            setError(`'Not a valid number'`)
          )
          .if(
            `${error} is null and ${value} is not null and trim(${value}) != '' and as_bigint is not null and as_bigint < ${min}`,
            setError(`'Must be at least ${min}'`)
          )
          .if(
            `${error} is null and ${value} is not null and trim(${value}) != '' and as_bigint is not null and as_bigint > ${max}`,
            setError(`'Must be at most ${min}'`)
          )
      );
    }
    case "Real":
      if (field.notNull) {
        statements.if(
          `${value} is null or trim(${value}) = ''`,
          setError(`'Required'`)
        );
      }
      statements.if(
        `${error} is null and ${value} is not null and trim(${value}) != '' and try_cast(${value} as real) is null`,
        setError(`'Not a valid number'`)
      );
      break;
    case "Double":
      if (field.notNull) {
        statements.if(
          `${value} is null or trim(${value}) = ''`,
          setError(`'Required'`)
        );
      }
      statements.if(
        `${error} is null and ${value} is not null and trim(${value}) != '' and try_cast(${value} as double) is null`,
        setError(`'Not a valid number'`)
      );
      break;
    case "Decimal": {
      if (field.notNull) {
        statements.if(
          `${value} is null or trim(${value}) = ''`,
          setError(`'Required'`)
        );
      }
      // eventually I should improve the error message here
      statements.block((s) =>
        s
          .scalar(
            `as_decimal`,
            `try_cast(${value} as decimal(${field.precision}, ${field.scale}))`
          )
          .if(
            `${error} is null and ${value} is not null and trim(${value}) != '' and as_decimal is null`,
            setError(`'Not a valid decimal'`)
          )
      );
      break;
    }
    case "Uuid":
      if (field.notNull) {
        statements.if(
          `${value} is null or trim(${value}) = ''`,
          setError(`'Required'`)
        );
      }
      statements.if(
        `${error} is null and ${value} is not null and trim(${value}) != '' and try_cast(${value} as uuid) is null`,
        setError(`'Invalid UUID'`)
      );
      break;
    case "Tx":
      if (field.notNull) {
        statements.if(
          `${value} is null or trim(${value}) = ''`,
          setError(`'Required'`)
        );
      }
      statements.if(
        `${error} is null and ${value} is not null and trim(${value}) != '' and try_cast(${value} as bigint) is null`,
        setError(`'Tx id must be a number'`)
      );
      break;
  }
  return statements;
}

function getUpdateFormStateValueFromRecordValue(
  field: Field,
  value: yom.SqlExpression
): yom.SqlExpression {
  if ("usage" in field) {
    if (field.usage?.type === "Duration") {
      if (field.usage?.size !== "minutes") {
        throw new Error("Only minutes duration is supported");
      }
      return `sfn.display_minutes_duration(${value})`;
    }
  }
  return value;
}

export interface UpdateFormField {
  field: string;
  initialValue?: string;
}

export interface UpdateFormStateOpts extends FormStateProcedureExtensions {
  table: string;
  fields: UpdateFormField[];

  initialRecord?: string;
  recordId?: string;
}

export class UpdateFormState extends FormState {
  #table: Table;
  #fields: {
    field: Field;
    initialValue: yom.SqlExpression;
  }[];
  #formStateExtensions?: FormStateProcedureExtensions;
  #initialRecord?: string;
  #recordId?: string;

  constructor(opts: UpdateFormStateOpts) {
    const table = app.db.tables[opts.table];
    const fields = opts.fields.map((f) => {
      const fieldSchema = table.fields[f.field];
      if (!fieldSchema) {
        throw new Error("Field " + f.field + " does not exist in table");
      }
      let initialValue: yom.SqlExpression;
      if (f.initialValue) {
        initialValue = f.initialValue;
      } else if (opts.initialRecord) {
        initialValue = getUpdateFormStateValueFromRecordValue(
          fieldSchema,
          `${opts.initialRecord}.${f.field}`
        );
      } else {
        throw new Error(
          "In an update form `initialRecord` or `initialValue` must be supplied"
        );
      }
      return {
        field: fieldSchema,
        initialValue,
      };
    });
    super({
      fields: fields.map((f) => ({
        initialValue: f.initialValue,
        name: f.field.name,
        type: formFieldType(f.field),
      })),
    });
    this.#table = table;
    this.#fields = fields;
    this.#formStateExtensions = opts;
    this.#initialRecord = opts.initialRecord;
    this.#recordId = opts.recordId;
  }

  get onSubmit() {
    const domProc = new DomStatements()
      .if(this.submitting, (s) => s.return())
      .statements(this.resetErrorState, this.setTouchedAll);
    for (const f of this.#fields) {
      defaultValidate(f.field, this.field(f.field.name), domProc);
    }
    for (const check of this.#table.checks) {
      const fieldExprs = check.fields.map((f) => {
        if (this.#fields.some((field) => field.field.name === f)) {
          return getNormalizedValue(this.#table.fields[f], this.field(f).value);
        }
        if (!this.#initialRecord) {
          throw new Error(
            "Update form on table with checks but not supplying an `initialRecord`"
          );
        }
        return getNormalizedValue(
          this.#table.fields[f],
          this.#initialRecord + "." + f
        );
      });
      domProc.if(
        `not (` + check.check(fieldExprs) + `)`,
        this.setFormError(check.errorMessage(fieldExprs))
      );
    }
    this.#formStateExtensions?.beforeSubmitClient?.(this, domProc);
    domProc.if(this.hasAnyError, (s) => s.return());
    domProc.statements(this.setSubmitting(`true`));
    domProc.commitUiTreeChanges();
    domProc.try({
      body: (s) =>
        s.serviceProc((s) => {
          this.#formStateExtensions?.beforeTransactionStart?.(this, s);
          s.startTransaction();
          this.#formStateExtensions?.afterTransactionStart?.(this, s);
          const setValues = this.#fields
            .map((f) => {
              const value = getNormalizedValue(
                f.field,
                this.field(f.field.name).value
              );
              return `${f.field.name} = ${value}`;
            })
            .join(" , ");
          let recordId = this.#recordId;
          if (!recordId) {
            if (this.#initialRecord) {
              recordId = `${this.#initialRecord}.id`;
            } else {
              throw new Error(
                "You must specify either recordId or initialRecord for an update form"
              );
            }
          }
          s.modify(
            `update db.${
              this.#table.name
            } set ${setValues} where id = ${recordId}`
          );
          this.#formStateExtensions?.beforeTransactionCommit?.(this, s);
          s.commitTransaction();
          this.#formStateExtensions?.afterTransactionCommit?.(this, s);
        }),
      errorName: "err",
      catch: (s) =>
        s
          .debugExpr(`err.type`)
          .debugExpr(`err.message`)
          .debugExpr(`err.description`)
          .statements(
            this.setFormError("'Unable to submit form'"),
            this.setSubmitting(`false`)
          )
          .return(),
    });
    domProc.statements(this.setSubmitting(`false`));
    this.#formStateExtensions?.afterSubmitClient?.(this, domProc);
    return domProc;
  }
}

export interface WithUpdateFormStateOpts extends UpdateFormStateOpts {
  children: (state: UpdateFormState) => Node;
}

export function withUpdateFormState(opts: WithUpdateFormStateOpts) {
  const state = new UpdateFormState(opts);
  return nodes.state({
    procedure: state.stateProcedure,
    children: opts.children(state),
  });
}
