// import type {
//   BoolEnumLikeConfig,
//   Check,
//   CustomTableControl,
//   Database,
//   DecimalUsage,
//   DecisionTable,
//   DecisionTableOutput,
//   DurationSize,
//   Enum,
//   EnumValue,
//   Field,
//   FieldBase,
//   FieldCheck,
//   FieldGroup,
//   IntegerUsage,
//   NumericFields,
//   Page,
//   Parameter,
//   RecordDisplayName,
//   ScalarFunction,
//   ScriptDbDefinition,
//   StringUsage,
//   Table,
//   TableControl,
//   VirtualField,
//   VirtualType,
// } from "./appTypes";
// import type * as yom from "./yom";
// import { app } from "./singleton";
// import { stringLiteral } from "./utils/sqlHelpers";
// import type { Node } from "./nodeTypes";
// import { getTableBaseUrl } from "./utils/url";
// import {
//   applyFieldGroupCatalog,
//   FieldGroupCatalog,
// } from "./catalog/fieldGroup";
// import { applyTableCatalog, TableCatalog } from "./catalog/table";
// import {
//   advanceCursor,
//   createQueryCursor,
//   exit,
//   forEachCursor,
//   if_,
//   returnExpr,
//   scalar,
//   setScalar,
//   try_,
// } from "./procHelpers";

// const RECORD_DISPLAY_NAME_FIELD_GROUPS = [["first_name", "last_name"]];
// const RECORD_DISPLAY_NAME_FIELDS = ["name", "title"];

// export class TableBuilder {
//   #fields: BaseFieldBuilder[] = [];
//   #fieldGroups: Record<string, FieldGroup> = {};
//   #virtualFields: Record<string, VirtualField> = {};
//   #uniques: yom.UniqueConstraint[] = [];
//   #checks: Check[] = [];
//   #description?: string;
//   #searchConfig: yom.RankedSearchTable | undefined;
//   #renameFrom?: string;
//   #recordDisplayNameFields?: string[];
//   #recordDisplayName?: RecordDisplayName;
//   #createDefaultNameMatch = false;
//   #getHrefToRecord?: (id: string) => string;
//   #formControl?: TableControl;
//   #displayName: string;
//   #primaryKeyFieldName?: string;

//   constructor(private name: string) {
//     this.#displayName = app.displayNameConfig.table(name);
//   }

//   displayName(name: string) {
//     this.#displayName = name;
//     return this;
//   }

//   renameFrom(name: string) {
//     this.#renameFrom = name;
//     return this;
//   }

//   bool(name: string) {
//     return new BoolFieldBuilder(name, this);
//   }

//   ordering(name: string) {
//     return new OrderingFieldBuilder(name, this);
//   }

//   date(name: string) {
//     return new DateFieldBuilder(name, this);
//   }

//   time(name: string) {
//     return new TimeFieldBuilder(name, this);
//   }

//   timestamp(name: string) {
//     return new TimestampFieldBuilder(name, this);
//   }

//   tx(name: string) {
//     return new TxFieldBuilder(name, this);
//   }

//   tinyInt(name: string) {
//     return new TinyIntFieldBuilder(name, this);
//   }

//   smallInt(name: string) {
//     return new SmallIntFieldBuilder(name, this);
//   }

//   int(name: string) {
//     return new IntFieldBuilder(name, this);
//   }

//   bigInt(name: string) {
//     return new BigIntFieldBuilder(name, this);
//   }

//   tinyUint(name: string) {
//     return new TinyUintFieldBuilder(name, this);
//   }

//   smallUint(name: string) {
//     return new SmallUintFieldBuilder(name, this);
//   }

//   uint(name: string) {
//     return new UintFieldBuilder(name, this);
//   }

//   bigUint(name: string) {
//     return new BigUintFieldBuilder(name, this);
//   }

//   real(name: string) {
//     return new RealFieldBuilder(name, this);
//   }

//   double(name: string) {
//     return new DoubleFieldBuilder(name, this);
//   }

//   uuid(name: string) {
//     return new UuidFieldBuilder(name, this);
//   }

