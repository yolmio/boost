import type { Field, Table } from "./modelTypes";
import type {
  BaseStatement,
  BasicStatement,
  ClientProcStatement,
  EventHandler,
  FieldType,
  ForEachTableStatement,
  ProcTableField,
  ServiceProcStatement,
  StateStatement,
} from "./yom.js";
import {
  advanceCursor,
  commitTransaction,
  commitUiChanges,
  createQueryCursor,
  debugExpr,
  debugQuery,
  delay,
  exit,
  forEachCursor,
  forEachTable,
  if_,
  modify,
  record,
  returnExpr,
  scalar,
  serviceProc,
  setScalar,
  startTransaction,
  table,
  try_,
} from "./procHelpers.js";
import { model } from "./singleton.js";
import { EachNode, Node, StateNode } from "./nodeTypes.js";
import { addScalarFunction } from "./modelHelpers.js";
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
  switch (field.type) {
    case "String":
      return `case when trim(${valueExpr}) != '' then ${valueExpr} else null end`;
    case "TinyInt":
    case "TinyUint":
    case "SmallInt":
      return `case when trim(${valueExpr}) != '' then cast(${valueExpr} as smallint) else null end`;
    case "SmallUint":
    case "Int":
      return `case when trim(${valueExpr}) != '' then cast(${valueExpr} as int) else null end`;
    case "Decimal":
      return `case when trim(${valueExpr}) != '' then cast(${valueExpr} as decimal(${field.precision}, ${field.scale})) else null end`;
    case "Duration": {
      switch (field.size) {
        case "minutes":
          addMinuteDurationFns();
          return `sfn.parse_minutes_duration(${valueExpr})`;
      }
    }

    default:
      return valueExpr;
  }
}

function addMinuteDurationFns() {
  addScalarFunction({
    name: `parse_minutes_duration`,
    bound: false,
    parameters: [
      {
        name: "value",
        type: { type: "String", maxLength: 65_000 },
      },
    ],
    returnType: { type: "BigInt" },
    procedure: [
      try_({
        body: [
          scalar(`total`, { type: "BigInt" }),
          createQueryCursor(
            `split`,
            `select value from string.split(input.value, ':') order by ordinal desc`
          ),
          advanceCursor(`split`),
          setScalar(`total`, `cast(split.value as bigint)`),
          forEachCursor(`split`, `value`, [
            setScalar(`total`, `total + cast(split.value as bigint) * 60`),
          ]),
          if_(`input.value like '-%'`, [setScalar(`total`, `total * -1`)]),
          returnExpr(`total`),
        ],
      }),
    ],
  });
  addScalarFunction({
    name: `display_minutes_duration`,
    bound: false,
    parameters: [{ name: "value", type: { type: "BigInt" } }],
    returnType: { type: "String" },
    procedure: [
      returnExpr(`case when input.value < 0 then '-' else '' end ||
    abs(round(input.value / 60)) ||
    ':' ||
    lpad(abs(round(input.value % 60)), 2, 0)`),
    ],
  });
}

export function formFieldType(field: Field): FieldType {
  if (field.type === "ForeignKey") {
    return { type: "BigUint" };
  }
  // in the ui procs, we don't want to error on going over max length so we can provide better error messages
  if (
    field.type === "String" ||
    field.type === "TinyUint" ||
    field.type === "TinyInt" ||
    field.type === "Decimal" ||
    field.type === "SmallInt" ||
    field.type === "SmallUint" ||
    field.type === "Int" ||
    field.type === "Uint" ||
    field.type === "Duration"
  ) {
    return { type: "String", maxLength: 65_000 };
  }
  if (field.type === "Enum") {
    return { type: "Enum", enum: field.enum };
  }
  if (field.type === "Bool") {
    return { type: "Bool" };
  }
  if (field.type === "Date") {
    return { type: "Date" };
  }
  throw new Error("Todo handle field: " + field.type);
  // return ty;
}

