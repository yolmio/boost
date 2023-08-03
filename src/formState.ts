import type { Field, Table } from "./appTypes";
import type {
  BaseStatement,
  BasicStatement,
  ClientProcStatement,
  EventHandler,
  FieldType,
  ForEachTableStatement,
  ProcTableField,
  ServiceProcStatement,
  SqlExpression,
  StateStatement,
} from "./yom.js";
import {
  block,
  commitTransaction,
  commitUiChanges,
  debugExpr,
  debugQuery,
  exit,
  forEachTable,
  if_,
  modify,
  record,
  scalar,
  serviceProc,
  setScalar,
  startTransaction,
  table,
  try_,
} from "./procHelpers.js";
import { app } from "./singleton.js";
import { EachNode, Node, StateNode } from "./nodeTypes.js";
import { ident, stringLiteral } from "./utils/sqlHelpers.js";

export interface ErrorState {
  touched: string;
  setTouched: ClientProcStatement[] | ClientProcStatement;
  error: string;
  setError: (err: string) => ClientProcStatement;
  resetError: ClientProcStatement[] | ClientProcStatement;
  validate: ClientProcStatement[] | ClientProcStatement;
}

export interface FormStateFieldHelper {
  value: string;
  setValue: (v: string) => BaseStatement;
  error: string;
  setError: (err: string) => BaseStatement;
  hasError: string;
  touched: string;
  setTouched: BaseStatement;
}

export interface FormStateFields {
  get(name: string): string;
  set(name: string, value: string): BaseStatement;
  error(name: string): string;
  hasError(name: string): string;
  setError(name: string, value: string): BaseStatement;
  touched(name: string): string;
  setTouched(name: string): BaseStatement;
  setTouchedAll: BaseStatement;
  setTouchedNone: BaseStatement;
  resetErrorState: BaseStatement;
  hasAnyError: string;
  helper(name: string): FormStateFieldHelper;
}

export interface FormState {
  fields: FormStateFields;
  fieldHelper: (field: string) => FormStateFieldHelper;
  setTouchedAll: BaseStatement[];
  setTouchedNone: BaseStatement[];
  resetErrorState: BaseStatement[];
  hasAnyError: string;
  submitting: string;
  setSubmitting: (submitting: string) => BaseStatement;
  getFormError: string;
  hasFormError: string;
  setFormError(name: string): BaseStatement;
  debugFormState(): BaseStatement[];

  each(table: string, render: (v: FormStateTableCursor) => Node): EachNode;
  addRecordToTable(
    table: string,
    fields: { [s: string]: string }
  ): BaseStatement[];
  iterTable<T>(
    table: string,
    iter: (opts: FormStateTableCursor) => T | T[]
  ): ForEachTableStatement<T>;
}

export interface FormStateTableCursor {
  idField: string;
  field(name: string): FormStateFieldHelper;
  delete: BaseStatement;
  recordError: string;
  hasRecordError: string;
  setRecordError: (err: string) => BaseStatement;
}

export interface FormStateField {
  name: string;
  initialValue: string;
  notNull?: boolean;
  type: FieldType;
}

const TOUCHED_SUFFIX = `_fs_touched`;
const ERROR_SUFFIX = `_fs_error`;
const FORM_ERROR_SCALAR = `fn_error`;
const FORM_SUBMITTING_SCALAR = `fs_submitting`;
const FORM_FIELDS_RECORD = `fs_fields`;
const FORM_STATE_TABLE_ID = `fs_id`;
const FORM_STATE_TABLE_ERR = `fs_err`;
const NEXT_ID_SCALAR = `fs_unique_id`;

function createProcFields(fields: FormStateField[]): ProcTableField[] {
  const procFields: ProcTableField[] = [];
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
  initializeFormState?: (state: FormState) => BasicStatement[];
  children: (state: FormState) => Node;
}

