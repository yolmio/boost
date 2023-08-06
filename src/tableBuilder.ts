import * as yom from "./yom";
import {
  app,
  Table,
  Check,
  FieldGroup,
  VirtualField,
  TableControl,
  RecordDisplayName,
  DurationSize,
  CustomTableControl,
  Field,
  FieldCheck,
  IntegerUsage,
  NumericFields,
  TinyUintField,
  TinyIntField,
  SmallUintField,
  SmallIntField,
  UintField,
  IntField,
  BigUintField,
  BigIntField,
  RealField,
  DoubleField,
  DecimalUsage,
  DecimalField,
  UuidField,
  BoolEnumLikeConfig,
  BoolField,
  OrderingField,
  DateField,
  TimeField,
  TimestampField,
  TxField,
  StringUsage,
  StringField,
  ForeignKeyField,
  EnumField,
  VirtualType,
  IntegerField,
} from "./app";

const RECORD_DISPLAY_NAME_FIELD_GROUPS = [["first_name", "last_name"]];
const RECORD_DISPLAY_NAME_FIELDS = ["name", "title"];

export class TableBuilder {
  #fields: BaseFieldBuilder[] = [];
  #fieldGroups: Record<string, FieldGroup> = {};
  #virtualFields: Record<string, VirtualField> = {};
  #uniques: yom.UniqueConstraint[] = [];
  #checks: Check[] = [];
  #description?: string;
  #searchConfig: yom.RankedSearchTable | undefined;
  #renameFrom?: string;
  #recordDisplayNameFields?: string[];
  #recordDisplayName?: RecordDisplayName;
  #createDefaultNameMatch = false;
  #getHrefToRecord?: (id: string) => string;
  #linkable = false;
  #formControl?: TableControl;
  #displayName: string;
  #primaryKeyFieldName?: string;

  constructor(private name: string) {
    this.#displayName = app.displayNameConfig.table(name);
  }

  displayName(name: string) {
    this.#displayName = name;
    return this;
  }

  renameFrom(name: string) {
    this.#renameFrom = name;
    return this;
  }

  bool(name: string) {
    return new BoolFieldBuilder(name, this);
  }

  ordering(name: string) {
    return new OrderingFieldBuilder(name, this);
  }

  date(name: string) {
    return new DateFieldBuilder(name, this);
  }

  time(name: string) {
    return new TimeFieldBuilder(name, this);
  }

  timestamp(name: string) {
    return new TimestampFieldBuilder(name, this);
  }

  tx(name: string) {
    return new TxFieldBuilder(name, this);
  }

  tinyInt(name: string) {
    return new TinyIntFieldBuilder(name, this);
  }

  smallInt(name: string) {
    return new SmallIntFieldBuilder(name, this);
  }

  int(name: string) {
    return new IntFieldBuilder(name, this);
  }

  bigInt(name: string) {
    return new BigIntFieldBuilder(name, this);
  }

  tinyUint(name: string) {
    return new TinyUintFieldBuilder(name, this);
  }

  smallUint(name: string) {
    return new SmallUintFieldBuilder(name, this);
  }

  uint(name: string) {
    return new UintFieldBuilder(name, this);
  }

  bigUint(name: string) {
    return new BigUintFieldBuilder(name, this);
  }

  real(name: string) {
    return new RealFieldBuilder(name, this);
  }

  double(name: string) {
    return new DoubleFieldBuilder(name, this);
  }

  uuid(name: string) {
    return new UuidFieldBuilder(name, this);
  }

