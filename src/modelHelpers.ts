import type {
  BoolEnumLikeConfig,
  Check,
  CustomTableControl,
  Database,
  DecimalUsage,
  DecisionTable,
  DecisionTableOutput,
  DurationField,
  DurationSize,
  Enum,
  EnumValue,
  Field,
  FieldBase,
  FieldCheck,
  FieldGroup,
  Names,
  NumericFields,
  Page,
  Parameter,
  RecordDisplayName,
  ScalarFunction,
  ScriptDbDefinition,
  Table,
  TableControl,
  VirtualField,
  VirtualType,
} from "./modelTypes.js";
import type { BoostConfig, HelperName } from "./config.js";
import type * as yom from "./yom.js";
import { config, model } from "./singleton.js";
import { stringLiteral } from "./utils/sqlHelpers.js";
import type { Node } from "./nodeTypes.js";
import { getTableBaseUrl } from "./utils/url.js";
import {
  applyFieldGroupCatalog,
  FieldGroupCatalog,
} from "./fieldGroupCatalog.js";

export class TableBuilder {
  #fields: BaseFieldBuilder[] = [];
  #fieldGroups: Record<string, FieldGroup> = {};
  #virtualFields: Record<string, VirtualField> = {};
  #uniques: yom.UniqueConstraint[] = [];
  #checks: Check[] = [];
  #description?: string;
  #searchConfig: yom.RankedSearchTable | undefined;
  #renameFrom?: string;
  #recordDisplayName?: RecordDisplayName;
  #createDefaultNameMatch = false;
  #getHrefToRecord?: (id: string) => string;
  #formControl?: TableControl;

  constructor(private name: Names) {}

  renameFrom(name: string) {
    this.#renameFrom = name;
  }

  bool(name: HelperName) {
    return new BoolFieldBuilder(name, this);
  }

  ordering(name: HelperName) {
    return new OrderingFieldBuilder(name, this);
  }

  date(name: HelperName) {
    return new DateFieldBuilder(name, this);
  }

  time(name: HelperName) {
    return new TimeFieldBuilder(name, this);
  }

  timestamp(name: HelperName) {
    return new TimestampFieldBuilder(name, this);
  }

  tx(name: HelperName) {
    return new TxFieldBuilder(name, this);
  }

  tinyInt(name: HelperName) {
    return new TinyIntFieldBuilder(name, this);
  }

  smallInt(name: HelperName) {
    return new SmallIntFieldBuilder(name, this);
  }

  int(name: HelperName) {
    return new IntFieldBuilder(name, this);
  }

  bigInt(name: HelperName) {
    return new BigIntFieldBuilder(name, this);
  }

  tinyUint(name: HelperName) {
    return new TinyUintFieldBuilder(name, this);
  }

  smallUint(name: HelperName) {
    return new SmallUintFieldBuilder(name, this);
  }

  uint(name: HelperName) {
    return new UintFieldBuilder(name, this);
  }

  bigUint(name: HelperName) {
    return new BigUintFieldBuilder(name, this);
  }

  real(name: HelperName) {
    return new RealFieldBuilder(name, this);
  }

  double(name: HelperName) {
    return new DoubleFieldBuilder(name, this);
  }

  uuid(name: HelperName) {
    return new UuidFieldBuilder(name, this);
  }

  money(
    name: HelperName,
    opts: {
      precision: number;
      scale: number;
      signed?: boolean;
    }
  ) {
    return new DecimalFieldBuilder(
      name,
      this,
      opts.precision,
      opts.scale,
      opts.signed ?? false,
      { type: "Money", currency: "USD" }
    );
  }

  percentage(
    name: HelperName,
    opts: {
      precision: number;
      scale: number;
      signed?: boolean;
    }
  ) {
    return new DecimalFieldBuilder(
      name,
      this,
      opts.precision,
      opts.scale,
      opts.signed ?? false,
      { type: "Percentage" }
    );
  }

