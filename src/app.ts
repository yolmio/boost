import * as yom from "./yom";
import { Theme } from "./theme";
import { createTheme, ThemeOpts } from "./createTheme";
import { normalizeCase, pluralize, upcaseFirst } from "./utils/inflectors";
import { TableBuilder } from "./tableBuilder";
import { BasicStatements, BasicStatementsOrFn } from "./statements";
import { stringLiteral } from "./utils/sqlHelpers";
import { Style } from "./styleTypes";
import { WebAppManifest } from "./pwaManifest";
import { navbarShell, NavbarProps } from "./shells/navbar";
import { Node } from "./nodeTypes";
import { generateYom } from "./generate";

/**
 * The app singleton.
 *
 * This is where everything about the app is configured, the database, the ui, the api, everything.
 */
export class App {
  name = "please-rename";
  title = "please-rename";
  displayName = "Please Rename";
  theme: Theme = createTheme();
  displayNameConfig: DisplayNameConfig = {
    default: defaultGetDisplayName,
    table: defaultGetDisplayName,
    field: defaultGetDisplayName,
    virtual: defaultGetDisplayName,
    enum: defaultGetDisplayName,
    enumValue: defaultGetDisplayName,
  };
  searchConfig: SearchConfig = {
    defaultFuzzyConfig: {
      prefix: "Last",
      transpositionCostOne: true,
      tolerance: [
        { min: 8, tolerance: 2 },
        { min: 4, tolerance: 1 },
        { min: 0, tolerance: 0 },
      ],
    },
    defaultTokenizer: {
      splitter: { type: "Alphanumeric" },
      filters: [{ type: "AsciiFold" }, { type: "Lowercase" }],
    },
  };
  appDomain?: string;
  collation = "NoCase" as yom.Collation;
  autoTrim = "None" as yom.AutoTrim;
  dbRunMode = "BrowserSync" as yom.DbExecutionMode;
  db: Db = new Db();
  ui: Ui = new Ui();
  enums: Record<string, Enum> = {};
  decisionTables: Record<string, DecisionTable> = {};
  scalarFunctions: Record<string, ScalarFunction> = {};
  tableFunctions: Record<string, TableFunction> = {};
  test: yom.TestModel = {
    data: [],
    api: [],
    ui: [],
  };
  scripts: yom.Script[] = [];
  scriptDbs: ScriptDb[] = [];

  setTheme(themeOptions: ThemeOpts) {
    this.theme = createTheme(themeOptions);
  }

  addScalarFunction(f: HelperScalarFunction) {
    const inputs: { [name: string]: Parameter } = {};
    for (const input of f.parameters) {
      inputs[input.name] = {
        name: input.name,
        type:
          typeof input.type === "string" ? { type: input.type } : input.type,
        notNull: input.notNull,
      };
    }
    const newDt: ScalarFunction = {
      name: f.name,
      description: f.description,
      inputs,
      procedure: BasicStatements.normalizeToArray(f.procedure),
      returnType:
        typeof f.returnType === "string"
          ? { type: f.returnType }
          : f.returnType,
    };
    app.scalarFunctions[f.name] = newDt;
  }

  addScriptDbDefinition(
    name: string,
    f: (builder: ScriptDbDefinition) => void
  ) {
    const db = new ScriptDbDefinition(name);
    f(db);
    this.scriptDbs.push({
      name,
      definition: { type: "Model", db },
    });
  }

  generateYom() {
    return generateYom();
  }
}

function defaultGetDisplayName(sqlName: string) {
  return upcaseFirst(normalizeCase(sqlName).join(" "));
}

export class Ui {
  webAppConfig: WebAppConfig = {
    htmlHead: "",
    viewport: `width=device-width, initial-scale=1`,
    logoGeneration: { type: "Default" },
    manifest: {},
  };
  deviceDb = new DeviceDb();
  globalStyles: Style[] = [];
  shell?: (pages: Node) => Node;
  pages: Page[] = [];

  //
  // Helper methods
  //

  useNavbarShell(opts: NavbarProps) {
    this.shell = navbarShell(opts);
  }
}

export interface WebAppConfig {
  htmlHead: string;
  viewport?: string;
  manifest: WebAppManifest;
  logoGeneration:
    | {
        type: "App";
        safariPinnedTabColor: string;
        msTileColor: string;
        themeColor: string;
      }
    | {
        type: "Account";
        safariPinnedTabColor: string;
        msTileColor: string;
        themeColor: string;
      }
    | { type: "Default" }
    | { type: "Custom" };
}