//   money(
//     name: string,
//     opts?:
//       | {
//           precision: number;
//           scale: number;
//           signed?: boolean;
//         }
//       | yom.FieldIntegerTypes
//   ) {
//     const usage = { type: "Money", currency: "USD" } as const;
//     if (typeof opts === "string") {
//       switch (opts) {
//         case "TinyUint":
//           return new TinyUintFieldBuilder(name, this, usage);
//         case "SmallUint":
//           return new SmallUintFieldBuilder(name, this, usage);
//         case "Uint":
//           return new UintFieldBuilder(name, this, usage);
//         case "BigUint":
//           return new BigUintFieldBuilder(name, this, usage);
//         case "TinyInt":
//           return new TinyIntFieldBuilder(name, this, usage);
//         case "SmallInt":
//           return new SmallIntFieldBuilder(name, this, usage);
//         case "Int":
//           return new IntFieldBuilder(name, this, usage);
//         case "BigInt":
//           return new BigIntFieldBuilder(name, this, usage);
//       }
//     }
//     const normalizedOpts = opts ?? { precision: 13, scale: 2, signed: true };
//     return new DecimalFieldBuilder(
//       name,
//       this,
//       normalizedOpts.precision,
//       normalizedOpts.scale,
//       normalizedOpts.signed ?? false,
//       usage
//     );
//   }

//   percentage(
//     name: string,
//     opts: {
//       precision: number;
//       scale: number;
//       signed?: boolean;
//     }
//   ) {
//     return new DecimalFieldBuilder(
//       name,
//       this,
//       opts.precision,
//       opts.scale,
//       opts.signed ?? false,
//       { type: "Percentage" }
//     );
//   }

//   decimal(
//     name: string,
//     opts: {
//       precision: number;
//       scale: number;
//       signed?: boolean;
//     }
//   ) {
//     return new DecimalFieldBuilder(
//       name,
//       this,
//       opts.precision,
//       opts.scale,
//       opts.signed ?? true,
//       undefined
//     );
//   }

//   string(name: string, maxLength: number) {
//     return new StringFieldBuilder(name, maxLength, this);
//   }

//   #duration = (
//     name: string,
//     size: DurationSize,
//     backing: yom.FieldIntegerTypes
//   ) => {
//     const usage = { type: "Duration", size } as const;
//     switch (backing) {
//       case "TinyUint":
//         return new TinyUintFieldBuilder(name, this, usage);
//       case "SmallUint":
//         return new SmallUintFieldBuilder(name, this, usage);
//       case "Uint":
//         return new UintFieldBuilder(name, this, usage);
//       case "BigUint":
//         return new BigUintFieldBuilder(name, this, usage);
//       case "TinyInt":
//         return new TinyIntFieldBuilder(name, this, usage);
//       case "SmallInt":
//         return new SmallIntFieldBuilder(name, this, usage);
//       case "Int":
//         return new IntFieldBuilder(name, this, usage);
//       case "BigInt":
//         return new BigIntFieldBuilder(name, this, usage);
//     }
//   };

//   secondsDuration(name: string, backing: yom.FieldIntegerTypes) {
//     return this.#duration(name, "seconds", backing);
//   }

//   minutesDuration(name: string, backing: yom.FieldIntegerTypes) {
//     addMinuteDurationFns();
//     return this.#duration(name, "minutes", backing);
//   }

//   hoursDuration(name: string, backing: yom.FieldIntegerTypes) {
//     return this.#duration(name, "hours", backing);
//   }

//   email(name: string) {
//     return new StringFieldBuilder(name, 254, this, { type: "Email" });
//   }

//   phoneNumber(name: string) {
//     return new StringFieldBuilder(name, 50, this, { type: "PhoneNumber" });
//   }

//   fk(name: string, table?: string) {
//     return new ForeignKeyFieldBuilder(name, this, table ?? name);
//   }

//   enum(name: string, enumName?: string) {
//     return new EnumFieldBuilder(name, this, enumName ?? name);
//   }

//   unique(
//     constraint: yom.UniqueConstraintField[] | yom.UniqueConstraint
//   ): TableBuilder {
//     if (Array.isArray(constraint)) {
//       this.#uniques.push({ fields: constraint });
//     } else {
//       this.#uniques.push(constraint);
//     }
//     return this;
//   }

//   addField(field: BaseFieldBuilder): TableBuilder {
//     this.#fields.push(field);
//     return this;
//   }