  money(
    name: string,
    opts?:
      | {
          precision: number;
          scale: number;
          signed?: boolean;
        }
      | yom.FieldIntegerTypes
  ) {
    const usage = { type: "Money", currency: "USD" } as const;
    if (typeof opts === "string") {
      switch (opts) {
        case "TinyUint":
          return new TinyUintFieldBuilder(name, this, usage);
        case "SmallUint":
          return new SmallUintFieldBuilder(name, this, usage);
        case "Uint":
          return new UintFieldBuilder(name, this, usage);
        case "BigUint":
          return new BigUintFieldBuilder(name, this, usage);
        case "TinyInt":
          return new TinyIntFieldBuilder(name, this, usage);
        case "SmallInt":
          return new SmallIntFieldBuilder(name, this, usage);
        case "Int":
          return new IntFieldBuilder(name, this, usage);
        case "BigInt":
          return new BigIntFieldBuilder(name, this, usage);
      }
    }
    const normalizedOpts = opts ?? { precision: 13, scale: 2, signed: true };
    return new DecimalFieldBuilder(
      name,
      this,
      normalizedOpts.precision,
      normalizedOpts.scale,
      normalizedOpts.signed ?? false,
      usage
    );
  }

  percentage(
    name: string,
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
    name: string,
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

  string(name: string, maxLength: number) {
    return new StringFieldBuilder(name, maxLength, this);
  }

  #duration = (
    name: string,
    size: DurationSize,
    backing: yom.FieldIntegerTypes
  ) => {
    const usage = { type: "Duration", size } as const;
    switch (backing) {
      case "TinyUint":
        return new TinyUintFieldBuilder(name, this, usage);
      case "SmallUint":
        return new SmallUintFieldBuilder(name, this, usage);
      case "Uint":
        return new UintFieldBuilder(name, this, usage);
      case "BigUint":
        return new BigUintFieldBuilder(name, this, usage);
      case "TinyInt":
        return new TinyIntFieldBuilder(name, this, usage);
      case "SmallInt":
        return new SmallIntFieldBuilder(name, this, usage);
      case "Int":
        return new IntFieldBuilder(name, this, usage);
      case "BigInt":
        return new BigIntFieldBuilder(name, this, usage);
    }
  };

  secondsDuration(name: string, backing: yom.FieldIntegerTypes) {
    return this.#duration(name, "seconds", backing);
  }

  minutesDuration(name: string, backing: yom.FieldIntegerTypes) {
    addMinuteDurationFns();
    return this.#duration(name, "minutes", backing);
  }

  hoursDuration(name: string, backing: yom.FieldIntegerTypes) {
    return this.#duration(name, "hours", backing);
  }

  email(name: string) {
    return new StringFieldBuilder(name, 254, this, { type: "Email" });
  }

  phoneNumber(name: string) {
    return new StringFieldBuilder(name, 50, this, { type: "PhoneNumber" });
  }

  fk(name: string, table?: string) {
    return new ForeignKeyFieldBuilder(name, this, table ?? name);
  }

  enum(name: string, enumName?: string) {
    return new EnumFieldBuilder(name, this, enumName ?? name);
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

  //   fieldGroupFromCatalog(
  //     catalog: FieldGroupCatalog | ((table: TableBuilder) => void)
  //   ) {
  //     if (typeof catalog === "function") {
  //       catalog(this);
  //     } else {
  //       applyFieldGroupCatalog(catalog, this);
  //     }
  //     return this;
  //   }

  check(check: Check): TableBuilder {
    this.#checks.push(check);
    return this;
  }