  decimal(
    name: HelperName,
    opts: {
      precision: number;
      scale: number;
      signed?: boolean;
    }
  ) {
    return new DecimalFieldBuilder(
      name,
      this,
      opts.precision,
      opts.scale,
      opts.signed ?? true,
      undefined
    );
  }

  string(name: HelperName, maxLength: number) {
    return new StringFieldBuilder(name, maxLength, this);
  }

  secondsDuration(name: HelperName, backing: yom.FieldIntegerTypes) {
    return new DurationFieldBuilder(name, this, backing, "seconds");
  }

  minutesDuration(name: HelperName, backing: yom.FieldIntegerTypes) {
    return new DurationFieldBuilder(name, this, backing, "minutes");
  }

  hoursDuration(name: HelperName, backing: yom.FieldIntegerTypes) {
    return new DurationFieldBuilder(name, this, backing, "hours");
  }

  // email(name: HelperName) {
  //   throw new Error("todo");
  //   // return new FieldBuilder(name, { type: "Email" }, this);
  // }

  fk(name: HelperName, table?: string) {
    return new ForeignKeyFieldBuilder(
      name,
      this,
      table ?? (typeof name === "string" ? name : name.name)
    );
  }

  enum(name: HelperName, enumName?: string) {
    return new EnumFieldBuilder(
      name,
      this,
      enumName ?? (typeof name === "string" ? name : name.name)
    );
  }

  unique(
    constraint: yom.UniqueConstraintField[] | yom.UniqueConstraint
  ): TableBuilder {
    if (Array.isArray(constraint)) {
      this.#uniques.push({ fields: constraint });
    } else {
      this.#uniques.push(constraint);
    }
    return this;
  }

  addField(field: BaseFieldBuilder): TableBuilder {
    this.#fields.push(field);
    return this;
  }

  fieldGroup(name: string, group: FieldGroup) {
    this.#fieldGroups[name] = group;
    return this;
  }

  fieldGroupFromCatalog(
    catalog: FieldGroupCatalog | ((table: TableBuilder) => void)
  ) {
    if (typeof catalog === "function") {
      catalog(this);
    } else {
      applyFieldGroupCatalog(catalog, this);
    }
    return this;
  }

  check(check: Check): TableBuilder {
    this.#checks.push(check);
    return this;
  }