//   fieldGroup(name: string, group: FieldGroup) {
//     this.#fieldGroups[name] = group;
//     return this;
//   }

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

//   check(check: Check): TableBuilder {
//     this.#checks.push(check);
//     return this;
//   }

//   virtualField(virtual: VirtualFieldHelper): TableBuilder {
//     this.#virtualFields[virtual.name] = {
//       name: virtual.name,
//       displayName: app.displayNameConfig.virtual(virtual.name),
//       fields: virtual.fields,
//       expr: virtual.expr,
//       type:
//         typeof virtual.type === "string"
//           ? { type: virtual.type }
//           : virtual.type,
//     };
//     return this;
//   }

//   createDefaultNameMatch(): TableBuilder {
//     this.#createDefaultNameMatch = true;
//     return this;
//   }

//   description(s: string) {
//     this.#description = s;
//     return this;
//   }

//   recordDisplayNameFields(fields: string[]) {
//     this.#recordDisplayNameFields = fields;
//     return this;
//   }

//   recordDisplayName(fields: string[], expr?: (...fields: string[]) => string) {
//     if (fields.length !== 1 && !expr) {
//       throw new Error(
//         "Please make sure to specify an expression for setRecordDisplayName"
//       );
//     }
//     this.#recordDisplayName = {
//       fields,
//       expr: expr ?? ((name: string) => name),
//     };
//     return this;
//   }

//   primaryKeyFieldName(name: string) {
//     this.#primaryKeyFieldName = name;
//     return this;
//   }

//   searchConfig(config: Omit<yom.RankedSearchTable, "table">) {
//     this.#searchConfig = { table: this.name, ...config };
//     return this;
//   }

//   linkable(f?: (id: string) => string) {
//     this.#getHrefToRecord =
//       f ??
//       ((id) =>
//         `'/' || ${stringLiteral(getTableBaseUrl(this.name))} || '/' || ${id}`);
//     return this;
//   }

//   setFormControl(type: CustomTableControl | "Select" | "Combobox") {
//     if (type === "Select" || type === "Combobox") {
//       this.#formControl = { type };
//     } else {
//       this.#formControl = { type: "Custom", f: type };
//     }
//     return this;
//   }

//   finish(): Table {
//     const fields: { [s: string]: Field } = {};
//     for (const f of this.#fields) {
//       const field = f.finish();
//       fields[field.name] = field;
//     }
//     let displayNameFields = this.#recordDisplayNameFields;
//     for (const fieldNames of RECORD_DISPLAY_NAME_FIELD_GROUPS) {
//       if (fieldNames.every((f) => fields[f])) {
//         displayNameFields = fieldNames;
//         break;
//       }
//     }
//     if (!displayNameFields) {
//       for (const fieldName of RECORD_DISPLAY_NAME_FIELDS) {
//         if (fields[fieldName]) {
//           displayNameFields = [fieldName];
//           break;
//         }
//       }
//     }
//     let recordDisplayName = this.#recordDisplayName;
//     if (!recordDisplayName && displayNameFields) {
//       if (displayNameFields.length === 1) {
//         recordDisplayName = {
//           fields: displayNameFields,
//           expr: (name) => name,
//         };
//       } else if (displayNameFields.length === 2) {
//         const [firstField, secondField] = displayNameFields;
//         if (fields[firstField].notNull && fields[secondField].notNull) {
//           recordDisplayName = {
//             fields: displayNameFields,
//             expr: (first, second) => `${first} || ' ' || ${second}`,
//           };
//         } else if (fields[firstField].notNull && !fields[secondField].notNull) {
//           recordDisplayName = {
//             fields: displayNameFields,
//             expr: (first, second) =>
//               `case when ${second} is null then ${first} else ${first} || ' ' || ${second} end`,
//           };
//         } else if (!fields[firstField].notNull && fields[secondField].notNull) {
//           recordDisplayName = {
//             fields: displayNameFields,
//             expr: (first, second) =>
//               `case when ${first} is null then ${second} else ${first} || ' ' || ${second} end`,
//           };
//         } else {
//           recordDisplayName = {
//             fields: displayNameFields,
//             expr: (first, second) =>
//               `case
//             when ${first} is null then ${second}
//             when ${second} is null then ${first}
//             else ${first} || ' ' || ${second} end`,
//           };
//         }
//       } else {
//         throw new Error(
//           "recordDisplayNameFields only supports a length 1 or 2"
//         );
//       }
//     }
//     const tableName = this.name;
//     if (this.#createDefaultNameMatch) {
//       if (!displayNameFields) {
//         throw new Error(
//           "createDefaultNameMatch assumes recordDisplayNameFields"
//         );
//       }
//       addSearchMatch({
//         name: tableName + "_name",
//         table: tableName,
//         tokenizer: app.searchConfig.defaultTokenizer,
//         style: {
//           ...app.searchConfig.defaultFuzzyConfig,
//           type: "Fuzzy",
//         },
//         fieldGroups:
//           displayNameFields.length > 1
//             ? [{ fields: displayNameFields }]
//             : undefined,
//         fields: displayNameFields.length === 1 ? displayNameFields : undefined,
//       });
//     }
//     let searchConfig = this.#searchConfig;
//     if (!this.#searchConfig) {
//       if (displayNameFields?.length === 1) {
//         searchConfig = {
//           table: tableName,
//           fields: [{ priority: 1, field: displayNameFields[0] }],
//         };
//       } else if (displayNameFields && displayNameFields?.length > 1) {
//         searchConfig = {
//           table: tableName,
//           fieldGroups: [{ priority: 1, fields: displayNameFields }],
//         };
//       }
//     }
//     return {
//       name: this.name,
//       displayName: this.#displayName,
//       renameFrom: this.#renameFrom,
//       checks: this.#checks,
//       fields,
//       virtualFields: this.#virtualFields,
//       fieldGroups: this.#fieldGroups,
//       uniqueConstraints: this.#uniques,
//       recordDisplayName,
//       description: this.#description,
//       searchConfig,
//       getHrefToRecord: this.#getHrefToRecord,
//       control: this.#formControl,
//       primaryKeyFieldName: this.#primaryKeyFieldName ?? "id",
//       ext: {},
//     };
//   }
// }