export interface Page {
  path: string;
  content: Node;
  ignoreShell?: boolean;
}

export class Db {
  userTableName = "user";
  collation = "NoCase" as yom.Collation;
  autoTrim = "Both" as yom.AutoTrim;
  enableTransactionQueries = true;
  decisionTables: Record<string, DecisionTable> = {};
  scalarFunctions: Record<string, ScalarFunction> = {};
  tables: Record<string, Table> = {};
  searchMatches: Record<string, yom.SearchMatchConfig> = {};

  addTable(name: string, f: (builder: TableBuilder) => void) {
    const builder = new TableBuilder(name);
    f(builder);
    this.tables[name] = builder.finish();
  }
}

export interface ScriptDbModelDefinition {
  type: "Model";
  db: ScriptDbDefinition;
}

export interface ScriptDbMappingFileDefinition {
  type: "MappingFile";
  file: string;
}

export interface ScriptDb {
  name: string;
  definition: ScriptDbModelDefinition | ScriptDbMappingFileDefinition;
}

export class ScriptDbDefinition {
  tables: Record<string, Table> = {};

  constructor(public name: string) {}

  addTable(name: string, f: (builder: TableBuilder) => void) {
    const builder = new TableBuilder(name);
    f(builder);
    this.tables[name] = builder.finish();
  }
}

export class DeviceDb {
  defaultUniqueDistinctNulls = true;
  tables: Record<string, Table> = {};

  addTable(name: string, f: (builder: TableBuilder) => void) {
    const builder = new TableBuilder(name);
    f(builder);
    this.tables[name] = builder.finish();
  }
}

export interface Check {
  fields: string[];
  check: (fields: string[]) => yom.SqlExpression;
  errorMessage: (fields: string[]) => yom.SqlExpression;
}

export type CustomTableControl = (props: TableControlOpts) => Node;

export type TableControl =
  | { type: "Select" }
  | { type: "Combobox" }
  | { type: "Custom"; f: CustomTableControl };

export interface TableControlOpts {
  id?: string;
  immediateFocus?: boolean;
  value: string;
  onSelectValue: (newValue: string) => yom.DomProcStatement[];
  emptyQuery?: string;
  initialInputText?: string;
  error?: string;
  onComboboxSelectValue?: (
    newId: string,
    newLabel: string
  ) => yom.DomProcStatement[];
}

export interface AddressFieldGroup {
  type: "Address";
  name: string;
  fields: {
    name?: string;
    street1: string;
    street2?: string;
    city?: string;
    region?: string;
    country?: string;
    zip?: string;
  };
}

export type ImageUsage =
  | "dialog_full"
  | "general_full"
  | "square_thumbnail"
  | "general_thumbnail";

export interface ImageSetVariant {
  resize?: yom.ImageResize;
  quality?: number;
  usage?: ImageUsage;
}

export interface ImageSetFieldGroup {
  type: "Image";
  name: string;
  variants: Record<string, ImageSetVariant>;
}

export type FieldGroup = AddressFieldGroup | ImageSetFieldGroup;

export class Table {
  renameFrom?: string;
  fields: Record<string, Field> = {};
  virtualFields: Record<string, VirtualField> = {};
  fieldGroups: Record<string, FieldGroup> = {};
  uniqueConstraints: yom.UniqueConstraint[] = [];
  checks: Check[] = [];

  recordDisplayName?: RecordDisplayName;
  inlineRecordDisplay?: (id: yom.SqlExpression) => Node;
  searchConfig?: yom.RankedSearchTable;
  control?: TableControl;
  expectedOrderOfMagnitude?: number;
  description?: string;
  /** Return an expression which should be the href to the given id */
  customGetHrefToRecord?: (id: yom.SqlExpression) => yom.SqlExpression;
  linkable = false;

  ext: Record<string, any> = {};

  constructor(
    public primaryKeyFieldName: string,
    public name: string,
    public displayName: string
  ) {}

  getBaseUrl() {
    return pluralize(this.name.split("_").join(" ")).split(" ").join("-");
  }

  getHrefToRecord(id: yom.SqlExpression): yom.SqlExpression {
    if (this.customGetHrefToRecord) {
      return this.customGetHrefToRecord(id);
    }
    return `'/' || ${stringLiteral(this.getBaseUrl())} || '/' || ${id}`;
  }

  /**
   * Get the field which is a foreign key to the given table, if any.
   *
   * Returns the first foreign key field found.
   */
  getFkFieldToTable(table: string): ForeignKeyField | undefined {
    return Object.values(this.fields).find(
      (f) => f.type === "ForeignKey" && f.table === table
    ) as ForeignKeyField | undefined;
  }
}

