import type * as yom from "./yom.js";
import type { Node } from "./nodeTypes.js";
import type { Style } from "./styleTypes.js";
import { ComponentOpts } from "./components/types.js";

export interface ExtensibleObject {
  /**
   * An object to contain information which any non-boost developer can use to put extra data.
   *
   * Most objects in the boost model are extensible to allow for you to build extra functionality on
   * top of boost and build your own generators and functions without hassle.
   */
  ext: Record<string, any>;
}

export interface Names extends ExtensibleObject {
  /** Name as it will be in the app spec */
  name: string;
  /** A name for displaying this object to the user */
  displayName: string;
  /** If used in a form control label, use this over the display name */
  formControlLabelName?: string;
  /** Name to use in dropdowns (for enum values) */
  dropdownName?: string;
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
  onSelectValue: (newValue: string) => yom.ClientProcStatement[];
  emptyQuery?: string;
  initialInputText?: string;
  error?: string;
  onComboboxSelectValue?: (
    newId: string,
    newLabel: string
  ) => yom.ClientProcStatement[];
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
  primaryKeyFieldName?: string;
  name: Names;
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
  name: Names;
  fields: string[];
  expr: (...fields: string[]) => string;
  type: VirtualType;
}

export type VirtualType =
  | { type: yom.SimpleScalarTypes }
  | { type: yom.ScalarIntegerTypes }
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
  name: Names;
  renameFrom?: string;
  notNull?: boolean;
  checks: FieldCheck[];
  unique?: boolean;
  description?: string;
  default?: string;
  group?: string;
}

export interface StringField extends FieldBase {
  type: "String";
  maxLength: number;
  collation?: yom.Collation;
  minLength?: number;
  maxBytesPerChar?: number;
  autoTrim?: yom.AutoTrim;
  multiline?: boolean;
}

interface NumericFieldBase extends FieldBase {
  min?: string;
  max?: string;
  displayText?: (field: string) => string;
}

type SimpleNumericField<N extends string> = { type: N } & NumericFieldBase;

export type TinyUintField = SimpleNumericField<"TinyUint">;
export type TinyIntField = SimpleNumericField<"TinyInt">;
export type SmallUintField = SimpleNumericField<"SmallUint">;
export type SmallIntField = SimpleNumericField<"SmallInt">;
export type UintField = SimpleNumericField<"Uint">;
export type IntField = SimpleNumericField<"Int">;
export type BigUintField = SimpleNumericField<"BigUint">;
export type BigIntField = SimpleNumericField<"BigInt">;

export type RealField = SimpleNumericField<"Real">;
export type DoubleField = SimpleNumericField<"Double">;

export type DecimalUsage =
  | { type: "Money"; currency: "USD" }
  | {
      type: "Percentage";
    };

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

export type DurationSize = "seconds" | "minutes" | "hours";

export interface DurationField extends FieldBase {
  type: "Duration";
  backing: yom.FieldIntegerTypes;
  size: DurationSize;
}

export interface CustomField extends FieldBase {
  type: "Custom";
}

export type Field =
  | StringField
  | NumericFields
  | DateField
  | ForeignKeyField
  | BoolField
  | EnumField
  | CustomField
  | OrderingField
  | UuidField
  | DurationField
  | TimestampField
  | TimeField
  | TxField;

export interface Parameter {
  name: Names;
  notNull?: boolean;
  type: yom.FieldType;
}

export interface DecisionTableOutput {
  name: Names;
  collation?: yom.Collation;
  type: yom.ScalarType;
}

export interface DecisionTableVariable {
  name: Names;
  expr: string;
}

export interface DecisionTable {
  name: Names;
  description?: string;
  csv: string;
  setup?: yom.BasicStatement[];
  inputs: { [name: string]: Parameter };
  outputs: { [name: string]: DecisionTableOutput };
}

export interface ScalarFunction {
  name: Names;
  description?: string;
  procedure: yom.BasicStatement[];
  inputs: { [name: string]: Parameter };
  returnType: yom.ScalarType;
}

export interface EnumValue {
  name: Names;
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
  onSelectValue: (newValue: string) => yom.ClientProcStatement[];
  initialInputText?: string;
}

export interface Enum {
  name: Names;
  renameFrom?: string;
  values: Record<string, EnumValue>;

  description?: string;
  getDisplayName?: (value: string) => string;
  inlineDisplay?: (value: string) => Node;
  control?: EnumControl;
}

export type Authorization =
  | {
      /**
       * Allow only users with one of these roles to do some action.
       *
       * These are not sql expressions, just string values of the user_role enum.
       */
      allow: string[] | string;
    }
  | {
      /**
       * Deny any users with one of these roles to do some action. Anyone without one of these roles will be allowed.
       *
       * These are not sql expressions, just string values of the user_role enum.
       */
      deny: string[] | string;
    };

export interface Database {
  userTableName: string;
  roleEnumName: string;
  userRoleTableName: string;
  /** Returns an expression that returns a boolean if the user is authorized */
  userIsAuthorized: (user: string, auth: Authorization) => string;
  collation: yom.Collation;
  autoTrim: yom.AutoTrim;
  enableTransactionQueries: boolean;
  decisionTables: { [name: string]: DecisionTable };
  scalarFunctions: { [name: string]: ScalarFunction };
  //todo: table functions
  tables: { [name: string]: Table };
  searchMatches: { [name: string]: yom.SearchMatchConfig };
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

/**
 * A model that is easier to code generate with and has more information.
 */
export interface BoostModel {
  name: string;
  displayName: string;
  description: string;
  pwaThemeColor: string;
  pwaBackgroundColor: string;
  dbRunMode: yom.DbExecutionMode;
  collation: yom.Collation;
  autoTrim: yom.AutoTrim;
  database: Database;
  enums: { [name: string]: Enum };
  decisionTables: { [name: string]: DecisionTable };
  scalarFunctions: { [name: string]: ScalarFunction };
  //todo: add table functions
  test: yom.TestModel;
  scripts: yom.Script[];
  scriptDbs: ScriptDb[];

  deviceDb: DeviceDb;
  shell: Node;
  pages: Page[];
}