interface InsertFormState {
  formState: FormState;
  onSubmit: EventHandler;
}

export interface InsertFormField {
  field: string;
  initialValue?: string;
}

export interface WithMultiInsertFormOpts {
  defaultInitialValue?: (field: Field) => string;
  defaultPrepare?: (field: Field, value: string) => string;
  // defaultValidate?: (
  //   field: Field,
  //   props: FormValidateProps,
  // ) => ClientProcStatement[];

  table: string;
  fields: InsertFormField[];
  sharedFields?: InsertFormField[];

  sharedStaticValues?: [string, string][];

  initializeFormState?: (state: FormState) => BasicStatement[];
  children: (state: InsertFormState) => Node;

  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
  afterSubmitService?: (state: FormState) => ServiceProcStatement[];
}

export function withMultiInsertFormState(
  opts: WithMultiInsertFormOpts
): StateNode {
  const table = model.database.tables[opts.table];
  const fields = opts.fields.map((f) => {
    const fieldSchema = table.fields[f.field];
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
            if (opts.sharedStaticValues) {
              const value = opts.sharedStaticValues.find(([n]) => n === f);
              if (value) {
                return value[1];
              }
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
              serviceProc([
                startTransaction(),
                formState.iterTable(table.name, (cursor) => {
                  const insertFields = [
                    ...sharedFields.map((f) => f.field.name),
                    ...fields.map((f) => f.field.name),
                    ...(opts.sharedStaticValues
                      ? opts.sharedStaticValues.map(([col]) => col)
                      : []),
                  ].join(",");
                  const insertValues = [
                    ...sharedFields.map((f) =>
                      getNormalizedValue(
                        f.field,
                        formState.fields.get(f.field.name)
                      )
                    ),
                    ...fields.map((f) =>
                      getNormalizedValue(
                        f.field,
                        cursor.field(f.field.name).value
                      )
                    ),
                    ...(opts.sharedStaticValues
                      ? opts.sharedStaticValues.map(([, val]) => val)
                      : []),
                  ].join(",");
                  return modify(
                    `insert into db.${table.name} (${insertFields}) values (${insertValues})`
                  );
                }),
                commitTransaction(),
                ...(opts.afterSubmitService?.(formState) ?? []),
              ]),
            ],
            catch: [
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

export interface WithInsertFormStateOpts extends BaseInsertFormStateOpts {
  table: string;
  fields: InsertFormField[];
  relations?: InsertFormRelation[];
  children: (state: InsertFormState) => Node;
}

export interface BaseInsertFormStateOpts {
  defaultInitialValue?: (field: Field) => string;
  defaultPrepare?: (field: Field, value: string) => string;
  // defaultValidate?: (
  //   field: Field,
  //   props: FormValidateProps,
  // ) => ClientProcStatement[];

  withValues?: Record<string, string>;
  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
  afterSubmitService?: (state: FormState) => ServiceProcStatement[];
  beforeSubmitClient?: (state: FormState) => ClientProcStatement[];
  beforeTransaction?: (state: FormState) => ServiceProcStatement[];
  /** Runs before the insert */
  serviceCheck?: (state: FormState) => ServiceProcStatement[];
  /** Like afterSubmitService, but runs as part of the same transaction as the insert */
  postInsert?: (state: FormState) => ServiceProcStatement[];
  resetAfterSubmit?: boolean;
}

export function withInsertFormState(opts: WithInsertFormStateOpts): StateNode {
  const table = model.database.tables[opts.table];
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
        fieldConfig.initialValue ??
        opts.defaultInitialValue?.(fieldModel) ??
        defaultInitialValue(fieldModel),
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
    fields: ComputedField[];
    formFields: FormStateField[];
    foreignKeyField: string;
  }[] = [];
  if (opts.relations) {
    for (const relation of opts.relations) {
      const relationTable = model.database.tables[relation.table];
      const sharedFields: ComputedField[] = [];
      if (relation.sharedFields) {
        for (const fieldConfig of relation.sharedFields) {
          const fieldModel = relationTable.fields[fieldConfig.field];
          const formStateName = fieldModel.name;
          formFields.push({
            initialValue:
              fieldConfig.initialValue ??
              opts.defaultInitialValue?.(fieldModel) ??
              defaultInitialValue(fieldModel),
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
            fieldConfig.initialValue ??
            opts.defaultInitialValue?.(fieldModel) ??
            defaultInitialValue(fieldModel),
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
              ...(opts.withValues ? Object.keys(opts.withValues) : []),
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
              ...(opts.withValues ? Object.values(opts.withValues) : []),
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
        ...(opts.beforeTransaction?.(formState) ?? []),
        startTransaction(),
        modify(
          `insert into db.${table.name} (${insertCols}) values (${insertValues})`
        ),
        ...insertRelations,
        ...(opts.postInsert?.(formState) ?? []),
        commitTransaction(),
        ...(opts.afterSubmitService?.(formState) ?? []),
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
                opts.serviceCheck
                  ? [
                      ...opts.serviceCheck(formState),
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

export function defaultInitialValue(field: Field) {
  switch (field.type) {
    case "String":
      return `''`;
    case "Bool":
      return field.notNull ? `false` : `null`;
    case "TinyUint":
    case "Decimal":
      return `''`;
    case "Enum":
      if (field.notNull) {
        const enum_ = model.enums[field.enum];
        const firstValue = Object.values(enum_.values)[0];
        return `cast(${stringLiteral(firstValue.name)} as enums.${enum_.name})`;
      }
      return `null`;
    default:
      // if (field.notNull) {
      //   throw new Error("todo");
      // }
      return `null`;
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
    case "Duration":
      if (field.notNull) {
        statements.push(
          if_(`${value} is null or trim(${value}) = ''`, setError(`'Required'`))
        );
      }
      break;
    // case "Email":
    //   if (field.notNull) {
    //     statements.push(
    //       if_(
    //         `${value} is null or trim(${value}) = ''`,
    //         setError(`'Required'`),
    //       ),
    //     );
    //   }
    //   statements.push(
    //     if_(
    //       `${error} is null and ${value} is not null and trim(${value}) != '' and not regex.is_match(${value}, ${sqlEmailRegex})`,
    //       setError(`'Expected a valid email'`),
    //     ),
    //   );
    //   statements.push(
    //     if_(
    //       `${error} is null and ${value} is not null and char_length(${value}) > 254`,
    //       setError(`'Expected at most 254 characters'`),
    //     ),
    //   );
    //   break;
    case "Bool":
      break;
  }
  return statements;
}

interface UpdateFormState {
  formState: FormState;
  onSubmit: EventHandler;
}

export interface UpdateFormField {
  field: string;
  initialValue?: string;
}

export interface WithUpdateFormStateOpts {
  table: string;
  fields: UpdateFormField[];
  relations?: {
    sharedFields?: UpdateFormField[];
    fields: UpdateFormField[];
    withValues?: [string, string][];
  }[];

  initialRecord?: string;
  recordId?: string;

  afterSubmitClient?: (state: FormState) => ClientProcStatement[];
  afterSubmitService?: (state: FormState) => ServiceProcStatement[];

  children: (state: UpdateFormState) => Node;
}

export function withUpdateFormState(opts: WithUpdateFormStateOpts) {
  const table = model.database.tables[opts.table];
  const fields = opts.fields.map((f) => {
    const fieldSchema = table.fields[f.field];
    let initialValue: string;
    if (f.initialValue) {
      initialValue = f.initialValue;
    } else if (opts.initialRecord) {
      initialValue = `${opts.initialRecord}.${f.field}`;
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
              serviceProc([
                startTransaction(),
                modify(
                  `update db.${table.name} set ${setValues} where id = ${recordId}`
                ),
                commitTransaction(),
                ...(opts.afterSubmitService?.(formState) ?? []),
              ]),
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