export interface VirtualField {
  name: string;
  displayName: string;
  fields: string[];
  expr: (...fields: string[]) => string;
  type: VirtualType;
}

export type VirtualType =
  | { type: yom.SimpleScalarTypes }
  | { type: yom.ScalarIntegerTypes; usage?: IntegerUsage }
  | { type: "Decimal"; precision: number; scale: number }
  | { type: "ForeignKey"; table: string }
  | { type: "Enum"; enum: string }
  | { type: "String" };

/** This indicates how to get a display name of any record of the table */
export interface RecordDisplayName {
  fields: string[];
  expr: (...fields: string[]) => string;
}

export interface FieldCheck {
  check: (field: yom.SqlExpression) => yom.SqlExpression;
  errorMessage: (field: yom.SqlExpression) => yom.SqlExpression;
}

abstract class FieldBase {
  renameFrom?: string;
  notNull = false;
  checks: FieldCheck[] = [];
  unique = false;
  description?: string;
  default?: yom.SqlExpression;
  group?: string;
  indexed = false;
  ext: Record<string, any> = {};

  constructor(public name: string, public displayName: string) {}

  isInteger() {
    return false;
  }
  isNumeric() {
    return false;
  }
  isVariablePrecision() {
    return false;
  }
}

export type StringUsage = { type: "Email" } | { type: "PhoneNumber" };

export class StringField extends FieldBase {
  type = "String" as const;
  collation?: yom.Collation;
  minLength?: number;
  maxBytesPerChar?: number;
  autoTrim?: yom.AutoTrim;
  multiline?: boolean;
  usage?: StringUsage;

  constructor(name: string, displayName: string, public maxLength: number) {
    super(name, displayName);
  }
}

abstract class NumericFieldBase extends FieldBase {
  min?: string;
  max?: string;

  isNumeric() {
    return true;
  }
}

export type DurationSize = "seconds" | "minutes" | "hours";

export interface DurationUsage {
  type: "Duration";
  size: DurationSize;
}

export type Currency = "USD";

export interface MoneyUsage {
  type: "Money";
  currency: Currency;
}

export type IntegerUsage = DurationUsage | MoneyUsage;

abstract class IntegerFieldBase extends NumericFieldBase {
  usage?: IntegerUsage;

  isInteger(): boolean {
    return true;
  }
}

export class TinyUintField extends IntegerFieldBase {
  type = "TinyUint" as const;
}
export class SmallUintField extends IntegerFieldBase {
  type = "SmallUint" as const;
}
export class UintField extends IntegerFieldBase {
  type = "Uint" as const;
}
export class BigUintField extends IntegerFieldBase {
  type = "BigUint" as const;
}
export class TinyIntField extends IntegerFieldBase {
  type = "TinyInt" as const;
}
export class SmallIntField extends IntegerFieldBase {
  type = "SmallInt" as const;
}
export class IntField extends IntegerFieldBase {
  type = "Int" as const;
}
export class BigIntField extends IntegerFieldBase {
  type = "BigInt" as const;
}

export type IntegerField =
  | TinyUintField
  | TinyIntField
  | SmallUintField
  | SmallIntField
  | UintField
  | IntField
  | BigUintField
  | BigIntField;

export class RealField extends NumericFieldBase {
  type = "Real" as const;
  isVariablePrecision(): boolean {
    return true;
  }
}
export class DoubleField extends NumericFieldBase {
  type = "Double" as const;
  isVariablePrecision(): boolean {
    return true;
  }
}

export type DecimalUsage = MoneyUsage | { type: "Percentage" };

export class DecimalField extends NumericFieldBase {
  type = "Decimal" as const;
  usage?: DecimalUsage;
  constructor(
    name: string,
    displayName: string,
    public precision: number,
    public scale: number,
    public signed: boolean
  ) {
    super(name, displayName);
  }
}

export type NumericFields =
  | TinyUintField
  | TinyIntField
  | SmallUintField
  | SmallIntField
  | UintField
  | IntField
  | BigUintField
  | BigIntField
  | RealField
  | DoubleField
  | DecimalField;

export class DateField extends FieldBase {
  type = "Date" as const;
  formatString?: string;

  formatExpr(expr: yom.SqlExpression): yom.SqlExpression {
    const formatString = stringLiteral(this.formatString ?? "%-d %b %Y");
    return `format.date(${expr}, ${formatString})`;
  }
}

export class TimeField extends FieldBase {
  type = "Time" as const;
  formatString?: string;

