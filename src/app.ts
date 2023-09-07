import * as yom from "./yom";
import { Theme } from "./theme";
import { createTheme, ThemeOpts } from "./createTheme";
import { normalizeCase, pluralize, upcaseFirst } from "./utils/inflectors";
import {
  BasicStatements,
  BasicStatementsOrFn,
  DomStatementsOrFn,
  ScriptStatements,
  ScriptStatementsOrFn,
} from "./statements";
import { ident, stringLiteral } from "./utils/sqlHelpers";
import { Style } from "./styleTypes";
import { WebAppManifest } from "./pwaManifest";
import { navbarShell, NavbarProps } from "./shells/navbar";
import { Node } from "./nodeTypes";
import { generateYom } from "./generate";
import { dashboardGridPage, DashboardGridBuilder } from "./pages/dashboardGrid";
import { recordGridPage, RecordGridBuilder } from "./pages/recordGrid";
import { dbManagementPage, DbManagmentPageOpts } from "./pages/dbManagement";
import { insertFormPage, InsertFormPageOpts } from "./pages/insertForm";
import { SimpleReportsPageBuilder } from "./pages/simpleReportPage";
import {
  simpleDatagridPage,
  SimpleDatagridPageBuilder,
} from "./pages/simpleDatagrid";
import { datagridPage, DatagridPageBuilder } from "./pages/datagrid";
import { updateFormPage, UpdateFormPage } from "./pages/updateForm";
import {
  multiCardInsertPage,
  MultiCardInsertPageOpts,
} from "./pages/multiCardInsert";
import { ComponentOpts } from "./components/types";
import { addMigrationScript, MigrationScriptOpts } from "./migrate";

/**
 * The app singleton.
 *
 * This is where everything about the app is configured, the database, the ui, the api, everything.
 */
export class App {
  /**
   * The name of the application it will show up at: yolm.app/{YOUR_ACCOUNT_NAME}/{APP_NAME}
   *
   * It needs to be unique within an account
   */
  name = "please-rename";
  /**
   * The title of the html document for this application
   */
  title = "please-rename";
  /*
   * Used in displaying the name of this app to the user (not in the url)
   */
  displayName = "Please Rename";
  theme: Theme = createTheme();
  displayNameConfig: DisplayNameConfig = {
    default: defaultGetDisplayName,
    table: defaultGetDisplayName,
    field: defaultGetDisplayName,
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
  recordRuleFunctions: Record<string, RecordRuleFn> = {};
  ruleFunctions: Record<string, RuleFunction> = {};
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
    this.scalarFunctions[f.name] = scalarFunctionFromHelper(f);
  }

  addRecordRuleFunction(rrfn: HelperRecordRuleFn) {
    this.recordRuleFunctions[rrfn.name] = rrfnFromHelper(rrfn);
  }

  addRuleFunction(rfn: HelperRuleFunction) {
    this.ruleFunctions[rfn.name] = ruleFunctionFromHelper(rfn);
  }