  virtualField(virtual: VirtualFieldHelper): TableBuilder {
    this.#virtualFields[virtual.name] = {
      name: virtual.name,
      displayName: app.displayNameConfig.virtual(virtual.name),
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

  recordDisplayNameFields(fields: string[]) {
    this.#recordDisplayNameFields = fields;
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

  primaryKeyFieldName(name: string) {
    this.#primaryKeyFieldName = name;
    return this;
  }

  searchConfig(config: Omit<yom.RankedSearchTable, "table">) {
    this.#searchConfig = { table: this.name, ...config };
    return this;
  }

  linkable(f?: (id: string) => string) {
    this.#linkable = true;
    this.#getHrefToRecord = f;
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
      fields[field.name] = field;
    }
    let displayNameFields = this.#recordDisplayNameFields;
    for (const fieldNames of RECORD_DISPLAY_NAME_FIELD_GROUPS) {
      if (fieldNames.every((f) => fields[f])) {
        displayNameFields = fieldNames;
        break;
      }
    }
    if (!displayNameFields) {
      for (const fieldName of RECORD_DISPLAY_NAME_FIELDS) {
        if (fields[fieldName]) {
          displayNameFields = [fieldName];
          break;
        }
      }
    }
    let recordDisplayName = this.#recordDisplayName;
    if (!recordDisplayName && displayNameFields) {
      if (displayNameFields.length === 1) {
        recordDisplayName = {
          fields: displayNameFields,
          expr: (name) => name,
        };
      } else if (displayNameFields.length === 2) {
        const [firstField, secondField] = displayNameFields;
        if (fields[firstField].notNull && fields[secondField].notNull) {
          recordDisplayName = {
            fields: displayNameFields,
            expr: (first, second) => `${first} || ' ' || ${second}`,
          };
        } else if (fields[firstField].notNull && !fields[secondField].notNull) {
          recordDisplayName = {
            fields: displayNameFields,
            expr: (first, second) =>
              `case when ${second} is null then ${first} else ${first} || ' ' || ${second} end`,
          };
        } else if (!fields[firstField].notNull && fields[secondField].notNull) {
          recordDisplayName = {
            fields: displayNameFields,
            expr: (first, second) =>
              `case when ${first} is null then ${second} else ${first} || ' ' || ${second} end`,
          };
        } else {
          recordDisplayName = {
            fields: displayNameFields,
            expr: (first, second) =>
              `case
            when ${first} is null then ${second}
            when ${second} is null then ${first}
            else ${first} || ' ' || ${second} end`,
          };
        }
      } else {
        throw new Error(
          "recordDisplayNameFields only supports a length 1 or 2"
        );
      }
    }
    const tableName = this.name;
    if (this.#createDefaultNameMatch) {
      if (!displayNameFields) {
        throw new Error(
          "createDefaultNameMatch assumes recordDisplayNameFields"
        );
      }
      const name = tableName + "_name";
      app.db.searchMatches[name] = {
        name: tableName + "_name",
        table: tableName,
        tokenizer: app.searchConfig.defaultTokenizer,
        style: {
          ...app.searchConfig.defaultFuzzyConfig,
          type: "Fuzzy",
        },
        fieldGroups:
          displayNameFields.length > 1
            ? [{ fields: displayNameFields }]
            : undefined,
        fields: displayNameFields.length === 1 ? displayNameFields : undefined,
      };
    }
    let searchConfig = this.#searchConfig;
    if (!this.#searchConfig) {
      if (displayNameFields?.length === 1) {
        searchConfig = {
          table: tableName,
          fields: [{ priority: 1, field: displayNameFields[0] }],
        };
      } else if (displayNameFields && displayNameFields?.length > 1) {
        searchConfig = {
          table: tableName,
          fieldGroups: [{ priority: 1, fields: displayNameFields }],
        };
      }
    }
    const table = new Table(
      this.#primaryKeyFieldName ?? "id",
      this.name,
      this.#displayName
    );
    table.renameFrom = this.#renameFrom;
    table.checks = this.#checks;
    table.fields = fields;
    table.virtualFields = this.#virtualFields;
    table.fieldGroups = this.#fieldGroups;
    table.uniqueConstraints = this.#uniques;
    table.recordDisplayName = recordDisplayName;
    table.description = this.#description;
    table.searchConfig = searchConfig;
    table.customGetHrefToRecord = this.#getHrefToRecord;
    table.linkable = this.#linkable;
    table.control = this.#formControl;
    return table;
  }
}

function addMinuteDurationFns() {
  app.addScalarFunction({
    name: `parse_minutes_duration`,
    parameters: [
      {
        name: "value",
        type: { type: "String", maxLength: 65_000 },
      },
    ],
    returnType: { type: "BigInt" },
    procedure: (s) =>
      s.try({
        body: (s) =>
          s
            .scalar(`total`, { type: "BigInt" })
            .createQueryCursor(
              `split`,
              `select value from string.split(input.value, ':') order by ordinal desc`
            )
            .advanceCursor(`split`)
            .setScalar(`total`, `cast(split.value as bigint)`)
            .forEachCursor(`split`, (s) =>
              s.setScalar(`total`, `total + cast(split.value as bigint) * 60`)
            )
            .if(`input.value like '-%'`, (s) =>
              s.setScalar(`total`, `total * -1`)
            )
            .returnExpr(`total`),
        catch: (s) => s.exit(),
      }),
  });
  app.addScalarFunction({
    name: `display_minutes_duration`,
    parameters: [{ name: "value", type: { type: "BigInt" } }],
    returnType: { type: "String" },
    procedure: (s) =>
      s.returnExpr(`case when input.value < 0 then '-' else '' end ||
    abs(round(input.value / 60)) ||
    ':' ||
    lpad(abs(round(input.value % 60)), 2, 0)`),
  });
}

export interface VirtualFieldHelper {
  name: string;
  displayName?: string;
  fields: string[];
  expr: (...fields: string[]) => string;
  type: VirtualType | yom.SimpleScalarTypes;
}

abstract class BaseFieldBuilder {
  protected _notNull = false;
  protected _renameFrom?: string;
  protected _description?: string;
  protected _unique = false;
  protected _name: string;
  protected _displayName: string;
  protected _checks: FieldCheck[] = [];
  protected _indexed?: boolean;
  protected _default?: string;
  protected _group?: string;

