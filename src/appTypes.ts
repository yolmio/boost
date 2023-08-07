import type * as yom from "./yom";
import type { Node } from "./nodeTypes";
import type { Style } from "./styleTypes";
import { ComponentOpts } from "./components/types";
import { Theme } from "./theme";
import { WebAppManifest } from "./pwaManifest";
import { TableBuilder } from "./appHelpers";
import { navbarShell, NavbarProps } from "./shells/navbar";

export interface ExtensibleObject {
  /**
   * An object to contain information which any non-boost developer can use to put extra data.
   *
   * Most objects in the boost model are extensible to allow for you to build extra functionality on
   * top of boost and build your own generators and functions without hassle.
   */
  ext: Record<string, any>;
}

export interface Check {
  fields: string[];
  check: (fields: string[]) => string;
  errorMessage: (fields: string[]) => string;
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

export interface Table extends ExtensibleObject {
  primaryKeyFieldName: string;
  name: string;
  displayName: string;
  renameFrom?: string;
  fields: Record<string, Field>;
  virtualFields: Record<string, VirtualField>;
  fieldGroups: Record<string, FieldGroup>;
  uniqueConstraints: yom.UniqueConstraint[];
  checks: Check[];

  recordDisplayName?: RecordDisplayName;
  inlineRecordDisplay?: (id: string) => Node;
  searchConfig?: yom.RankedSearchTable;
  control?: TableControl;
  expectedOrderOfMagnitude?: number;
  description?: string;
  /** Return an expression which should be the href to the given id */
  getHrefToRecord?: (id: string) => string;
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
  check: (field: string) => string;
  errorMessage: (field: string) => string;
}

export interface FieldBase extends ExtensibleObject {
  name: string;
  displayName: string;
  renameFrom?: string;
  notNull?: boolean;
  checks: FieldCheck[];
  unique?: boolean;
  description?: string;
  default?: string;
  group?: string;
  indexed?: boolean;
}

export type StringUsage = { type: "Email" } | { type: "PhoneNumber" };

export interface StringField extends FieldBase {
  type: "String";
  maxLength: number;
  collation?: yom.Collation;
  minLength?: number;
  maxBytesPerChar?: number;
  autoTrim?: yom.AutoTrim;
  multiline?: boolean;
  usage?: StringUsage;
}

interface NumericFieldBase extends FieldBase {
  min?: string;
  max?: string;
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

interface IntegerFieldBase extends NumericFieldBase {
  usage?: IntegerUsage;
}

export interface TinyUintField extends IntegerFieldBase {
  type: "TinyUint";
}
export interface TinyIntField extends IntegerFieldBase {
  type: "TinyInt";
}
export interface SmallUintField extends IntegerFieldBase {
  type: "SmallUint";
}
export interface SmallIntField extends IntegerFieldBase {
  type: "SmallInt";
}
export interface UintField extends IntegerFieldBase {
  type: "Uint";
}
export interface IntField extends IntegerFieldBase {
  type: "Int";
}
export interface BigUintField extends IntegerFieldBase {
  type: "BigUint";
}
export interface BigIntField extends IntegerFieldBase {
  type: "BigInt";
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

export interface RealField extends NumericFieldBase {
  type: "Real";
}
export interface DoubleField extends NumericFieldBase {
  type: "Double";
}

export type DecimalUsage = MoneyUsage | { type: "Percentage" };

export interface DecimalField extends FieldBase {
  type: "Decimal";
  precision: number;
  scale: number;
  signed: boolean;
  min?: string;
  max?: string;
  usage?: DecimalUsage;
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

export interface DateField extends FieldBase {
  type: "Date";
  /** how to display the date in the ui */
  formatString?: string;
}

export interface TimeField extends FieldBase {
  type: "Time";
  /** how to display the date in the ui */
  formatString?: string;
}

export interface TimestampField extends FieldBase {
  type: "Timestamp";
  /** how to display the date in the ui */
  formatString?: string;
}

export interface TxField extends FieldBase {
  type: "Tx";
}

export interface NuvaIdField extends FieldBase {
  type: "NuvaId";
}

export interface BoolEnumLikeConfig {
  null?: string;
  false: string;
  true: string;
}

export interface BoolField extends FieldBase {
  type: "Bool";
  /** This boolean should act more like an enum when displaying and in forms */
  enumLike?: BoolEnumLikeConfig;
}

export interface UuidField extends FieldBase {
  type: "Uuid";
}

export interface OrderingField extends FieldBase {
  type: "Ordering";
}

export interface ForeignKeyField extends FieldBase {
  type: "ForeignKey";
  table: string;
  onDelete: yom.OnDeleteBehavior;
}

export interface EnumField extends FieldBase {
  type: "Enum";
  enum: string;
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

export interface EnumControlOpts extends ComponentOpts {
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

export interface Database {
  userTableName: string;
  collation: yom.Collation;
  autoTrim: yom.AutoTrim;
  enableTransactionQueries: boolean;
  decisionTables: { [name: string]: DecisionTable };
  scalarFunctions: { [name: string]: ScalarFunction };
  //todo: table functions
  tables: { [name: string]: Table };
  searchMatches: { [name: string]: yom.SearchMatchConfig };

  //
  // Helper methods
  //

  addTable(name: string, f: (builder: TableBuilder) => void): void;
}

export interface ScriptDbDefinition {
  tables: { [name: string]: Table };
  collation: yom.Collation;
  autoTrim: yom.AutoTrim;
  enableTransactionQueries: boolean;
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

export interface Page {
  path: string;
  content: Node;
  ignoreShell?: boolean;
  [attr: string]: any;
}

export interface DeviceDb {
  tables: Record<string, Table>;
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

export interface Ui {
  webAppConfig: WebAppConfig;
  deviceDb: DeviceDb;
  globalStyles: Style[];
  shell?: (pages: Node) => Node;
  pages: Page[];

  //
  // Helper methods
  //
  useNavbarShell: (opts: NavbarProps) => void;
}

/**
 * A model that is easier to code generate with and has more information.
 */
export interface BoostAppModel {
  name: string;
  title: string;
  displayName: string;
  theme: Theme;
  displayNameConfig: DisplayNameConfig;
  searchConfig: SearchConfig;
  dbRunMode: yom.DbExecutionMode;
  appDomain?: string;
  collation: yom.Collation;
  autoTrim: yom.AutoTrim;
  db: Database;
  enums: { [name: string]: Enum };
  decisionTables: { [name: string]: DecisionTable };
  scalarFunctions: { [name: string]: ScalarFunction };
  //todo: add table functions
  test: yom.TestModel;
  scripts: yom.Script[];
  scriptDbs: ScriptDb[];
  ui: Ui;
}

export * from "./nodeTypes";