  addEnum(enum_: HelperEnum) {
    const displayName = app.displayNameConfig.enum(enum_.name);
    const values = enum_.values.map((v) => {
      if (typeof v === "string") {
        return { name: v, displayName: app.displayNameConfig.enumValue(v) };
      }
      return {
        displayName: app.displayNameConfig.enumValue(v.name),
        ...v,
      };
    });
    if (!enum_.disableDisplayRfn) {
      enum_.withSimpleRfns = enum_.withSimpleRfns ?? [];
      enum_.withSimpleRfns.push({
        name: "display_" + enum_.name,
        outputType: "String",
        fields: values.map((n) => [n.name, stringLiteral(n.displayName)]),
      });
    }
    if (Array.isArray(enum_.withBoolRfns)) {
      enum_.withSimpleRfns = enum_.withSimpleRfns ?? [];
      for (const e of enum_.withBoolRfns) {
        enum_.withSimpleRfns.push({
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
    if (Array.isArray(enum_.withSimpleRfns)) {
      for (const rfn of enum_.withSimpleRfns) {
        this.addRuleFunction({
          name: rfn.name,
          parameters: [
            {
              name: "value",
              type: { type: "Enum", enum: enum_.name },
            },
          ],
          returnType: rfn.outputType,
          header: ["input.value", "output"],
          rules: [
            ...rfn.fields.map(([field, value]) => [
              stringLiteral(field),
              value,
            ]),
            ...(rfn.default ? [["any", rfn.default]] : []),
          ],
        });
      }
    }
    const valuesObject: Record<string, EnumValue> = {};
    for (const v of values) {
      valuesObject[v.name] = v;
    }
    const modelEnum: Enum = {
      name: enum_.name,
      displayName,
      renameFrom: enum_.renameFrom,
      description: enum_.description,
      values: valuesObject,
    };
    app.enums[enum_.name] = modelEnum;
    if (!enum_.disableDisplayRfn) {
      modelEnum.getDisplayName = (v) => `rfn.display_${enum_.name}(${v})`;
    }
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

  addScript(name: string, procedure: ScriptStatementsOrFn) {
    this.scripts.push({
      name,
      procedure: ScriptStatements.normalizeToArray(procedure),
    });
  }

  addMigrationScript(opts: MigrationScriptOpts) {
    addMigrationScript(opts);
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

  addDashboardGridPage(fn: (page: DashboardGridBuilder) => any) {
    dashboardGridPage(fn);
  }

  addDbManagementPage(opts: DbManagmentPageOpts = {}) {
    dbManagementPage(opts);
  }

  addInsertFormPage(opts: InsertFormPageOpts) {
    insertFormPage(opts);
  }

  addUpdateFormPage(opts: UpdateFormPage) {
    updateFormPage(opts);
  }

  addMultiCardInsert(opts: MultiCardInsertPageOpts) {
    multiCardInsertPage(opts);
  }

  addRecordGridPage(
    table: string,
    fn: (builder: RecordGridBuilder) => unknown
  ) {
    recordGridPage(table, fn);
  }

  addSimpleReportsPage(fn: (builder: SimpleReportsPageBuilder) => unknown) {
    const builder = new SimpleReportsPageBuilder();
    fn(builder);
    builder.finish();
  }

  addSimpleDatagridPage(
    table: string,
    f: (f: SimpleDatagridPageBuilder) => unknown
  ) {
    simpleDatagridPage(table, f);
  }

  addDatagridPage(table: string, f: (f: DatagridPageBuilder) => unknown) {
    datagridPage(table, f);
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
  recordRuleFunctions: Record<string, RecordRuleFn> = {};
  ruleFunctions: Record<string, RuleFunction> = {};
  scalarFunctions: Record<string, ScalarFunction> = {};
  tables: Record<string, Table> = {};
  searchMatches: Record<string, yom.SearchMatchConfig> = {};

  /**
   * Predefined tables and more that speed up the definition of your database.
   *
   * These also have the added benefit of integrating with other parts of the app, such as the ui and api.
   */
  get catalog() {
    return new DbCatalog(this);
  }

  addTable(name: string, f: (builder: TableBuilder) => void) {
    const builder = new TableBuilder(name);
    f(builder);
    this.tables[name] = builder.finish();
  }

  addScalarFunction(f: HelperScalarFunction) {
    this.scalarFunctions[f.name] = scalarFunctionFromHelper(f);
  }

  addRecordRuleFunction(rrfn: HelperRecordRuleFn) {
    this.recordRuleFunctions[rrfn.name] = rrfnFromHelper(rrfn);
  }

  addRuleFunction(rfn: HelperRuleFunction) {
    this.ruleFunctions[rfn.name] = ruleFunctionFromHelper(rfn);
  }
}

export class DbCatalog {
  #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /**
   * Add a related notes table to the given main table.
   *
   * The notes table will be named `${mainTable}_note`, and will have a foreign key to the main table.
   *
   * The notes table will have the following fields:
   * content: string
   * date: date
   */
  addNotesTable(mainTable: string) {
    this.#db.addTable(mainTable + "_note", (table) => {
      table.fk(mainTable).notNull();
      table.string("content", 2000).notNull();
      table.date("date").notNull();
    });
  }

  /**
   * Add a related attachments table to the given main table.
   *
   * The attachments table will be named `${mainTable}_attachment`, and will have a foreign key to the main table.
   *
   * The attachments table will have the following fields:
   * name: string
   * file: uuid (This is the id of the file in our file storage which you can use to create a public url to the file)
   */
  addAttachmentsTable(mainTable: string) {
    this.#db.addTable(mainTable + "_attachment", (table) => {
      table.fk(mainTable).notNull();
      table.string("name", 100).notNull();
      table.uuid("file").notNull();
    });
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

export interface TableControlOpts extends ComponentOpts {
  styles?: Style;
  id?: string;
  immediateFocus?: boolean;
  value: string;
  onSelectValue: (newValue: string) => DomStatementsOrFn;
  emptyQuery?: string;
  initialInputText?: string;
  error?: string;
  onComboboxSelectValue?: (
    newId: string,
    newLabel: string
  ) => DomStatementsOrFn;
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
  getHrefToRecord?: (id: yom.SqlExpression) => yom.SqlExpression;
  baseUrl = "";

  ext: Record<string, any> = {};

  constructor(
    public primaryKeyFieldName: string,
    public name: string,
    public displayName: string
  ) {}

  get identName() {
    return ident(this.name);
  }

  get primaryKeyIdent() {
    return ident(this.primaryKeyFieldName);
  }

  getBaseUrl() {
    return pluralize(this.name.split("_").join(" ")).split(" ").join("-");
  }

  getRecordDisplayNameExpr(record?: string) {
    const displayNameFn = this.recordDisplayName;
    if (!displayNameFn) {
      throw new Error("table " + this.name + " has no recordDisplayName");
    }
    return displayNameFn.expr(
      ...displayNameFn.fields.map((f) => `${record ?? this.identName}.${f}`)
    );
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

  /** Name of field escaped as sql identifier */
  get identName() {
    return ident(this.name);
  }

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

const RECORD_DISPLAY_NAME_FIELD_GROUPS = [["first_name", "last_name"]];
const RECORD_DISPLAY_NAME_FIELDS = ["name", "title"];

export class TableBuilder {
  #fields: BaseFieldBuilder[] = [];
  #fieldGroups: Record<string, FieldGroup> = {};
  #uniques: yom.UniqueConstraint[] = [];
  #checks: Check[] = [];
  #description?: string;
  #searchConfig: yom.RankedSearchTable | undefined;
  #renameFrom?: string;
  #recordDisplayNameFields?: string[];
  #recordDisplayName?: RecordDisplayName;
  #createDefaultNameMatch = false;
  #getHrefToRecord?: (id: string) => string;
  #baseUrl?: string;
  #formControl?: TableControl;
  #displayName: string;
  #primaryKeyFieldName?: string;

  constructor(private name: string) {
    this.#displayName = app.displayNameConfig.table(name);
  }

  /**
   * Predefined fields and field groups that help you build tables faster.
   *
   * These also have the added benefit of integrating with other parts of the app, such as the ui and api.
   */
  get catalog() {
    return new TableCatalog(this);
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

  #getBaseUrl() {
    if (this.#baseUrl) {
      return this.#baseUrl;
    }
    return pluralize(this.name.split("_").join(" ")).split(" ").join("-");
  }

  linkable(f?: (id: string) => string) {
    const baseUrl = this.#getBaseUrl();
    this.#getHrefToRecord =
      f ?? ((id) => `'/' || ${stringLiteral(baseUrl)} || '/' || ${id}`);
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
    table.fieldGroups = this.#fieldGroups;
    table.uniqueConstraints = this.#uniques;
    table.recordDisplayName = recordDisplayName;
    table.description = this.#description;
    table.searchConfig = searchConfig;
    table.getHrefToRecord = this.#getHrefToRecord;
    table.baseUrl = this.#getBaseUrl();
    table.control = this.#formControl;
    return table;
  }
}

export class TableCatalog {
  #table: TableBuilder;

  constructor(builder: TableBuilder) {
    this.#table = builder;
  }

  /**
   * Adds the fields that are required on the `user` table for our integrated authentication
   * system.
   */
  addRequiredUserFields() {
    this.#table.uuid(`global_id`).notNull().unique();
    this.#table.bool("disabled").notNull().default("false");
    this.#table.string("email", 320).unique();
  }

  /**
   * Adds fields which represents an address.
   *
   * Integrates with addressCard and addressesCards.
   */
  addAddressFields(opts: AddressFieldGroupOpts = {}) {
    function createFieldName(
      option: boolean | string | undefined,
      defaultName: string,
      createByDefault: boolean
    ) {
      if (typeof option === "string") {
        return option;
      }
      if (option || createByDefault) {
        return opts.prefix ? opts.prefix + defaultName : defaultName;
      }
    }
    const groupName = opts.name ?? "address";
    const nameField = createFieldName(opts.createFields?.name, "name", false);
    const street1Field = createFieldName(
      opts.createFields?.street,
      "street",
      true
    );
    const street2Field = createFieldName(
      opts.createFields?.streetTwo,
      "street_two",
      false
    );
    const cityField = createFieldName(opts.createFields?.city, "city", true);
    const stateField = createFieldName(opts.createFields?.state, "state", true);
    const countryField = createFieldName(
      opts.createFields?.country,
      "country",
      true
    );
    const zipField = createFieldName(opts.createFields?.zip, "zip", true);
    this.#table.fieldGroup(groupName, {
      type: "Address",
      name: groupName,
      fields: {
        name: nameField,
        city: cityField,
        street1: street1Field!,
        street2: street2Field,
        country: countryField,
        region: stateField,
        zip: zipField,
      },
    });
    if (nameField) {
      this.#table.string(nameField, 100).group(groupName);
    }
    if (street1Field) {
      this.#table.string(street1Field, 80).group(groupName);
    }
    if (street2Field) {
      this.#table.string(street2Field, 80).group(groupName);
    }
    if (cityField) {
      this.#table.string(cityField, 85).group(groupName);
    }
    if (stateField) {
      this.#table.string(stateField, 50).group(groupName);
    }
    if (countryField) {
      this.#table.string(countryField, 60).group(groupName);
    }
    if (zipField) {
      this.#table.string(zipField, 20).group(groupName);
    }
  }

  addImageSet(opts: ImageSetOpts) {
    const groupName = opts.groupName ?? "image";
    this.#table.fieldGroup(groupName, {
      type: "Image",
      name: groupName,
      variants: opts.variants,
    });
    for (const fieldName of Object.keys(opts.variants)) {
      this.#table.uuid(fieldName).group(groupName);
    }
  }

  /**
   * Adds a field group of two fields that integrates with the datagrid and record grid page header.
   *
   * Creates a field group with the following fields:
   * image_full: uuid
   * image_thumb: uuid
   */
  addSimpleImageSet(groupName = "image") {
    this.#table.fieldGroup(groupName, {
      type: "Image",
      name: groupName,
      variants: {
        image_full: { quality: 95, usage: "general_full" },
        image_thumb: {
          quality: 80,
          resize: { height: "180", width: "180", type: "'cover'" },
          usage: "square_thumbnail",
        },
      },
    });
    this.#table.uuid("image_full").group(groupName);
    this.#table.uuid("image_thumb").group(groupName);
  }
}

export interface AddressFieldGroupOpts {
  /**
   * Name of the field group. Defaults to `address`.
   */
  name?: string;
  /**
   * Add a prefix to all the fields in the group.
   * Useful if you want to add multiple address field groups to a table.
   * For example: billing_, shipping_, etc.
   */
  prefix?: string;
  /**
   * Control which fields are created
   */
  createFields?: {
    /**
     * Address name field, not the street, but the name of the company or person at the address.
     * @default false
     */
    name?: boolean | string;
    /**
     * Street address line 1 (often all that is neede), name is street by default
     * @default true
     */
    street?: boolean | string;
    /**
     * Street address line 2, name is street_two by default
     * @default false
     */
    streetTwo?: boolean | string;
    /**
     * City, name is city by default
     * @default true
     */
    city?: boolean | string;
    /**
     * State, name is state by default
     * @default true
     */
    state?: boolean | string;
    /**
     * Country, name is country by default
     * @default true
     */
    country?: boolean | string;
    /**
     * Zip code/Postal code, name is zip by default
     * @default true
     */
    zip?: boolean | string;
  };
}

export interface ImageSetOpts {
  groupName?: string;
  variants: Record<string, ImageSetVariant>;
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
            .return(`total`),
        catch: (s) => s.return(),
      }),
  });
  app.addScalarFunction({
    name: `display_minutes_duration`,
    parameters: [{ name: "value", type: { type: "BigInt" } }],
    returnType: { type: "String" },
    procedure: (s) =>
      s.return(`case when input.value < 0 then '-' else '' end ||
    abs(round(input.value / 60)) ||
    ':' ||
    lpad(abs(round(input.value % 60)), 2, 0)`),
  });
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