  constructor(name: string, protected table: TableBuilder) {
    this._name = name;
    this._displayName = app.displayNameConfig.field(name);
    table.addField(this);
  }

  displayName(name: string) {
    this._displayName = name;
    return this;
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
    this.table.unique([this._name]);
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

  writeBaseFields(field: Field) {
    field.renameFrom = this._renameFrom;
    field.notNull = this._notNull ?? false;
    field.checks = this._checks;
    field.description = this._description;
    field.unique = this._unique;
    field.default = this._default;
    field.group = this._group;
    field.indexed = this._indexed ?? false;
  }

  abstract finish(): Field;
}

abstract class BaseNumericBuilder extends BaseFieldBuilder {
  #max?: string;
  #min?: string;

  constructor(name: string, table: TableBuilder) {
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

  writeBaseFields(field: NumericFields) {
    super.writeBaseFields(field);
    field.min = this.#min;
    field.max = this.#max;
  }
}

abstract class BaseIntegerBuilder extends BaseNumericBuilder {
  #usage?: IntegerUsage;

  constructor(name: string, table: TableBuilder, usage?: IntegerUsage) {
    super(name, table);
    this.#usage = usage;
  }

  writeBaseFields(field: IntegerField) {
    super.writeBaseFields(field);
    field.usage = this.#usage;
  }
}

interface IntegerFieldBuilder {
  new (
    name: string,
    table: TableBuilder,
    usage?: IntegerUsage
  ): BaseNumericBuilder;
}

function createIntegerBuilder(
  constructor: new (name: string, displayName: string) => IntegerField
): IntegerFieldBuilder {
  return class extends BaseIntegerBuilder {
    finish(): Field {
      const field = new constructor(this._name, this._displayName);
      this.writeBaseFields(field);
      return field;
    }
  };
}

const TinyUintFieldBuilder = createIntegerBuilder(TinyUintField);
const TinyIntFieldBuilder = createIntegerBuilder(TinyIntField);
const SmallUintFieldBuilder = createIntegerBuilder(SmallUintField);
const SmallIntFieldBuilder = createIntegerBuilder(SmallIntField);
const UintFieldBuilder = createIntegerBuilder(UintField);
const IntFieldBuilder = createIntegerBuilder(IntField);
const BigUintFieldBuilder = createIntegerBuilder(BigUintField);
const BigIntFieldBuilder = createIntegerBuilder(BigIntField);

class RealFieldBuilder extends BaseNumericBuilder {
  finish(): Field {
    const field = new RealField(this._name, this._displayName);
    this.writeBaseFields(field);
    return field;
  }
}
class DoubleFieldBuilder extends BaseNumericBuilder {
  finish(): Field {
    const field = new DoubleField(this._name, this._displayName);
    this.writeBaseFields(field);
    return field;
  }
}

class DecimalFieldBuilder extends BaseNumericBuilder {
  #precision: number;
  #scale: number;
  #signed: boolean;
  #usage?: DecimalUsage;