export function withFormState(opts: FormStateOpts): StateNode {
  const proc: StateStatement[] = [
    scalar(FORM_ERROR_SCALAR, { type: "String", maxLength: 500 }),
    scalar(FORM_SUBMITTING_SCALAR, `false`),
    opts.tables?.length !== 0
      ? scalar(NEXT_ID_SCALAR, { type: "Int" }, "0")
      : null,
  ];
  if (opts.fields && opts.fields.length !== 0) {
    proc.push(record(FORM_FIELDS_RECORD, createProcFields(opts.fields)));
    const insertFields = [];
    const insertValues = [];
    for (const field of opts.fields) {
      insertFields.push(field.name);
      insertFields.push(field.name + TOUCHED_SUFFIX);
      insertValues.push(field.initialValue);
      insertValues.push(`false`);
    }
    proc.push(
      modify(
        `insert into ${FORM_FIELDS_RECORD} (${insertFields.join(
          ","
        )}) values (${insertValues.join(",")})`
      )
    );
  }
  if (opts.tables && opts.tables.length !== 0) {
    for (const optTable of opts.tables) {
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
      proc.push(table(optTable.name, fields));
    }
  }
  function assertTableFieldExists(
    tableName: string,
    field: string,
    fnName: string
  ) {
    const table = opts.tables!.find((t) => t.name === tableName)!;
    if (table.fields.some((f) => f.name === field)) {
      return;
    }
    throw new Error(
      `Passed field '${field}' to form state function ${fnName} which doesn't exist`
    );
  }
  function assertFieldExists(field: string, fnName: string) {
    if (opts.fields && opts.fields.length !== 0) {
      if (opts.fields.some((f) => f.name === field)) {
        return;
      }
    }
    throw new Error(
      `Passed field '${field}' to form state function ${fnName} which doesn't exist`
    );
  }
  function assertTableExists(table: string, fnName: string) {
    if (opts.tables && opts.tables.length !== 0) {
      if (opts.tables.some((f) => f.name === table)) {
        return;
      }
    }
    throw new Error(
      `Passed table '${table}' to form state function ${fnName} which doesn't exist`
    );
  }
  const fields: FormStateFields = {
    get: (field) => {
      assertFieldExists(field, `fields.get`);
      return `ui.` + FORM_FIELDS_RECORD + `.` + field;
    },
    set: (field, value) => {
      assertFieldExists(field, `fields.set`);
      return modify(`update ui.${FORM_FIELDS_RECORD} set ${field} = ${value}`);
    },
    error: (field) => {
      assertFieldExists(field, `fields.error`);
      return `ui.` + FORM_FIELDS_RECORD + `.` + field + ERROR_SUFFIX;
    },
    hasError: (field) => {
      assertFieldExists(field, `fields.hasError`);
      return (
        `ui.` + FORM_FIELDS_RECORD + `.` + field + ERROR_SUFFIX + ` is not null`
      );
    },
    setError: (field, value) => {
      assertFieldExists(field, `fields.setError`);
      return modify(
        `update ui.${FORM_FIELDS_RECORD} set ${field}${ERROR_SUFFIX} = ${value}`
      );
    },
    touched: (field) => {
      assertFieldExists(field, `fields.touched`);
      return `ui.` + FORM_FIELDS_RECORD + `.` + field + TOUCHED_SUFFIX;
    },
    setTouched: (field) => {
      assertFieldExists(field, `fields.set`);
      return modify(
        `update ui.${FORM_FIELDS_RECORD} set ${field}${TOUCHED_SUFFIX} = true`
      );
    },
    setTouchedAll: modify(
      `update ui.${FORM_FIELDS_RECORD} set ${(opts.fields ?? [])
        .map((f) => `${f.name}${TOUCHED_SUFFIX} = true`)
        .join(",")}`
    ),
    setTouchedNone: modify(
      `update ui.${FORM_FIELDS_RECORD} set ${(opts.fields ?? [])
        .map((f) => `${f.name}${TOUCHED_SUFFIX} = false`)
        .join(",")}`
    ),
    resetErrorState: modify(
      `update ui.${FORM_FIELDS_RECORD} set ${(opts.fields ?? [])
        .map((f) => `${f.name}${ERROR_SUFFIX} = null`)
        .join(", ")}`
    ),
    hasAnyError: (opts.fields ?? [])
      .map(
        (f) => `ui.${FORM_FIELDS_RECORD}.${f.name}${ERROR_SUFFIX} is not null`
      )
      .join(` or `),
    helper: (field) => {
      assertFieldExists(field, `fields.helper`);
      return {
        value: FORM_FIELDS_RECORD + `.` + field,
        setValue: (value) =>
          modify(`update ui.${FORM_FIELDS_RECORD} set ${field} = ${value}`),
        error: FORM_FIELDS_RECORD + "." + field + ERROR_SUFFIX,
        hasError:
          FORM_FIELDS_RECORD + "." + field + ERROR_SUFFIX + ` is not null`,
        setError: (err) =>
          modify(
            `update ui.${FORM_FIELDS_RECORD} set ${field}${ERROR_SUFFIX} = ${err}`
          ),
        touched: FORM_FIELDS_RECORD + "." + field + TOUCHED_SUFFIX,
        setTouched: modify(
          `update ui.${FORM_FIELDS_RECORD} set ${field}${TOUCHED_SUFFIX} = true`
        ),
      };
    },
  };
  function getTableCursor(
    tableName: string,
    recordName: string
  ): FormStateTableCursor {
    const recordId = recordName + "." + FORM_STATE_TABLE_ID;
    return {
      delete: modify(
        `delete from ui.${tableName} where ${FORM_STATE_TABLE_ID} = ${recordId}`
      ),
      idField: recordId,
      hasRecordError: `${recordName}.${FORM_STATE_TABLE_ERR} is not null`,
      recordError: `${recordName}.${FORM_STATE_TABLE_ERR}`,
      setRecordError: (err) =>
        modify(
          `update ui.${tableName} set ${FORM_STATE_TABLE_ERR} = ${err} where ${FORM_STATE_TABLE_ID} = ${recordId}`
        ),
      field: (field) => {
        assertTableFieldExists(tableName, field, `each(${tableName}).field`);

        return {
          value: recordName + `.` + field,
          setValue: (value) =>
            modify(
              `update ui.${tableName} set ${field} = ${value} where ${FORM_STATE_TABLE_ID} = ${recordId}`
            ),
          error: recordName + "." + field + ERROR_SUFFIX,
          hasError: recordName + "." + field + ERROR_SUFFIX + ` is not null`,
          setError: (err) =>
            modify(
              `update ui.${tableName} set ${field}${ERROR_SUFFIX} = ${err} where ${FORM_STATE_TABLE_ID} = ${recordId}`
            ),
          touched: recordName + "." + field + TOUCHED_SUFFIX,
          setTouched: modify(
            `update ui.${tableName} set ${field}${TOUCHED_SUFFIX} = true where ${FORM_STATE_TABLE_ID} = ${recordId}`
          ),
        };
      },
    };
  }
  const formState: FormState = {
    fields,
    setTouchedAll: [
      fields.setTouchedAll,
      ...(opts.tables ?? []).map((t) => {
        return modify(
          `update ui.${t.name} set ${t.fields
            .map((f) => `${f.name}${TOUCHED_SUFFIX} = true`)
            .join(`,`)}`
        );
      }),
    ],
    setTouchedNone: [
      fields.setTouchedNone,
      ...(opts.tables ?? []).map((t) => {
        return modify(
          `update ui.${t.name} set ${t.fields
            .map((f) => `${f.name}${TOUCHED_SUFFIX} = true`)
            .join(`,`)}`
        );
      }),
    ],

    fieldHelper: (field: string) => {
      assertFieldExists(field, "fieldHelper");
      return {
        value: `ui.` + FORM_FIELDS_RECORD + `.` + field,
        setValue: (value) =>
          modify(`update ui.${FORM_FIELDS_RECORD} set ${field} = ${value}`),
        error: `ui.` + FORM_FIELDS_RECORD + "." + field + ERROR_SUFFIX,
        hasError:
          FORM_FIELDS_RECORD + "." + field + ERROR_SUFFIX + ` is not null`,
        setError: (err) =>
          modify(
            `update ui.${FORM_FIELDS_RECORD} set ${field}${ERROR_SUFFIX} = ${err}`
          ),
        touched: `ui.` + FORM_FIELDS_RECORD + "." + field + TOUCHED_SUFFIX,
        setTouched: modify(
          `update ui.${FORM_FIELDS_RECORD} set ${field}${TOUCHED_SUFFIX} = true`
        ),
      };
    },

    getFormError: `ui.` + FORM_ERROR_SCALAR,
    hasFormError: `ui.` + FORM_ERROR_SCALAR + ` is not null`,
    setFormError: (value) => setScalar(`ui.` + FORM_ERROR_SCALAR, value),
    submitting: `ui.${FORM_SUBMITTING_SCALAR}`,
    setSubmitting: (waiting) =>
      setScalar(`ui.${FORM_SUBMITTING_SCALAR}`, waiting),

    debugFormState: () => [
      debugQuery(`select * from ui.${FORM_FIELDS_RECORD}`),
      ...(opts.tables ?? []).map((t) =>
        debugQuery(`select * from ui.${t.name}`)
      ),
      debugExpr(`'Form error: ' || ui.${FORM_ERROR_SCALAR}`),
      debugExpr(`'Form waiting: ' || ui.${FORM_SUBMITTING_SCALAR}`),
    ],

    hasAnyError:
      fields.hasAnyError +
      ` or ${FORM_ERROR_SCALAR} is not null` +
      (opts.tables && opts.tables.length !== 0
        ? " or " +
          opts.tables
            .map((t) => {
              return `(select bool_or(${FORM_STATE_TABLE_ERR} is not null or ${t.fields
                .map((f) => f.name + ERROR_SUFFIX + " is not null")
                .join(` or `)}) from ui.${t.name})`;
            })
            .join(` or `)
        : ``),

    resetErrorState: [
      fields.resetErrorState,
      setScalar(`ui.${FORM_ERROR_SCALAR}`, `null`),
      ...(opts.tables ?? []).map((t) => {
        return modify(
          `update ui.${t.name} set ${t.fields
            .map((f) => f.name + ERROR_SUFFIX + ` = null`)
            .join(`,`)}`
        );
      }),
    ],

    addRecordToTable: (tableName, fields) => {
      assertTableExists(tableName, `addRecordToTable`);
      const tableObj = opts.tables!.find((t) => t.name === tableName)!;
      const insertFields = [];
      const insertValues = [];
      for (const field of tableObj.fields) {
        insertFields.push(field.name);
        insertFields.push(field.name + TOUCHED_SUFFIX);
        insertValues.push(fields[field.name] ?? field.initialValue);
        insertValues.push(`false`);
      }
      return [
        modify(
          `insert into ui.${tableName} (fs_id, ${insertFields.join(
            ","
          )}) values (ui.${NEXT_ID_SCALAR}, ${insertValues.join(`,`)})`
        ),
        setScalar(`ui.${NEXT_ID_SCALAR}`, `ui.${NEXT_ID_SCALAR} + 1`),
      ];
    },
    each: (
      tableName: string,
      render: (opts: FormStateTableCursor) => Node
    ): EachNode => {
      assertTableExists(tableName, `each`);
      const recordName = `record` + tableName;
      return {
        t: "Each",
        table: tableName,
        recordName,
        key: FORM_STATE_TABLE_ID,
        children: render(getTableCursor(tableName, recordName)),
      };
    },

    iterTable: (tableName, f) => {
      assertTableExists(tableName, `iterTable`);
      const recordName = tableName + `_record`;
      return forEachTable(
        "ui." + tableName,
        recordName,
        f(getTableCursor(tableName, recordName))
      );
    },
  };
  const initializationStatements = opts.initializeFormState?.(formState);
  if (initializationStatements) {
    proc.push(...initializationStatements);
  }
  return {
    t: "State",
    procedure: proc,
    children: opts.children(formState),
  };
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

export function formFieldType(field: Field): FieldType {
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

interface InsertFormState {
  formState: FormState;
  onSubmit: EventHandler;
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
  beforeSubmitClient?: (state: FormState) => ClientProcStatement[];
  /**
   * Runs on the data service before the start of the transaction
   *
   * You can set errors in the form state here and we will not run the transaction if there are errors
   * and instead return the error to the client.
   */
  beforeTransactionStart?: (state: FormState) => ServiceProcStatement[];
  /**
   * Runs after the start of the transaction, here you can set up any variables you would like to use
   * in the body of the transaction or you can just do some additional updates or inserts or deletes.
   */
  afterTransactionStart?: (state: FormState) => ServiceProcStatement[];
  /**
   * Runs after the body of the transaction but before the commit, this lets you reference anything done
   * in the transaction body. For example if you insert a record and need to reference the id of the record
   * for an insert into another table you can do that here.
   */
  beforeTransactionCommit?: (state: FormState) => ServiceProcStatement[];
  /**
   * Runs after the commit of the transaction, this lets you reference anything done and committed in the transaction body.
   */
  afterTransactionCommit?: (state: FormState) => ServiceProcStatement[];
  /**
   * Runs on the client after the service procedure has completed successfully.
   */
  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
}

export interface WithMultiInsertFormOpts extends FormStateProcedureExtensions {
  defaultInitialValue?: (field: Field) => string;
  defaultPrepare?: (field: Field, value: string) => string;

  table: string;
  fields: InsertFormField[];
  sharedFields?: InsertFormField[];

  sharedStaticValues?: Record<string, string>;

  initializeFormState?: (state: FormState) => BasicStatement[];
  children: (state: InsertFormState) => Node;
}

export function withMultiInsertFormState(
  opts: WithMultiInsertFormOpts
): StateNode {
  const table = app.database.tables[opts.table];
  if (!table) {
    throw new Error("Table " + opts.table + " does not exist in model");
  }
  const fields = opts.fields.map((f) => {
    const fieldSchema = table.fields[f.field];
    if (!fieldSchema) {
      throw new Error("Field " + f.field + " does not exist in table " + table);
    }
    return {
      field: fieldSchema,
      initialValue:
        f.initialValue ??
        opts.defaultInitialValue?.(fieldSchema) ??
        defaultInitialValue(fieldSchema),
    };
  });
  const sharedFields = opts.sharedFields
    ? opts.sharedFields.map((f) => {
        const fieldSchema = table.fields[f.field];
        return {
          field: fieldSchema,
          initialValue:
            f.initialValue ??
            opts.defaultInitialValue?.(fieldSchema) ??
            defaultInitialValue(fieldSchema),
        };
      })
    : [];
  return withFormState({
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
    children: (formState) => {
      const checkSharedFields = sharedFields
        .map((f) => {
          return defaultValidate(f.field, formState.fieldHelper(f.field.name));
        })
        .flat();
      const tableErrors = formState.iterTable(opts.table, (cursor) => {
        const checkFields = fields
          .map((f) => {
            return defaultValidate(f.field, cursor.field(f.field.name));
          })
          .flat();
        const checkTables = table.checks.map((check) => {
          const fields = check.fields.map((f) => {
            if (opts.sharedStaticValues?.[f]) {
              return opts.sharedStaticValues?.[f];
            }
            const sharedField = sharedFields.find((sf) => sf.field.name === f);
            if (sharedField) {
              return formState.fields.get(sharedField.field.name);
            }
            return getNormalizedValue(table.fields[f], cursor.field(f).value);
          });
          return if_(`not (` + check.check(fields) + `)`, [
            cursor.setRecordError(check.errorMessage(fields)),
          ]);
        });
        return [...checkFields, ...checkTables];
      });
      const serviceProcStatements = [
        startTransaction(),
        ...(opts.afterTransactionStart?.(formState) ?? []),
        formState.iterTable(table.name, (cursor) => {
          const insertFields = [
            ...sharedFields.map((f) => f.field.name),
            ...fields.map((f) => f.field.name),
            ...Object.keys(opts.sharedStaticValues ?? {}),
          ].join(",");
          const insertValues = [
            ...sharedFields.map((f) =>
              getNormalizedValue(f.field, formState.fields.get(f.field.name))
            ),
            ...fields.map((f) =>
              getNormalizedValue(f.field, cursor.field(f.field.name).value)
            ),
            ...Object.values(opts.sharedStaticValues ?? {}),
          ].join(",");
          return modify(
            `insert into db.${table.name} (${insertFields}) values (${insertValues})`
          );
        }),
        ...(opts.beforeTransactionCommit?.(formState) ?? []),
        commitTransaction(),
        ...(opts.afterTransactionCommit?.(formState) ?? []),
      ];
      const onSubmit: EventHandler = {
        procedure: [
          if_(formState.submitting, [exit()]),
          ...formState.resetErrorState,
          ...formState.setTouchedAll,
          ...checkSharedFields,
          tableErrors,
          if_(formState.hasAnyError, [exit()]),
          formState.setSubmitting(`true`),
          commitUiChanges(),
          try_<ClientProcStatement>({
            body: [
              serviceProc(
                opts.beforeTransactionStart
                  ? [
                      ...opts.beforeTransactionStart(formState),
                      if_(
                        `not ` + formState.hasAnyError,
                        serviceProcStatements
                      ),
                    ]
                  : serviceProcStatements
              ),
            ],
            errorName: "err",
            catch: [
              debugExpr(`err.type`),
              debugExpr(`err.message`),
              debugExpr(`err.description`),
              formState.setFormError("'Unable to submit form'"),
              formState.setSubmitting(`false`),
              exit(),
            ],
          }),
          formState.setSubmitting(`false`),
          ...(opts.afterSubmitClient?.(formState) ?? []),
        ],
      };
      return opts.children({ formState, onSubmit });
    },
  });
}

export interface InsertFormRelation {
  table: string;
  sharedFields?: InsertFormField[];
  fields: InsertFormField[];
  withValues?: Record<string, string>;
}

export interface WithInsertFormStateOpts extends FormStateProcedureExtensions {
  table: string;
  fields: InsertFormField[];
  relations?: InsertFormRelation[];
  withValues?: Record<string, string>;
  children: (state: InsertFormState) => Node;
}

export function withInsertFormState(opts: WithInsertFormStateOpts): StateNode {
  const table = app.database.tables[opts.table];
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
      initialValue: fieldConfig.initialValue ?? defaultInitialValue(fieldModel),
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
      const relationTable = app.database.tables[relation.table];
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
  return withFormState({
    fields: formFields,
    tables: relations.map((r) => ({
      name: r.tableModel.name,
      fields: r.formFields,
    })),
    children: (formState) => {
      const insertCols = [
        ...fields.map((f) => f.fieldModel.name),
        ...(opts.withValues ? Object.keys(opts.withValues) : []),
      ].join(",");
      const insertValues = [
        ...fields.map((f) =>
          getNormalizedValue(
            f.fieldModel,
            formState.fields.get(f.formStateName)
          )
        ),
        ...(opts.withValues ? Object.values(opts.withValues) : []),
      ].join(",");
      const checkFields = fields
        .concat(relations.map((r) => r.sharedFields).flat())
        .map((f) =>
          defaultValidate(f.fieldModel, formState.fieldHelper(f.formStateName))
        )
        .flat();
      const checkTables = table.checks.map((check) => {
        const fields = check.fields.map((f) => {
          if (opts.withValues && f in opts.withValues) {
            return opts.withValues[f];
          }
          return getNormalizedValue(table.fields[f], formState.fields.get(f));
        });
        return if_(`not (` + check.check(fields) + `)`, [
          formState.setFormError(check.errorMessage(fields)),
        ]);
      });
      // todo relation checks
      const insertRelations = [];
      for (const relation of relations) {
        insertRelations.push(
          formState.iterTable(relation.tableModel.name, (cursor) => {
            const insertFields = [
              ...relation.sharedFields.map((f) => f.fieldModel.name),
              ...relation.fields.map((f) => f.fieldModel.name),
              ...(relation.withValues ? Object.keys(relation.withValues) : []),
            ].join(",");
            const insertValues = [
              ...relation.sharedFields.map((f) =>
                getNormalizedValue(
                  f.fieldModel,
                  formState.fields.get(f.formStateName)
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
            return modify(
              `insert into db.${ident(
                relation.tableModel.name
              )} (${insertFields}, ${
                relation.foreignKeyField
              }) values (${insertValues}, last_record_id(db.${ident(
                opts.table
              )}))`
            );
          })
        );
      }
      const serviceProcStatements = [
        startTransaction(),
        ...(opts.afterTransactionStart?.(formState) ?? []),
        modify(
          `insert into db.${table.name} (${insertCols}) values (${insertValues})`
        ),
        ...insertRelations,
        ...(opts.beforeTransactionCommit?.(formState) ?? []),
        commitTransaction(),
        ...(opts.afterTransactionCommit?.(formState) ?? []),
      ];
      const onSubmit: EventHandler = {
        procedure: [
          if_(formState.submitting, [exit()]),
          ...formState.resetErrorState,
          ...formState.setTouchedAll,
          ...checkFields,
          ...checkTables,
          ...(opts.beforeSubmitClient?.(formState) ?? []),
          if_(formState.hasAnyError, [exit()]),
          formState.setSubmitting(`true`),
          commitUiChanges(),
          try_<ClientProcStatement>({
            body: [
              serviceProc(
                opts.beforeTransactionStart
                  ? [
                      ...opts.beforeTransactionStart(formState),
                      if_(
                        `not ` + formState.hasAnyError,
                        serviceProcStatements
                      ),
                    ]
                  : serviceProcStatements
              ),
            ],
            errorName: `err`,
            catch: [
              debugExpr(`err.type`),
              debugExpr(`err.message`),
              debugExpr(`err.description`),
              if_(
                `err.type = 'unique_violation'`,
                [
                  formState.setFormError(
                    `'Cannot add duplicate ' || ${stringLiteral(
                      table.displayName.toLowerCase()
                    )}`
                  ),
                ],
                [formState.setFormError("'Unable to submit form'")]
              ),
              formState.setSubmitting(`false`),
              exit(),
            ],
          }),
          ...(opts.afterSubmitClient?.(formState) ?? []),
          formState.setSubmitting(`false`),
        ],
      };
      return opts.children({ formState, onSubmit });
    },
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
  { error, value, setError }: FormStateFieldHelper
) {
  const statements: ClientProcStatement[] = [];
  if (field.checks) {
    for (const check of field.checks) {
      statements.push(
        if_(
          `${error} is null and not (${check.check(value)})`,
          setError(check.errorMessage(value))
        )
      );
    }
  }
  switch (field.type) {
    case "String":
      if (field.notNull) {
        statements.push(
          if_(`${value} is null or trim(${value}) = ''`, setError(`'Required'`))
        );
      }
      if (field.minLength) {
        statements.push(
          if_(
            `${error} is null and ${value} is not null and trim(${value}) != '' and char_length(${value}) < ${field.minLength}`,
            setError(`'Expected at least ${field.minLength} charcters'`)
          )
        );
      }
      statements.push(
        if_(
          `${error} is null and ${value} is not null and char_length(${value}) > ${field.maxLength}`,
          setError(`'Expected at most ${field.maxLength} characters'`)
        )
      );
      break;
    case "ForeignKey":
      if (field.notNull) {
        statements.push(if_(`${value} is null`, setError(`'Required'`)));
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
        statements.push(
          if_(`${value} is null or trim(${value}) = ''`, setError(`'Required'`))
        );
      }
      statements.push(
        block([
          scalar(`as_bigint`, `try_cast(${value} as bigint)`),
          if_(
            `${error} is null and ${value} is not null and trim(${value}) != '' and as_bigint is null`,
            setError(`'Not a valid number'`)
          ),
          if_(
            `${error} is null and ${value} is not null and trim(${value}) != '' and as_bigint is not null and as_bigint < ${min}`,
            setError(`'Must be at least ${min}'`)
          ),
          if_(
            `${error} is null and ${value} is not null and trim(${value}) != '' and as_bigint is not null and as_bigint > ${max}`,
            setError(`'Must be at most ${min}'`)
          ),
        ])
      );
    }
    case "Real":
      if (field.notNull) {
        statements.push(
          if_(`${value} is null or trim(${value}) = ''`, setError(`'Required'`))
        );
      }
      statements.push(
        if_(
          `${error} is null and ${value} is not null and trim(${value}) != '' and try_cast(${value} as real) is null`,
          setError(`'Not a valid number'`)
        )
      );
      break;
    case "Double":
      if (field.notNull) {
        statements.push(
          if_(`${value} is null or trim(${value}) = ''`, setError(`'Required'`))
        );
      }
      statements.push(
        if_(
          `${error} is null and ${value} is not null and trim(${value}) != '' and try_cast(${value} as double) is null`,
          setError(`'Not a valid number'`)
        )
      );
      break;
    case "Decimal": {
      if (field.notNull) {
        statements.push(
          if_(`${value} is null or trim(${value}) = ''`, setError(`'Required'`))
        );
      }
      // eventually I should improve the error message here
      statements.push(
        block([
          scalar(
            `as_decimal`,
            `try_cast(${value} as decimal(${field.precision}, ${field.scale}))`
          ),
          if_(
            `${error} is null and ${value} is not null and trim(${value}) != '' and as_decimal is null`,
            setError(`'Not a valid decimal'`)
          ),
        ])
      );
      break;
    }
    case "Uuid":
      if (field.notNull) {
        statements.push(
          if_(`${value} is null or trim(${value}) = ''`, setError(`'Required'`))
        );
      }
      statements.push(
        if_(
          `${error} is null and ${value} is not null and trim(${value}) != '' and try_cast(${value} as uuid) is null`,
          setError(`'Invalid UUID'`)
        )
      );
      break;
    case "Tx":
      if (field.notNull) {
        statements.push(
          if_(`${value} is null or trim(${value}) = ''`, setError(`'Required'`))
        );
      }
      statements.push(
        if_(
          `${error} is null and ${value} is not null and trim(${value}) != '' and try_cast(${value} as bigint) is null`,
          setError(`'Tx id must be a number'`)
        )
      );
      break;
  }
  return statements;
}

function getUpdateFormStateValueFromReocrdValue(
  field: Field,
  value: SqlExpression
): SqlExpression {
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

interface UpdateFormState {
  formState: FormState;
  onSubmit: EventHandler;
}

export interface UpdateFormField {
  field: string;
  initialValue?: string;
}

export interface WithUpdateFormStateOpts extends FormStateProcedureExtensions {
  table: string;
  fields: UpdateFormField[];
  relations?: {
    sharedFields?: UpdateFormField[];
    fields: UpdateFormField[];
    withValues?: [string, string][];
  }[];

  initialRecord?: string;
  recordId?: string;

  children: (state: UpdateFormState) => Node;
}

export function withUpdateFormState(opts: WithUpdateFormStateOpts) {
  const table = app.database.tables[opts.table];
  const fields = opts.fields.map((f) => {
    const fieldSchema = table.fields[f.field];
    let initialValue: string;
    if (f.initialValue) {
      initialValue = f.initialValue;
    } else if (opts.initialRecord) {
      initialValue = getUpdateFormStateValueFromReocrdValue(
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
  return withFormState({
    fields: fields.map((f) => ({
      initialValue: f.initialValue,
      name: f.field.name,
      type: formFieldType(f.field),
    })),
    children: (formState) => {
      const setValues = fields
        .map((f) => {
          const value = getNormalizedValue(
            f.field,
            formState.fields.get(f.field.name)
          );
          return `${f.field.name} = ${value}`;
        })
        .join(" , ");
      const checkFields = fields
        .map((f) => {
          return defaultValidate(f.field, formState.fieldHelper(f.field.name));
        })
        .flat();
      const checkTables = table.checks.map((check) => {
        const fieldExprs = check.fields.map((f) => {
          if (fields.some((field) => field.field.name === f)) {
            return getNormalizedValue(table.fields[f], formState.fields.get(f));
          }
          if (!opts.initialRecord) {
            throw new Error(
              "Update form on table with checks but not supplying an `initialRecord`"
            );
          }
          return getNormalizedValue(
            table.fields[f],
            opts.initialRecord + "." + f
          );
        });
        return if_(`not (` + check.check(fieldExprs) + `)`, [
          formState.setFormError(check.errorMessage(fieldExprs)),
        ]);
      });
      let recordId = opts.recordId;
      if (!recordId) {
        if (opts.initialRecord) {
          recordId = opts.initialRecord + `.id`;
        } else {
          throw new Error(
            "You must specify either recordId or initialRecord for an update form"
          );
        }
      }
      const serviceProcStatements = [
        startTransaction(),
        ...(opts.afterTransactionStart?.(formState) ?? []),
        modify(
          `update db.${table.name} set ${setValues} where id = ${recordId}`
        ),
        ...(opts.beforeTransactionCommit?.(formState) ?? []),
        commitTransaction(),
        ...(opts.afterTransactionCommit?.(formState) ?? []),
      ];
      const onSubmit: EventHandler = {
        procedure: [
          ...formState.resetErrorState,
          ...formState.setTouchedAll,
          ...checkFields,
          ...checkTables,
          if_(formState.hasAnyError, [exit()]),
          formState.setSubmitting(`true`),
          commitUiChanges(),
          try_<ClientProcStatement>({
            body: [
              serviceProc(
                opts.beforeTransactionStart
                  ? [
                      ...opts.beforeTransactionStart(formState),
                      if_(
                        `not ` + formState.hasAnyError,
                        serviceProcStatements
                      ),
                    ]
                  : serviceProcStatements
              ),
            ],
            errorName: `err`,
            catch: [
              debugExpr(`err.type`),
              debugExpr(`err.message`),
              debugExpr(`err.description`),
              formState.setFormError("'Unable to submit form'"),
              formState.setSubmitting(`false`),
              exit(),
            ],
          }),
          ...formState.debugFormState(),
          formState.setSubmitting(`false`),
          ...(opts.afterSubmitClient?.(formState) ?? []),
        ],
      };
      return opts.children({ formState, onSubmit });
    },
  });
}