// function addMinuteDurationFns() {
//   addScalarFunction({
//     name: `parse_minutes_duration`,
//     bound: false,
//     parameters: [
//       {
//         name: "value",
//         type: { type: "String", maxLength: 65_000 },
//       },
//     ],
//     returnType: { type: "BigInt" },
//     procedure: [
//       try_<yom.BasicStatement>({
//         body: [
//           scalar(`total`, { type: "BigInt" }),
//           createQueryCursor(
//             `split`,
//             `select value from string.split(input.value, ':') order by ordinal desc`
//           ),
//           advanceCursor(`split`),
//           setScalar(`total`, `cast(split.value as bigint)`),
//           forEachCursor(`split`, `value`, [
//             setScalar(`total`, `total + cast(split.value as bigint) * 60`),
//           ]),
//           if_(`input.value like '-%'`, [setScalar(`total`, `total * -1`)]),
//           returnExpr(`total`),
//         ],
//         catch: [exit()],
//       }),
//     ],
//   });
//   addScalarFunction({
//     name: `display_minutes_duration`,
//     bound: false,
//     parameters: [{ name: "value", type: { type: "BigInt" } }],
//     returnType: { type: "String" },
//     procedure: [
//       returnExpr(`case when input.value < 0 then '-' else '' end ||
//     abs(round(input.value / 60)) ||
//     ':' ||
//     lpad(abs(round(input.value % 60)), 2, 0)`),
//     ],
//   });
// }

// export interface VirtualFieldHelper {
//   name: string;
//   displayName?: string;
//   fields: string[];
//   expr: (...fields: string[]) => string;
//   type: VirtualType | yom.SimpleScalarTypes;
// }

// abstract class BaseFieldBuilder {
//   protected _notNull = false;
//   protected _renameFrom?: string;
//   protected _description?: string;
//   protected _unique = false;
//   protected _name: string;
//   protected _displayName: string;
//   protected _checks: FieldCheck[] = [];
//   protected _indexed?: boolean;
//   protected _default?: string;
//   protected _group?: string;

//   constructor(name: string, protected table: TableBuilder) {
//     this._name = name;
//     this._displayName = app.displayNameConfig.field(name);
//     table.addField(this);
//   }

//   displayName(name: string) {
//     this._displayName = name;
//     return this;
//   }