  virtualField(virtual: VirtualFieldHelper): TableBuilder {
    const name = config.createNameObject(virtual.name);
    this.#virtualFields[name.name] = {
      name,
      fields: virtual.fields,
      expr: virtual.expr,
      type:
        typeof virtual.type === "string"
          ? { type: virtual.type }
          : virtual.type,
    };
    return this;
  }

  createDefaultNameMatch(): TableBuilder {
    this.#createDefaultNameMatch = true;
    return this;
  }

  description(s: string) {
    this.#description = s;
    return this;
  }

  recordDisplayName(fields: string[], expr?: (...fields: string[]) => string) {
    if (fields.length !== 1 && !expr) {
      throw new Error(
        "Please make sure to specify an expression for setRecordDisplayName"
      );
    }
    this.#recordDisplayName = {
      fields,
      expr: expr ?? ((name: string) => name),
    };
    return this;
  }

  searchConfig(config: Omit<yom.RankedSearchTable, "table">) {
    this.#searchConfig = { table: this.name.name, ...config };
    return this;
  }

  linkable(f?: (id: string) => string) {
    this.#getHrefToRecord =
      f ??
      ((id) =>
        `'/' || ${stringLiteral(
          getTableBaseUrl(this.name.name)
        )} || '/' || ${id}`);
    return this;
  }

  setFormControl(type: CustomTableControl | "Select" | "Combobox") {
    if (type === "Select" || type === "Combobox") {
      this.#formControl = { type };
    } else {
      this.#formControl = { type: "Custom", f: type };
    }
    return this;
  }

  finish(): Table {
    const fields: { [s: string]: Field } = {};
    for (const f of this.#fields) {
      const field = f.finish();
      fields[field.name.name] = field;
    }
    let recordDisplayName = this.#recordDisplayName;
    if (fields.first_name && fields.last_name) {
      if (fields.first_name.notNull && fields.last_name.notNull) {
        recordDisplayName = {
          fields: ["first_name", "last_name"],
          expr: (firstName, lastName) => `${firstName} || ' ' || ${lastName}`,
        };
      } else if (fields.first_name.notNull) {
        recordDisplayName = {
          fields: ["first_name", "last_name"],
          expr: (firstName, lastName) =>
            `case when ${lastName} is null then ${firstName} else ${firstName} || ' ' || ${lastName} end`,
        };
      } else if (fields.last_name.notNull) {
        recordDisplayName = {
          fields: ["first_name", "last_name"],
          expr: (firstName, lastName) =>
            `case when ${firstName} is null then ${lastName} else ${firstName} || ' ' || ${lastName} end`,
        };
      } else {
        recordDisplayName = {
          fields: ["first_name", "last_name"],
          expr: (firstName, lastName) =>
            `case
            when ${firstName} is null then ${lastName}
            when ${lastName} is null then ${firstName}
            else ${firstName} || ' ' || ${lastName} end`,
        };
      }
    } else if (fields.name) {
      recordDisplayName = { fields: ["name"], expr: (name) => name };
    } else if (!recordDisplayName) {
      recordDisplayName = {
        fields: [],
        expr: () => {
          throw new Error(
            `recordDisplayName not provided for table ${this.name.name}`
          );
        },
      };
    }
    const tableName = this.name.name;
    if (this.#createDefaultNameMatch) {
      if (fields.first_name && fields.last_name) {
        addSearchMatch({
          name: tableName + "_name",
          table: tableName,
          tokenizer: config.defaultTokenizer,
          style: {
            ...config.defaultFuzzyConfig,
            type: "Fuzzy",
          },
          fieldGroups: [
            {
              fields: [`first_name`, `last_name`],
            },
          ],
        });
      } else if (fields.name) {
        addSearchMatch({
          name: tableName + "_name",
          table: tableName,
          tokenizer: config.defaultTokenizer,
          style: {
            ...config.defaultFuzzyConfig,
            type: "Fuzzy",
          },
          fields: [`name`],
        });
      } else {
        throw new Error(
          "createDefaultNameMatch assumes either a `name` field or a `first_name` and `last_name`"
        );
      }
    }
    let searchConfig = this.#searchConfig;
    if (!this.#searchConfig) {
      if (fields.first_name && fields.last_name) {
        searchConfig = {
          table: tableName,
          fieldGroups: [{ priority: 1, fields: ["first_name", "last_name"] }],
        };
      } else if (fields.name) {
        searchConfig = {
          table: tableName,
          fields: [{ priority: 1, field: "name" }],
        };
      }
    }
    return {
      name: this.name,
      renameFrom: this.#renameFrom,
      checks: this.#checks,
      fields,
      virtualFields: this.#virtualFields,
      fieldGroups: this.#fieldGroups,
      uniqueConstraints: this.#uniques,
      recordDisplayName,
      description: this.#description,
      searchConfig,
      getHrefToRecord: this.#getHrefToRecord,
      control: this.#formControl,
      ext: {},
    };
  }
}

export interface VirtualFieldHelper {
  name: HelperName;
  fields: string[];
  expr: (...fields: string[]) => string;
  type: VirtualType | yom.SimpleScalarTypes;
}

abstract class BaseFieldBuilder {
  protected _notNull = false;
  protected _renameFrom?: string;
  protected _description?: string;
  protected _unique = false;
  protected _name: Names;
  protected _checks: FieldCheck[] = [];
  protected _indexed?: boolean;
  protected _default?: string;
  protected _group?: string;