  formatExpr(expr: yom.SqlExpression): yom.SqlExpression {
    "%-d %b %Y %l:%M%p";
    const formatString = stringLiteral(this.formatString ?? "%l:%M%p");
    return `format.date(${expr}, ${formatString})`;
  }
}

export class TimestampField extends FieldBase {
  type = "Timestamp" as const;
  formatString?: string;

  formatExpr(expr: yom.SqlExpression): yom.SqlExpression {
    const formatString = stringLiteral(
      this.formatString ?? "%-d %b %Y %l:%M%p"
    );
    return `format.date(${expr}, ${formatString})`;
  }
}

export class TxField extends FieldBase {
  type = "Tx" as const;
}

export class NuvaIdField extends FieldBase {
  type = "NuvaId" as const;
}

export interface BoolEnumLikeConfig {
  null?: string;
  false: string;
  true: string;
}

export class BoolField extends FieldBase {
  type = "Bool" as const;
  enumLike?: BoolEnumLikeConfig;
}

export class UuidField extends FieldBase {
  type = "Uuid" as const;
}

export class OrderingField extends FieldBase {
  type = "Ordering" as const;
}

export class EnumField extends FieldBase {
  type = "Enum" as const;
  enum: string;
  constructor(name: string, displayName: string, _enum: string) {
    super(name, displayName);
    this.enum = _enum;
  }
}

export class ForeignKeyField extends FieldBase {
  type = "ForeignKey" as const;
  constructor(
    name: string,
    displayName: string,
    public table: string,
    public onDelete: yom.OnDeleteBehavior
  ) {
    super(name, displayName);
  }
}

export type Field =
  | StringField
  | NumericFields
  | DateField
  | ForeignKeyField
  | BoolField
  | EnumField
  | OrderingField
  | UuidField
  | TimestampField
  | TimeField
  | TxField;

export interface Parameter {
  name: string;
  notNull?: boolean;
  type: yom.FieldType;
}

export interface DecisionTableOutput {
  name: string;
  collation?: yom.Collation;
  type: yom.ScalarType;
}

export interface DecisionTableVariable {
  name: string;
  expr: string;
}

export interface DecisionTable {
  name: string;
  description?: string;
  csv: string;
  setup?: yom.BasicStatement[];
  inputs: { [name: string]: Parameter };
  outputs: { [name: string]: DecisionTableOutput };
}

export interface ScalarFunction {
  name: string;
  description?: string;
  procedure: yom.BasicStatement[];
  inputs: { [name: string]: Parameter };
  returnType: yom.ScalarType;
}

export interface TableFunction {}

export interface EnumValue {
  name: string;
  displayName: string;
  renameFrom?: string;
  description?: string;
}

export type EnumControl =
  | { type: "Select" }
  | { type: "Combobox" }
  | { type: "Custom"; f: (props: TableControlOpts) => Node };

export interface EnumControlOpts {
  id: string;
  value: string;
  onSelectValue: (newValue: string) => yom.DomProcStatement[];
  initialInputText?: string;
}

export interface Enum {
  name: string;
  displayName?: string;
  renameFrom?: string;
  values: Record<string, EnumValue>;

  description?: string;
  getDisplayName?: (value: string) => string;
  inlineDisplay?: (value: string) => Node;
  control?: EnumControl;
}

interface HelperFunctionParam {
  name: string;
  notNull?: boolean;
  collation?: yom.Collation;
  type: HelperFieldType;
}

type HelperFieldType =
  | yom.FieldType
  | yom.FieldIntegerTypes
  | yom.SimpleScalarTypes;

interface HelperScalarFunction {
  name: string;
  description?: string;
  parameters: HelperFunctionParam[];
  procedure: BasicStatementsOrFn;
  returnType: yom.ScalarType | yom.SimpleScalarTypes | yom.ScalarIntegerTypes;
}

function fieldTypeFromHelper(ty: HelperFieldType): yom.FieldType {
  return typeof ty == "string" ? { type: ty } : ty;
}

/** How the display name derived from the sql name for tables, fields, etc. */
export interface DisplayNameConfig {
  default: (sqlName: string) => string;
  table: (sqlName: string) => string;
  field: (sqlName: string) => string;
  virtual: (sqlName: string) => string;
  enum: (sqlName: string) => string;
  enumValue: (sqlName: string) => string;
}

export interface SearchConfig {
  defaultFuzzyConfig: yom.FuzzyConfig;
  defaultTokenizer: yom.Tokenizer;
}

/**
 * The total model of the app, everything that is needed to generate the app is done through this single
 * variable.
 */
export const app = new App();