//   renameFrom(name: string) {
//     this._renameFrom = name;
//     return this;
//   }

//   notNull() {
//     this._notNull = true;
//     return this;
//   }

//   indexed() {
//     this._indexed = true;
//     return this;
//   }

//   group(group: string) {
//     this._group = group;
//     return this;
//   }

//   default(value: string) {
//     this._default = value;
//     return this;
//   }

//   unique() {
//     this.table.unique([this._name]);
//     this._unique = true;
//     return this;
//   }

//   check(
//     check: (field: string) => string,
//     errorMessage: (field: string) => string
//   ) {
//     this._checks.push({ check, errorMessage });
//   }

//   description(s: string) {
//     this._description = s;
//     return this;
//   }

//   finishBase() {
//     return {
//       name: this._name,
//       displayName: this._displayName,
//       renameFrom: this._renameFrom,
//       notNull: this._notNull ?? false,
//       checks: this._checks,
//       description: this._description,
//       unique: this._unique,
//       default: this._default,
//       group: this._group,
//       indexed: this._indexed,
//       ext: {},
//     };
//   }

//   abstract finish(): Field;
// }

// abstract class BaseNumericBuilder extends BaseFieldBuilder {
//   #max?: string;
//   #min?: string;

//   constructor(name: string, table: TableBuilder) {
//     super(name, table);
//   }

//   max(n: string) {
//     this.#max = n;
//     return this;
//   }

//   min(n: string) {
//     this.#min = n;
//     return this;
//   }

//   finishNumericBase() {
//     return {
//       min: this.#min,
//       max: this.#max,
//       ...this.finishBase(),
//     };
//   }
// }

// abstract class BaseIntegerBuilder extends BaseNumericBuilder {
//   #usage?: IntegerUsage;

//   constructor(name: string, table: TableBuilder, usage?: IntegerUsage) {
//     super(name, table);
//     this.#usage = usage;
//   }

//   finishIntegerBase() {
//     return {
//       usage: this.#usage,
//       ...this.finishNumericBase(),
//     };
//   }
// }

// interface IntegerFieldBuilder {
//   new (
//     name: string,
//     table: TableBuilder,
//     usage?: IntegerUsage
//   ): BaseNumericBuilder;
// }

// function createIntegerBuilder(
//   type: Exclude<NumericFields["type"], "Decimal" | "Real" | "Double">
// ): IntegerFieldBuilder {
//   return class extends BaseIntegerBuilder {
//     finish(): Field {
//       return { type, ...this.finishIntegerBase() };
//     }
//   };
// }

// const TinyUintFieldBuilder = createIntegerBuilder("TinyUint");
// const TinyIntFieldBuilder = createIntegerBuilder("TinyInt");
// const SmallUintFieldBuilder = createIntegerBuilder("SmallUint");
// const SmallIntFieldBuilder = createIntegerBuilder("SmallInt");
// const UintFieldBuilder = createIntegerBuilder("Uint");
// const IntFieldBuilder = createIntegerBuilder("Int");
// const BigUintFieldBuilder = createIntegerBuilder("BigUint");
// const BigIntFieldBuilder = createIntegerBuilder("BigInt");

// class RealFieldBuilder extends BaseNumericBuilder {
//   finish(): Field {
//     return { type: "Real", ...this.finishNumericBase() };
//   }
// }
// class DoubleFieldBuilder extends BaseNumericBuilder {
//   finish(): Field {
//     return { type: "Double", ...this.finishNumericBase() };
//   }
// }

// class DecimalFieldBuilder extends BaseFieldBuilder {
//   #precision: number;
//   #scale: number;
//   #signed: boolean;
//   #usage?: DecimalUsage;

//   constructor(
//     name: string,
//     table: TableBuilder,
//     precision: number,
//     scale: number,
//     signed: boolean,
//     usage: DecimalUsage | undefined
//   ) {
//     super(name, table);
//     this.#precision = precision;
//     this.#scale = scale;
//     this.#signed = signed;
//     this.#usage = usage;
//   }

//   finish(): Field {
//     return {
//       type: "Decimal",
//       precision: this.#precision,
//       scale: this.#scale,
//       signed: this.#signed,
//       usage: this.#usage,
//       ...this.finishBase(),
//     };
//   }
// }