  constructor(name: HelperName, protected table: TableBuilder) {
    this._name = config.createNameObject(name);
    table.addField(this);
  }

  renameFrom(name: string) {
    this._renameFrom = name;
    return this;
  }

  notNull() {
    this._notNull = true;
    return this;
  }

  indexed() {
    this._indexed = true;
    return this;
  }

  group(group: string) {
    this._group = group;
    return this;
  }

  default(value: string) {
    this._default = value;
    return this;
  }

  unique() {
    this.table.unique([this._name.name]);
    this._unique = true;
    return this;
  }

  check(
    check: (field: string) => string,
    errorMessage: (field: string) => string
  ) {
    this._checks.push({ check, errorMessage });
  }

  description(s: string) {
    this._description = s;
    return this;
  }

  finishBase() {
    return {
      name: this._name,
      renameFrom: this._renameFrom,
      notNull: this._notNull ?? false,
      checks: [],
      description: this._description,
      unique: this._unique,
      default: this._default,
      group: this._group,
      ext: {},
    };
  }

  abstract finish(): Field;
}

abstract class BaseNumericBuilder extends BaseFieldBuilder {
  #max?: string;
  #min?: string;
  #displayText?: (num: string) => string;

  constructor(name: HelperName, table: TableBuilder) {
    super(name, table);
  }

  max(n: string) {
    this.#max = n;
    return this;
  }

  min(n: string) {
    this.#min = n;
    return this;
  }

  displayText(f: (num: string) => string) {
    this.#displayText = f;
    return this;
  }

  finishNumericBase() {
    return {
      min: this.#min,
      max: this.#max,
      displayText: this.#displayText,
      ...this.finishBase(),
    };
  }
}

interface SimpleNumericFieldBuilder {
  new (name: HelperName, table: TableBuilder): BaseNumericBuilder;
}

function createSimpleNumericBuilder(
  type: Exclude<NumericFields["type"], "Decimal">
): SimpleNumericFieldBuilder {
  return class extends BaseNumericBuilder {
    finish(): Field {
      return { type, ...this.finishNumericBase() };
    }
  };
}

const TinyUintFieldBuilder = createSimpleNumericBuilder("TinyUint");
const TinyIntFieldBuilder = createSimpleNumericBuilder("TinyInt");
const SmallUintFieldBuilder = createSimpleNumericBuilder("SmallUint");
const SmallIntFieldBuilder = createSimpleNumericBuilder("SmallInt");
const UintFieldBuilder = createSimpleNumericBuilder("Uint");
const IntFieldBuilder = createSimpleNumericBuilder("Int");
const BigUintFieldBuilder = createSimpleNumericBuilder("BigUint");
const BigIntFieldBuilder = createSimpleNumericBuilder("BigInt");

const RealFieldBuilder = createSimpleNumericBuilder("Real");
const DoubleFieldBuilder = createSimpleNumericBuilder("Double");

class DecimalFieldBuilder extends BaseFieldBuilder {
  #precision: number;
  #scale: number;
  #signed: boolean;
  #usage?: DecimalUsage;

  constructor(
    name: HelperName,
    table: TableBuilder,
    precision: number,
    scale: number,
    signed: boolean,
    usage: DecimalUsage | undefined
  ) {
    super(name, table);
    this.#precision = precision;
    this.#scale = scale;
    this.#signed = signed;
    this.#usage = usage;
  }

  finish(): Field {
    return {
      type: "Decimal",
      precision: this.#precision,
      scale: this.#scale,
      signed: this.#signed,
      usage: this.#usage,
      ...this.finishBase(),
    };
  }
}

class DurationFieldBuilder extends BaseFieldBuilder {
  #backing: yom.FieldIntegerTypes;
  #size: DurationSize;