  constructor(
    name: string,
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
    const field = new DecimalField(
      this._name,
      this._displayName,
      this.#precision,
      this.#scale,
      this.#signed
    );
    this.writeBaseFields(field);
    field.usage = this.#usage;
    return field;
  }
}

class UuidFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    const field = new UuidField(this._name, this._displayName);
    this.writeBaseFields(field);
    return field;
  }
}

class BoolFieldBuilder extends BaseFieldBuilder {
  #enumLike?: BoolEnumLikeConfig;

  enumLike(config: BoolEnumLikeConfig) {
    this.#enumLike = config;
    return this;
  }

  finish(): Field {
    const field = new BoolField(this._name, this._displayName);
    this.writeBaseFields(field);
    field.enumLike = this.#enumLike;
    return field;
  }
}

class OrderingFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    const field = new OrderingField(this._name, this._displayName);
    this.writeBaseFields(field);
    return field;
  }
}

class DateFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    const field = new DateField(this._name, this._displayName);
    this.writeBaseFields(field);
    return field;
  }
}

class TimeFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    const field = new TimeField(this._name, this._displayName);
    this.writeBaseFields(field);
    return field;
  }
}

class TimestampFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    const field = new TimestampField(this._name, this._displayName);
    this.writeBaseFields(field);
    return field;
  }
}

class TxFieldBuilder extends BaseFieldBuilder {
  finish(): Field {
    const field = new TxField(this._name, this._displayName);
    this.writeBaseFields(field);
    return field;
  }
}

class StringFieldBuilder extends BaseFieldBuilder {
  #maxLength: number;
  #collation?: yom.Collation;
  #minLength?: number;
  #maxBytesPerChar?: number;
  #autoTrim?: yom.AutoTrim;
  #multiline?: boolean;
  #usage?: StringUsage;

  constructor(
    name: string,
    maxLength: number,
    table: TableBuilder,
    usage?: StringUsage
  ) {
    super(name, table);
    this.#maxLength = maxLength;
    this.#usage = usage;
  }

  maxLength(maxLength: number) {
    this.#maxLength = maxLength;
    return this;
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
    const field = new StringField(
      this._name,
      this._displayName,
      this.#maxLength
    );
    this.writeBaseFields(field);
    field.usage = this.#usage;
    field.minLength = this.#minLength;
    field.collation = this.#collation;
    field.maxBytesPerChar = this.#maxBytesPerChar;
    field.autoTrim = this.#autoTrim;
    field.multiline = this.#multiline;
    return field;
  }
}

class ForeignKeyFieldBuilder extends BaseFieldBuilder {
  #table: string;
  #onDelete: yom.OnDeleteBehavior = "Cascade";

  constructor(name: string, table: TableBuilder, tableName: string) {
    super(name, table);
    this.#table = tableName;
  }

  onDelete(behavior: yom.OnDeleteBehavior) {
    this.#onDelete = behavior;
    return this;
  }

  finish(): Field {
    const field = new ForeignKeyField(
      this._name,
      this._displayName,
      this.#table,
      this.#onDelete
    );
    this.writeBaseFields(field);
    return field;
  }
}

class EnumFieldBuilder extends BaseFieldBuilder {
  #enum: string;

  constructor(name: string, table: TableBuilder, enumName: string) {
    super(name, table);
    this.#enum = enumName;
  }

  finish(): Field {
    const field = new EnumField(this._name, this._displayName, this.#enum);
    this.writeBaseFields(field);
    return field;
  }
}