// class UuidFieldBuilder extends BaseFieldBuilder {
//   finish(): Field {
//     return { type: "Uuid", ...this.finishBase() };
//   }
// }

// class BoolFieldBuilder extends BaseFieldBuilder {
//   #enumLike?: BoolEnumLikeConfig;

//   enumLike(config: BoolEnumLikeConfig) {
//     this.#enumLike = config;
//     return this;
//   }

//   finish(): Field {
//     return { type: "Bool", enumLike: this.#enumLike, ...this.finishBase() };
//   }
// }

// class OrderingFieldBuilder extends BaseFieldBuilder {
//   finish(): Field {
//     return { type: "Ordering", ...this.finishBase() };
//   }
// }

// class DateFieldBuilder extends BaseFieldBuilder {
//   finish(): Field {
//     return { type: "Date", ...this.finishBase() };
//   }
// }

// class TimeFieldBuilder extends BaseFieldBuilder {
//   finish(): Field {
//     return { type: "Date", ...this.finishBase() };
//   }
// }

// class TimestampFieldBuilder extends BaseFieldBuilder {
//   finish(): Field {
//     return { type: "Timestamp", ...this.finishBase() };
//   }
// }

// class TxFieldBuilder extends BaseFieldBuilder {
//   finish(): Field {
//     return { type: "Tx", ...this.finishBase() };
//   }
// }

// class StringFieldBuilder extends BaseFieldBuilder {
//   #maxLength: number;
//   #collation?: yom.Collation;
//   #minLength?: number;
//   #maxBytesPerChar?: number;
//   #autoTrim?: yom.AutoTrim;
//   #multiline?: boolean;
//   #usage?: StringUsage;

//   constructor(
//     name: string,
//     maxLength: number,
//     table: TableBuilder,
//     usage?: StringUsage
//   ) {
//     super(name, table);
//     this.#maxLength = maxLength;
//     this.#usage = usage;
//   }

//   maxLength(maxLength: number) {
//     this.#maxLength = maxLength;
//     return this;
//   }

//   collation(collation: yom.Collation) {
//     this.#collation = collation;
//     return this;
//   }

//   minLength(minLength: number) {
//     this.#minLength = minLength;
//     return this;
//   }

//   maxBytesPerChar(max: number) {
//     this.#maxBytesPerChar = max;
//     return this;
//   }

//   autoTrim(trim: yom.AutoTrim) {
//     this.#autoTrim = trim;
//     return this;
//   }

//   multiline() {
//     this.#multiline = true;
//     return this;
//   }

//   finish(): Field {
//     return {
//       type: "String",
//       ...this.finishBase(),
//       usage: this.#usage,
//       maxLength: this.#maxLength,
//       minLength: this.#minLength,
//       collation: this.#collation,
//       maxBytesPerChar: this.#maxBytesPerChar,
//       autoTrim: this.#autoTrim,
//       multiline: this.#multiline,
//     };
//   }
// }

// class ForeignKeyFieldBuilder extends BaseFieldBuilder {
//   #table: string;
//   #onDelete: yom.OnDeleteBehavior = "Cascade";

//   constructor(name: string, table: TableBuilder, tableName: string) {
//     super(name, table);
//     this.#table = tableName;
//   }

//   onDelete(behavior: yom.OnDeleteBehavior) {
//     this.#onDelete = behavior;
//     return this;
//   }

//   finish(): Field {
//     return {
//       type: "ForeignKey",
//       onDelete: this.#onDelete,
//       table: this.#table,
//       ...this.finishBase(),
//     };
//   }
// }

// class EnumFieldBuilder extends BaseFieldBuilder {
//   #enum: string;

//   constructor(name: string, table: TableBuilder, enumName: string) {
//     super(name, table);
//     this.#enum = enumName;
//   }

//   finish(): Field {
//     return {
//       type: "Enum",
//       enum: this.#enum,
//       ...this.finishBase(),
//     };
//   }
// }

// export function addSearchMatch(index: yom.SearchMatchConfig) {
//   app.db.searchMatches[index.name] = index;
// }

// let inScriptDb: ScriptDbDefinition | undefined;