  constructor(
    name: HelperName,
    table: TableBuilder,
    backing: yom.FieldIntegerTypes,
    size: DurationSize
  ) {
    super(name, table);
    this.#backing = backing;
    this.#size = size;
  }

  finish(): DurationField {
    return {
      type: "Duration",
      backing: this.#backing,
      size: this.#size,
      ...this.finishBase(),
    };
  }
}

class UuidFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    return { type: "Uuid", ...this.finishBase() };
  }
}

class BoolFieldBuilder extends BaseFieldBuilder {
  #enumLike?: BoolEnumLikeConfig;

  enumLike(config: BoolEnumLikeConfig) {
    this.#enumLike = config;
    return this;
  }

  finish(): Field {
    return { type: "Bool", enumLike: this.#enumLike, ...this.finishBase() };
  }
}

class OrderingFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    return { type: "Ordering", ...this.finishBase() };
  }
}

class DateFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    return { type: "Date", ...this.finishBase() };
  }
}

class TimeFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    return { type: "Date", ...this.finishBase() };
  }
}

class TimestampFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    return { type: "Timestamp", ...this.finishBase() };
  }
}

class TxFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    return { type: "Tx", ...this.finishBase() };
  }
}

class StringFieldBuilder extends BaseFieldBuilder {
  #maxLength: number;
  #collation?: yom.Collation;
  #minLength?: number;
  #maxBytesPerChar?: number;
  #autoTrim?: yom.AutoTrim;
  #multiline?: boolean;

  constructor(name: HelperName, maxLength: number, table: TableBuilder) {
    super(name, table);
    this.#maxLength = maxLength;
  }

  collation(collation: yom.Collation) {
    this.#collation = collation;
    return this;
  }

  minLength(minLength: number) {
    this.#minLength = minLength;
    return this;
  }

  maxBytesPerChar(max: number) {
    this.#maxBytesPerChar = max;
    return this;
  }

  autoTrim(trim: yom.AutoTrim) {
    this.#autoTrim = trim;
    return this;
  }

  multiline() {
    this.#multiline = true;
    return this;
  }

  finish(): Field {
    return {
      type: "String",
      ...this.finishBase(),
      maxLength: this.#maxLength,
      minLength: this.#minLength,
      collation: this.#collation,
      maxBytesPerChar: this.#maxBytesPerChar,
      autoTrim: this.#autoTrim,
      multiline: this.#multiline,
    };
  }
}

class ForeignKeyFieldBuilder extends BaseFieldBuilder {
  #table: string;
  #onDelete: yom.OnDeleteBehavior = "Cascade";

  constructor(name: HelperName, table: TableBuilder, tableName: string) {
    super(name, table);
    this.#table = tableName;
  }

  onDelete(behavior: yom.OnDeleteBehavior) {
    this.#onDelete = behavior;
    return this;
  }

  finish(): Field {
    return {
      type: "ForeignKey",
      onDelete: this.#onDelete,
      table: this.#table,
      ...this.finishBase(),
    };
  }
}

class EnumFieldBuilder extends BaseFieldBuilder {
  #enum: string;

  constructor(name: HelperName, table: TableBuilder, enumName: string) {
    super(name, table);
    this.#enum = enumName;
  }

  finish(): Field {
    return {
      type: "Enum",
      enum: this.#enum,
      ...this.finishBase(),
    };
  }
}

export function addSearchMatch(index: yom.SearchMatchConfig) {
  model.database.searchMatches[index.name] = index;
}

let inScriptDb: ScriptDbDefinition | undefined;

export function addTable(name: HelperName, f: (table: TableBuilder) => void) {
  const nameObj = config.createNameObject(name);
  const builder = new TableBuilder(nameObj);
  f(builder);
  if (inScriptDb) {
    inScriptDb.tables[nameObj.name] = builder.finish();
  } else {
    model.database.tables[nameObj.name] = builder.finish();
  }
}