export type HelperScalarType =
  | yom.ScalarType
  | yom.SimpleScalarTypes
  | yom.ScalarIntegerTypes
  | "String";

export interface Parameter {
  name: string;
  notNull?: boolean;
  type: yom.FieldType;
}

export interface RecordRuleFnOutput {
  name: string;
  collation?: yom.Collation;
  type: yom.ScalarType;
}

export interface RecordRuleFn {
  name: string;
  description?: string;
  header: string[];
  rules: string[][];
  setup?: yom.BasicStatement[];
  parameters: { [name: string]: Parameter };
  outputs: { [name: string]: RecordRuleFnOutput };
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

export type HelperFieldType =
  | yom.FieldType
  | yom.FieldIntegerTypes
  | yom.SimpleScalarTypes;

interface HelperScalarFunction {
  name: string;
  description?: string;
  parameters: HelperFunctionParam[];
  procedure: BasicStatementsOrFn;
  returnType: HelperScalarType;
}

function scalarFunctionFromHelper(f: HelperScalarFunction): ScalarFunction {
  const inputs: { [name: string]: Parameter } = {};
  for (const input of f.parameters) {
    inputs[input.name] = {
      name: input.name,
      type: typeof input.type === "string" ? { type: input.type } : input.type,
      notNull: input.notNull,
    };
  }
  return {
    name: f.name,
    description: f.description,
    inputs,
    procedure: BasicStatements.normalizeToArray(f.procedure),
    returnType:
      typeof f.returnType === "string" ? { type: f.returnType } : f.returnType,
  };
}

export function fieldTypeFromHelper(ty: HelperFieldType): yom.FieldType {
  return typeof ty == "string" ? { type: ty } : ty;
}

/** How the display name derived from the sql name for tables, fields, etc. */
export interface DisplayNameConfig {
  default: (sqlName: string) => string;
  table: (sqlName: string) => string;
  field: (sqlName: string) => string;
  enum: (sqlName: string) => string;
  enumValue: (sqlName: string) => string;
}

export interface SearchConfig {
  defaultFuzzyConfig: yom.FuzzyConfig;
  defaultTokenizer: yom.Tokenizer;
}

export interface SimpleRfn {
  name: string;
  outputType: HelperScalarType;
  fields: [string, string][];
  default?: string;
}

export type BoolRfn =
  | {
      name: string;
      trues: string[];
    }
  | {
      name: string;
      falses: string[];
    };

export interface HelperEnum {
  name: string;
  displayName?: string;
  renameFrom?: string;
  description?: string;
  values: (
    | string
    | {
        name: string;
        displayName?: string;
        renameFrom?: string;
        description?: string;
      }
  )[];
  withSimpleRfns?: SimpleRfn[];
  withBoolRfns?: BoolRfn[];
  disableDisplayRfn?: boolean;
}

interface HelperRecordRuleFnOutput {
  name: string;
  collation?: yom.Collation;
  type: HelperScalarType;
}

interface HelperRecordRuleFn {
  name: string;
  description?: string;
  setup?: BasicStatementsOrFn;
  parameters?: HelperFunctionParam[];
  outputs: HelperRecordRuleFnOutput[];
  header: string[];
  rules: string[][];
}

function rrfnFromHelper(rrfn: HelperRecordRuleFn): RecordRuleFn {
  const inputs: { [name: string]: Parameter } = {};
  const outputs: { [name: string]: RecordRuleFnOutput } = {};
  if (rrfn.outputs) {
    for (const output of rrfn.outputs) {
      outputs[output.name] = {
        name: output.name,
        type:
          typeof output.type === "string" ? { type: output.type } : output.type,
        collation: output.collation,
      };
    }
  }
  if (rrfn.parameters) {
    for (const input of rrfn.parameters) {
      inputs[input.name] = {
        name: input.name,
        type: fieldTypeFromHelper(input.type),
        notNull: input.notNull,
      };
    }
  }
  return {
    name: rrfn.name,
    description: rrfn.description,
    outputs,
    parameters: inputs,
    setup: BasicStatements.normalizeToArray(rrfn.setup),
    header: rrfn.header,
    rules: rrfn.rules,
  };
}

export interface RuleFunction {
  name: string;
  description?: string;
  setup?: yom.BasicStatement[];
  parameters: { [name: string]: Parameter };
  header: string[];
  rules: string[][];
  returnType: yom.ScalarType;
}

interface HelperRuleFunction {
  name: string;
  description?: string;
  parameters: HelperFunctionParam[];
  setup?: BasicStatementsOrFn;
  returnType: HelperScalarType;
  header: string[];
  rules: string[][];
}

function ruleFunctionFromHelper(f: HelperRuleFunction): RuleFunction {
  const inputs: { [name: string]: Parameter } = {};
  for (const input of f.parameters) {
    inputs[input.name] = {
      name: input.name,
      type: typeof input.type === "string" ? { type: input.type } : input.type,
      notNull: input.notNull,
    };
  }
  return {
    name: f.name,
    description: f.description,
    parameters: inputs,
    setup: BasicStatements.normalizeToArray(f.setup),
    header: f.header,
    rules: f.rules,
    returnType:
      typeof f.returnType === "string" ? { type: f.returnType } : f.returnType,
  };
}

/**
 * The total model of the app, everything that is needed to generate the app is done through this single
 * variable.
 */
export const app = new App();