// export function addTable(name: string, f: (table: TableBuilder) => void) {
//   const builder = new TableBuilder(name);
//   f(builder);
//   if (inScriptDb) {
//     inScriptDb.tables[name] = builder.finish();
//   } else {
//     app.db.tables[name] = builder.finish();
//   }
// }

// export function addTableFromCatalog(catalog: TableCatalog | (() => void)) {
//   if (typeof catalog === "function") {
//     catalog();
//   } else {
//     applyTableCatalog(catalog);
//   }
// }

// export function addDeviceDatabaseTable(
//   name: string,
//   f: (table: TableBuilder) => void
// ) {
//   // const builder = new TableBuilder(name);
//   // f(builder);
//   // app.deviceDb.tables[name] = builder.finish();
// }

// export interface SimpleDt {
//   name: string;
//   outputType:
//     | yom.ScalarType
//     | "String"
//     | yom.SimpleScalarTypes
//     | yom.ScalarIntegerTypes;
//   fields: [string, string][];
//   default?: string;
// }

// export type BoolDt =
//   | {
//       name: string;
//       trues: string[];
//     }
//   | {
//       name: string;
//       falses: string[];
//     };

// export interface HelperEnum {
//   name: string;
//   displayName?: string;
//   renameFrom?: string;
//   description?: string;
//   values: (
//     | string
//     | {
//         name: string;
//         displayName?: string;
//         renameFrom?: string;
//         description?: string;
//       }
//   )[];
//   withSimpleDts?: SimpleDt[];
//   withBoolDts?: BoolDt[];
//   withDisplayDt?: boolean;
// }

// export function addEnum(enum_: HelperEnum) {
//   const displayName = app.displayNameConfig.enum(enum_.name);
//   const values = enum_.values.map((v) => {
//     if (typeof v === "string") {
//       return { name: v, displayName: app.displayNameConfig.enumValue(v) };
//     }
//     return {
//       displayName: app.displayNameConfig.enumValue(v.name),
//       ...v,
//     };
//   });
//   if (enum_.withDisplayDt) {
//     enum_.withSimpleDts = enum_.withSimpleDts ?? [];
//     enum_.withSimpleDts.push({
//       name: "display_" + enum_.name,
//       outputType: "String",
//       fields: values.map((n) => [n.name, stringLiteral(n.displayName)]),
//     });
//   }
//   if (Array.isArray(enum_.withBoolDts)) {
//     enum_.withSimpleDts = enum_.withSimpleDts ?? [];
//     for (const e of enum_.withBoolDts) {
//       enum_.withSimpleDts.push({
//         name: e.name,
//         outputType: "Bool",
//         fields:
//           "trues" in e
//             ? e.trues.map((n) => [n, `true`] as [string, string])
//             : e.falses.map((n) => [n, "false"] as [string, string]),
//         default: "trues" in e ? `false` : `true`,
//       });
//     }
//   }
//   if (Array.isArray(enum_.withSimpleDts)) {
//     for (const dt of enum_.withSimpleDts) {
//       addDecisionTable({
//         bound: false,
//         name: dt.name,
//         parameters: [
//           {
//             name: "value",
//             type: { type: "Enum", enum: enum_.name },
//           },
//         ],
//         output: { name: "output", type: dt.outputType },
//         csv:
//           `input.value,output\n` +
//           dt.fields.map(([field, value]) => `'${field}',${value}`).join("\n") +
//           (dt.default ? `\nany,` + dt.default : ``),
//       });
//     }
//   }
//   const valuesObject: Record<string, EnumValue> = {};
//   for (const v of values) {
//     valuesObject[v.name] = v;
//   }
//   const modelEnum: Enum = {
//     name: enum_.name,
//     displayName,
//     renameFrom: enum_.renameFrom,
//     description: enum_.description,
//     values: valuesObject,
//   };
//   app.enums[enum_.name] = modelEnum;
//   if (enum_.withDisplayDt) {
//     modelEnum.getDisplayName = (v) => `dt.display_${enum_.name}(${v})`;
//   }
// }

// interface HelperDecisionTableInput {
//   name: string;
//   notNull?: boolean;
//   collation?: yom.Collation;
//   type: HelperFieldType;
// }

// interface HelperDecisionTableOutput {
//   name: string;
//   collation?: yom.Collation;
//   type:
//     | yom.ScalarType
//     | yom.SimpleScalarTypes
//     | yom.ScalarIntegerTypes
//     | "String";
// }