export function addDeviceDatabaseTable(
  name: HelperName,
  f: (table: TableBuilder) => void
) {
  const nameObj = config.createNameObject(name);
  const builder = new TableBuilder(nameObj);
  f(builder);
  model.deviceDb.tables[nameObj.name] = builder.finish();
}

export interface SimpleDt {
  name: string;
  outputType:
    | yom.ScalarType
    | "String"
    | yom.SimpleScalarTypes
    | yom.ScalarIntegerTypes;
  fields: [string, string][];
  default?: string;
}

export type BoolDt =
  | {
      name: string;
      trues: string[];
    }
  | {
      name: string;
      falses: string[];
    };

export interface HelperEnum {
  name: HelperName;
  renameFrom?: string;
  description?: string;
  values: (
    | string
    | (HelperName & { renameFrom?: string; description?: string })
  )[];
  withSimpleDts?: SimpleDt[];
  withBoolDts?: BoolDt[];
  withDisplayDt?: boolean;
}

export function addEnum(enum_: HelperEnum) {
  const enumName = config.createNameObject(enum_.name);
  const values = enum_.values.map((v) => {
    if (typeof v === "string") {
      return { name: config.createNameObject(v) };
    }
    const { description, renameFrom, ...rest } = v;
    return {
      name: config.createNameObject(rest),
      renameFrom,
      description,
    };
  });
  if (enum_.withDisplayDt) {
    enum_.withSimpleDts = enum_.withSimpleDts ?? [];
    enum_.withSimpleDts.push({
      name: "display_" + enumName.name,
      outputType: "String",
      fields: values.map((n) => [
        n.name.name,
        stringLiteral(n.name.displayName),
      ]),
    });
  }
  if (Array.isArray(enum_.withBoolDts)) {
    enum_.withSimpleDts = enum_.withSimpleDts ?? [];
    for (const e of enum_.withBoolDts) {
      enum_.withSimpleDts.push({
        name: e.name,
        outputType: "Bool",
        fields:
          "trues" in e
            ? e.trues.map((n) => [n, `true`] as [string, string])
            : e.falses.map((n) => [n, "false"] as [string, string]),
        default: "trues" in e ? `false` : `true`,
      });
    }
  }
  if (Array.isArray(enum_.withSimpleDts)) {
    for (const dt of enum_.withSimpleDts) {
      addDecisionTable({
        bound: false,
        name: dt.name,
        parameters: [
          {
            name: "value",
            type: { type: "Enum", enum: enumName.name },
          },
        ],
        output: { name: "output", type: dt.outputType },
        csv:
          `input.value,output\n` +
          dt.fields.map(([field, value]) => `'${field}',${value}`).join("\n") +
          (dt.default ? `\nany,` + dt.default : ``),
      });
    }
  }
  const valuesObject: Record<string, EnumValue> = {};
  for (const v of values) {
    valuesObject[v.name.name] = v;
  }
  const modelEnum: Enum = {
    name: enumName,
    renameFrom: enum_.renameFrom,
    description: enum_.description,
    values: valuesObject,
  };
  model.enums[enumName.name] = modelEnum;
  if (enum_.withDisplayDt) {
    modelEnum.getDisplayName = (v) => `dt.display_${enumName.name}(${v})`;
  }
}

interface HelperDecisionTableInput {
  name: HelperName;
  notNull?: boolean;
  collation?: yom.Collation;
  type: HelperFieldType;
}

interface HelperDecisionTableOutput {
  name: HelperName;
  collation?: yom.Collation;
  type:
    | yom.ScalarType
    | yom.SimpleScalarTypes
    | yom.ScalarIntegerTypes
    | "String";
}

interface HelperDecisionTable {
  bound: boolean;
  name: HelperName;
  description?: string;
  setup?: yom.BasicStatement[];
  parameters?: HelperDecisionTableInput[];
  outputs?: HelperDecisionTableOutput[];
  output?: HelperDecisionTableOutput;
  csv: string;
  [name: string]: any;
}