// interface HelperDecisionTable {
//   bound: boolean;
//   name: string;
//   description?: string;
//   setup?: yom.BasicStatement[];
//   parameters?: HelperDecisionTableInput[];
//   outputs?: HelperDecisionTableOutput[];
//   output?: HelperDecisionTableOutput;
//   csv: string;
//   [name: string]: any;
// }

// interface HelperScalarFunction {
//   bound: boolean;
//   name: string;
//   description?: string;
//   parameters: HelperDecisionTableInput[];
//   procedure: yom.BasicStatement[];
//   returnType: yom.ScalarType | yom.SimpleScalarTypes | yom.ScalarIntegerTypes;
//   [name: string]: any;
// }

// type HelperFieldType =
//   | yom.FieldType
//   | yom.FieldIntegerTypes
//   | yom.SimpleScalarTypes;

// function fieldTypeFromHelper(ty: HelperFieldType): yom.FieldType {
//   return typeof ty == "string" ? { type: ty } : ty;
// }

// export function addDecisionTable(dt: HelperDecisionTable) {
//   const inputs: { [name: string]: Parameter } = {};
//   const outputs: { [name: string]: DecisionTableOutput } = {};
//   if (dt.output) {
//     outputs[dt.output.name] = {
//       name: dt.output.name,
//       type:
//         typeof dt.output.type === "string"
//           ? { type: dt.output.type }
//           : dt.output.type,
//       collation: dt.output.collation,
//     };
//   }
//   if (dt.outputs) {
//     for (const output of dt.outputs) {
//       outputs[output.name] = {
//         name: output.name,
//         type:
//           typeof output.type === "string" ? { type: output.type } : output.type,
//         collation: output.collation,
//       };
//     }
//   }
//   if (dt.parameters) {
//     for (const input of dt.parameters) {
//       inputs[input.name] = {
//         name: input.name,
//         type: fieldTypeFromHelper(input.type),
//         notNull: input.notNull,
//       };
//     }
//   }
//   const newDt: DecisionTable = {
//     name: dt.name,
//     description: dt.description,
//     csv: dt.csv,
//     outputs,
//     inputs,
//     setup: dt.setup,
//   };
//   if (dt.bound) {
//     app.db.decisionTables[dt.name] = newDt;
//   } else {
//     app.decisionTables[dt.name] = newDt;
//   }
// }

// export function addScalarFunction(f: HelperScalarFunction) {
//   const inputs: { [name: string]: Parameter } = {};
//   for (const input of f.parameters) {
//     inputs[input.name] = {
//       name: input.name,
//       type: typeof input.type === "string" ? { type: input.type } : input.type,
//       notNull: input.notNull,
//     };
//   }
//   const newDt: ScalarFunction = {
//     name: f.name,
//     description: f.description,
//     inputs,
//     procedure: f.procedure,
//     returnType:
//       typeof f.returnType === "string" ? { type: f.returnType } : f.returnType,
//   };
//   if (f.bound) {
//     app.db.scalarFunctions[f.name] = newDt;
//   } else {
//     app.scalarFunctions[f.name] = newDt;
//   }
// }

// export function addPage(page: Page) {
//   // app.pages.push(page);
// }

// export function setShell(node: (pages: Node) => Node) {
//   // app.shell = node;
// }

// export function addScript(script: yom.Script) {
//   app.scripts.push(script);
// }

// export function addScriptDbFromMappingFile(name: string, mappingFile: string) {
//   app.scriptDbs.push({
//     name,
//     definition: {
//       type: "MappingFile",
//       file: mappingFile,
//     },
//   });
// }

// export function addScriptDbDefinition(
//   name: string,
//   define: (db: ScriptDbDefinition) => void
// ) {
//   inScriptDb = {
//     autoTrim: app.autoTrim,
//     collation: app.collation,
//     enableTransactionQueries: true,
//     tables: {},
//   };
//   define(inScriptDb);
//   app.scriptDbs.push({
//     name,
//     definition: { type: "Model", db: inScriptDb },
//   });
//   inScriptDb = undefined;
// }

// export const DEFAULT_DEV_USER_UUID = "147d4c57-947b-426f-9d81-fac3d9db5d31";