interface HelperScalarFunction {
  bound: boolean;
  name: HelperName;
  description?: string;
  parameters: HelperDecisionTableInput[];
  procedure: yom.BasicStatement[];
  returnType: yom.ScalarType | yom.SimpleScalarTypes | yom.ScalarIntegerTypes;
  [name: string]: any;
}

type HelperFieldType =
  | yom.FieldType
  | yom.FieldIntegerTypes
  | yom.SimpleScalarTypes;

function fieldTypeFromHelper(ty: HelperFieldType): yom.FieldType {
  return typeof ty == "string" ? { type: ty } : ty;
}

export function addDecisionTable(dt: HelperDecisionTable) {
  const tableName = config.createNameObject(dt.name);
  const inputs: { [name: string]: Parameter } = {};
  const outputs: { [name: string]: DecisionTableOutput } = {};
  if (dt.output) {
    const name = config.createNameObject(dt.output.name);
    outputs[name.name] = {
      name: name,
      type:
        typeof dt.output.type === "string"
          ? { type: dt.output.type }
          : dt.output.type,
      collation: dt.output.collation,
    };
  }
  if (dt.outputs) {
    for (const output of dt.outputs) {
      const name = config.createNameObject(output.name);
      outputs[name.name] = {
        name: name,
        type:
          typeof output.type === "string" ? { type: output.type } : output.type,
        collation: output.collation,
      };
    }
  }
  if (dt.parameters) {
    for (const input of dt.parameters) {
      const name = config.createNameObject(input.name);
      inputs[name.name] = {
        name: name,
        type: fieldTypeFromHelper(input.type),
        notNull: input.notNull,
      };
    }
  }
  const newDt: DecisionTable = {
    name: tableName,
    description: dt.description,
    csv: dt.csv,
    outputs,
    inputs,
    setup: dt.setup,
  };
  if (dt.bound) {
    model.database.decisionTables[tableName.name] = newDt;
  } else {
    model.decisionTables[tableName.name] = newDt;
  }
}

export function addScalarFunction(f: HelperScalarFunction) {
  const tableName = config.createNameObject(f.name);
  const inputs: { [name: string]: Parameter } = {};
  for (const input of f.parameters) {
    const name = config.createNameObject(input.name);
    inputs[name.name] = {
      name: name,
      type: typeof input.type === "string" ? { type: input.type } : input.type,
      notNull: input.notNull,
    };
  }
  const newDt: ScalarFunction = {
    name: tableName,
    description: f.description,
    inputs,
    procedure: f.procedure,
    returnType:
      typeof f.returnType === "string" ? { type: f.returnType } : f.returnType,
  };
  if (f.bound) {
    model.database.scalarFunctions[tableName.name] = newDt;
  } else {
    model.scalarFunctions[tableName.name] = newDt;
  }
}

export function addPage(page: Page) {
  model.pages.push(page);
}

export function setShell(node: (pages: Node) => Node) {
  model.shell = node;
}

export function addScript(script: yom.Script) {
  model.scripts.push(script);
}

export function addScriptDbFromMappingFile(name: string, mappingFile: string) {
  model.scriptDbs.push({
    name,
    definition: {
      type: "MappingFile",
      file: mappingFile,
    },
  });
}

export function addScriptDbDefinition(
  name: string,
  define: (db: ScriptDbDefinition) => void
) {
  inScriptDb = {
    autoTrim: model.autoTrim,
    collation: model.collation,
    enableTransactionQueries: true,
    tables: {},
  };
  define(inScriptDb);
  model.scriptDbs.push({
    name,
    definition: { type: "Model", db: inScriptDb },
  });
  inScriptDb = undefined;
}

export const DEFAULT_DEV_USER_UUID = "147d4c57-947b-426f-9d81-fac3d9db5d31";
