/**
 * The complete model of a yolm system
 */
export interface System {
  locale: Locale;
  name: string;
  region: Region;
  replicas: Replica[];
  hobbyPlan?: boolean;
  vcpus: VCpus;
  memoryGb: MemoryGb;
  /** Must be either 10 or divisible by 100 */
  fileSizeGb: number;
  collation: Collation;
  db: Database;
  apps: App[];
  enums?: Enum[];
  scalarFunctions?: ScalarFunction[];
  tableFunctions?: TableFunction[];
  scripts?: Script[];
  scriptDbs?: ScriptDb[];
  test?: TestModel;
  api?: AppApi;
}

export type VCpus = 1 | 2 | 4 | 8 | 16;
export type MemoryGb = 1 | 2 | 4 | 8 | 16 | 32 | 64;

export type Region =
  | "us-new-york"
  | "us-miami"
  | "us-seattle"
  | "us-chicago"
  | "us-dallas"
  | "us-san-francisco"
  | "us-los-angeles"
  | "us-atlanta";

export interface Replica {
  region: Region;
  vcpus: VCpus;
}

export interface AppDbExecutionConfig {
  /**
   * By default can the database be downloaded to the client.
   *
   * Can be overridden by the user, by having a `can_download_db` field in the user table.
   */
  canDownload?: boolean;
  /**
   * Should we by default download the database to the client.
   *
   * This is just a default preference, it can be overridden for each user by specifying a `prefer_download_db` field in the user table.
   *
   * It can also be overridden on each device by updating the `prefer_download_db` system table in the ui.
   */
  preferDownload?: boolean;
}

export interface PullConfig {
  /**
   * Stop pulling after this many ms since last interaction.
   *
   * default is 90,000 (1.5 minutes)
   *
   * minimum is 60,000 (1 minute)
   *
   * maximum is 600,000 (10 minutes)
   */
  stopPullsAfter?: number;
  /**
   * Pull every this many ms.
   *
   * default is 10,000 (10 seconds)
   *
   * minimum is 1,000 (1 second)
   *
   * maxium is 300,000 (5 minutes)
   */
  pullEvery?: number;
  /**
   * After we stop doing pulls due to interactivity. We want to try a pull before responding
   * to any procs (that don't have a possible app db write) or state.
   * This makes sure you don't display overly stale data to the user. This timeout
   * is how long we wait before we execute the proc or state (if the pull didn't respond in less time).
   *
   * If you don't want this behavior, set this to 0, and every proc and state will never wait for a pull.
   * Setting to 0 is most useful in apps where you don't expect much change coming from other devices.
   *
   * default is 500 (0.5 seconds)
   *
   * Max is 10,000 (10 seconds)
   */
  pullTimeoutAfterStop?: number;
}

export type Locale = "en_us";

/** This indicates the string is to be treated as a SQL expression */
export type SqlExpression = string & {};
/** This indicates the string is to be treated as a SQL query */
export type SqlQuery = string & {};

export interface EnumValue {
  name: string;
  renameFrom?: string;
}

export interface Enum {
  name: string;
  renameFrom?: string;
  values: EnumValue[];
}

///
/// PROCEDURE
///

/** Runs an insert, update or delete sql statement */
export interface ModifyStatement {
  t: "Modify";
  sql: string;
}

/** Throws an error in the procedure, error will be of type `thrown_error` */
export interface ThrowStatement {
  t: "Throw";
  message: SqlExpression;
  description?: SqlExpression;
}

/**
 * Declares a table in the procedure.
 *
 * You must specify either `query`, `fields` or both.
 *
 * If only `query` is specified, the fields of the table will be derived from the query if possible.
 * If not possible, you must specify the fields manually.
 */
export interface TableDeclaration {
  t: "TableDeclaration";
  name: string;
  query?: SqlQuery;
  fields?: ProcTableField[];
}

/**
 * Declares a record in the procedure.
 *
 * A record is a table with exactly one row and some syntactic sugar to make it easier to work with.
 *
 * For example if you specify a record `foo` you can access a field from it by simply writing `foo.field_name`.
 *
 * You must specify either `query`, `fields` or both.
 *
 * If only `query` is specified, the fields of the table will be derived from the query if possible.
 * If not possible, you must specify the fields manually.
 */
export interface RecordDeclaration {
  t: "RecordDeclaration";
  name: string;
  query?: SqlQuery;
  fields?: ProcTableField[];
}

/**
 * Declares a scalar in the procedure.
 *
 * A scalar is a single value, e.g. a string, number or date. We have some syntactic sugar to make it easier to work with.
 *
 * For example if you specify a scalar `foo` you can access it by simply writing `foo` in any expression.
 *
 * You must specify either `expr` or `type` or both.
 *
 * If only `expr` is specified, the type of the scalar will be derived from the expression if possible.
 * If not possible, you must specify the type manually.
 */
export interface ScalarDeclaration {
  t: "ScalarDeclaration";
  name: string;
  expr?: SqlExpression;
  type?: FieldType;
}

/** Sets a scalar to a value. */
export interface SetScalar {
  t: "SetScalar";
  name: string;
  expr: SqlExpression;
}

/**
 * Returns a value from the procedure.
 *
 * This can also be used as an exit point from the procedure if the procedure doesn't need a return value.
 */
export interface ReturnExprStatement {
  t: "ReturnExpr";
  expr: SqlExpression;
}

export interface DebugExprStatement {
  t: "DebugExpr";
  expr: SqlExpression;
}

export interface DebugQueryStatement {
  t: "DebugQuery";
  query: SqlQuery;
}

export interface CreateTableCursorStatement {
  t: "CreateTableCursor";
  table: string;
  name: string;
}

export interface CreateQueryCursorStatement {
  t: "CreateQueryCursor";
  query: string;
  name: string;
}

export interface AdvanceCursorStatement {
  t: "AdvanceCursor";
  cursor: string;
}

export interface BreakStatement {
  t: "Break";
  label?: string;
}

export interface ContinueStatement {
  t: "Continue";
  label?: string;
}

export interface QueryToCsvStatement {
  t: "QueryToCsv";
  query: SqlQuery;
  scalar: string;
}

export interface PushSourceStatement {
  t: "PushSource";
  source: string;
}

export interface PopSourceStatement {
  t: "PopSource";
}

export interface EvalRulesStatement {
  t: "EvalRules";
  rules: string[][];
}

export type BaseStatement =
  | ModifyStatement
  | ThrowStatement
  | TableDeclaration
  | RecordDeclaration
  | ScalarDeclaration
  | SetScalar
  | ReturnExprStatement
  | DebugExprStatement
  | DebugQueryStatement
  | CreateTableCursorStatement
  | CreateQueryCursorStatement
  | BreakStatement
  | ContinueStatement
  | QueryToCsvStatement
  | AdvanceCursorStatement
  | PushSourceStatement
  | PopSourceStatement
  | EvalRulesStatement;

export interface IfStatement<T> {
  t: "If";
  condition: SqlExpression;
  onTrue: T[];
  onFalse: T[];
}

export interface WhileStatement<T> {
  t: "While";
  condition: SqlExpression;
  label?: string;
  body: T[];
}

export interface BlockStatement<T> {
  t: "Block";
  body: T[];
}

export interface ForEachCursorStatement<T> {
  t: "ForEachCursor";
  label?: string;
  cursor: string;
  body: T[];
}

export interface ForEachTableStatement<T> {
  t: "ForEachTable";
  label?: string;
  cursorName: string;
  table: string;
  body: T[];
}

export interface ForEachQueryStatement<T> {
  t: "ForEachQuery";
  label?: string;
  query: string;
  cursorName: string;
  body: T[];
}

export interface TryStatement<T> {
  t: "Try";
  body: T[];
  errorName?: string;
  catch?: T[];
  finally?: T[];
}

export type ControlFlowStatement<T> =
  | IfStatement<T>
  | WhileStatement<T>
  | BlockStatement<T>
  | ForEachCursorStatement<T>
  | ForEachQueryStatement<T>
  | ForEachTableStatement<T>
  | TryStatement<T>;

export type BasicStatement =
  | IfStatement<BasicStatement>
  | WhileStatement<BasicStatement>
  | BlockStatement<BasicStatement>
  | ForEachCursorStatement<BasicStatement>
  | ForEachQueryStatement<BasicStatement>
  | ForEachTableStatement<BasicStatement>
  | TryStatement<BasicStatement>
  | BaseStatement;

export interface ProcTableField {
  name: string;
  type: FieldType;
  notNull?: boolean;
  indexed?: boolean;
}

//
// Database
//

export type FieldType =
  | { type: SimpleScalarTypes }
  | { type: FieldIntegerTypes }
  | EnumType
  | DecimalType
  | ForeignKeyType
  | StringType
  | { type: "Tx" };

export type FieldIntegerTypes =
  | "TinyUint"
  | "TinyInt"
  | ScalarIntegerTypes
  | "SmallUint"
  | "Uint"
  | "BigUint";

export interface DecimalType {
  type: "Decimal";
  scale: number;
  precision: number;
  signed: boolean;
}

export interface ForeignKeyType {
  type: "ForeignKey";
  table: string;
  onDelete: OnDeleteBehavior;
}

export interface EnumType {
  type: "Enum";
  enum: string;
}

export interface StringType {
  type: "String";
  collation?: Collation;
  maxLength: number;
  minLength?: number;
  maxBytesPerChar?: number;
  autoTrim?: AutoTrim;
}

export type SimpleScalarTypes =
  | "Ordering"
  | "Real"
  | "Double"
  | "Timestamp"
  | "Date"
  | "Time"
  | "Bool"
  | "Uuid"
  | "Json";

export type ScalarIntegerTypes = "SmallInt" | "Int" | "BigInt";

export type ScalarType =
  | { type: SimpleScalarTypes }
  | { type: ScalarIntegerTypes }
  | { type: "String" }
  | DecimalType
  | EnumType;

export type OnDeleteBehavior = "Cascade" | "Restrict" | "SetToNull";

export type Collation = "Binary" | "NoCase";

export type AutoTrim = "None" | "Left" | "Right" | "Both";

export interface TableField {
  name: string;
  renameFrom?: string;
  type: FieldType;
  notNull?: boolean;
  indexed?: boolean;
  default?: SqlExpression;
}

export interface Table {
  name: string;
  primaryKeyFieldName?: string;
  renameFrom?: string;
  fields: TableField[];
  uniqueConstraints?: UniqueConstraint[];
  checks?: SqlExpression[];
}

export type UniqueConstraintField =
  | string
  | {
      field: string;
      distinctNulls?: boolean;
    };

export interface UniqueConstraint {
  fields: UniqueConstraintField[];
  distinctNulls?: boolean;
}

export interface Database {
  userTableName?: string;
  collation?: Collation;
  autoTrim?: AutoTrim;
  enableTransactionQueries: boolean;
  defaultUniqueDistinctNulls?: boolean;
  tables: Table[];
  scalarFunctions?: ScalarFunction[];
  tableFunctions?: TableFunction[];
  searchMatches?: SearchMatchConfig[];
}

export type Parameter = ProcTableField;

export interface ScalarFunction {
  name: string;
  parameters?: Parameter[];
  procedure: BasicStatement[];
  returnType: ScalarType;
}

export interface ReturnTableStatement {
  t: "ReturnTable";
  table: string;
}

export interface ReturnQueryStatement {
  t: "ReturnQuery";
  query: string;
}

export type TableFunctionStatement =
  | IfStatement<TableFunctionStatement>
  | WhileStatement<TableFunctionStatement>
  | BlockStatement<TableFunctionStatement>
  | ForEachCursorStatement<TableFunctionStatement>
  | ForEachQueryStatement<TableFunctionStatement>
  | ForEachTableStatement<TableFunctionStatement>
  | TryStatement<TableFunctionStatement>
  | BaseStatement
  | ReturnTableStatement
  | ReturnQueryStatement;

export interface TableFunctionReturnField {
  name: string;
  collation?: Collation;
  type: ScalarType;
}

export interface TableFunction {
  name: string;
  parameters?: Parameter[];
  procedure: TableFunctionStatement[];
  returns: TableFunctionReturnField[];
}

/**
 * Filters the tokens before adding them to the index or for searching.
 */
export type TokenizerFilter =
  | { type: "Lowercase" }
  | { type: "RemoveLong"; len: number }
  | { type: "AsciiFold" };

/**
 * How to split the text into tokens.
 */
export type TokenizerSplitter =
  | { type: "None" }
  | { type: "Alphanumeric" }
  | { type: "Whitespace" };

export interface Tokenizer {
  filters: TokenizerFilter[];
  splitter: TokenizerSplitter;
}

export interface RankedSearchTable {
  table: string;
  filterExpr?: SqlExpression;
  disabled?: SqlExpression;
  fields?: { field: string; priority: number }[];
  fieldGroups?: { fields: string[]; priority: number }[];
}

export interface RankedSearchConfig {
  tokenizer: Tokenizer;
  style: RankedSearchStyle;
  tables: RankedSearchTable[];
}

export interface SearchMatchConfig {
  name: string;
  tokenizer: Tokenizer;
  style: SearchMatchStyle;
  table: string;
  fields?: string[];
  fieldGroups?: { fields: string[] }[];
}

export type PrefixStyle = "None" | "Last";

export interface FuzzyTolerance {
  min: number;
  tolerance: number;
}

export interface FuzzyConfig {
  transpositionCostOne: boolean;
  tolerance: FuzzyTolerance[];
  prefix: PrefixStyle;
}

export type SearchMatchStyle =
  | ({ type: "Fuzzy" } & FuzzyConfig)
  | { type: "Contains" }
  | { type: "Exact"; prefix: PrefixStyle };

export type RankedSearchStyle =
  | ({ type: "Fuzzy" } & FuzzyConfig)
  | { type: "Contains" }
  | { type: "Exact"; prefix: PrefixStyle };

export interface SearchStatement {
  t: "Search";
  resultTable: string;
  config: RankedSearchConfig;
  query: SqlExpression;
  offset?: SqlExpression;
  limit: SqlExpression;
}

//
// UI
//

export type YolmPropNames = "yolmFocusKey";

export type AriaPropNames =
  | "aria-activedescendant"
  | "aria-atomic"
  | "aria-autocomplete"
  | "aria-busy"
  | "aria-checked"
  | "aria-colcount"
  | "aria-colindex"
  | "aria-colspan"
  | "aria-controls"
  | "aria-current"
  | "aria-describedby"
  | "aria-details"
  | "aria-disabled"
  | "aria-dropeffect"
  | "aria-errormessage"
  | "aria-expanded"
  | "aria-flowto"
  | "aria-grabbed"
  | "aria-haspopup"
  | "aria-hidden"
  | "aria-invalid"
  | "aria-keyshortcuts"
  | "aria-label"
  | "aria-labelledby"
  | "aria-level"
  | "aria-live"
  | "aria-modal"
  | "aria-multiline"
  | "aria-multiselectable"
  | "aria-orientation"
  | "aria-owns"
  | "aria-placeholder"
  | "aria-posinset"
  | "aria-pressed"
  | "aria-readonly"
  | "aria-relevant"
  | "aria-required"
  | "aria-roledescription"
  | "aria-rowcount"
  | "aria-rowindex"
  | "aria-rowspan"
  | "aria-selected"
  | "aria-setsize"
  | "aria-sort"
  | "aria-valuemax"
  | "aria-valuemin"
  | "aria-valuenow"
  | "aria-valuetext";

export type HtmlPropNames =
  | "accessKey"
  | "className"
  | "contentEditable"
  | "contextMenu"
  | "dir"
  | "draggable"
  | "hidden"
  | "id"
  | "lang"
  | "placeholder"
  | "slot"
  | "spellCheck"
  | "style"
  | "tabIndex"
  | "title"
  | "translate"
  | "radioGroup"
  | "role"
  | "autoCapitalize"
  | "autoCorrect"
  | "autoSave"
  | "color"
  | "itemProp"
  | "itemScope"
  | "itemType"
  | "itemID"
  | "itemRef"
  | "results"
  | "security"
  | "unselectable"
  | "inputMode";

export type AllHtmlPropNames =
  | AriaPropNames
  | HtmlPropNames
  | YolmPropNames
  | "accept"
  | "acceptCharset"
  | "action"
  | "allowFullScreen"
  | "allowTransparency"
  | "alt"
  | "as"
  | "async"
  | "autoComplete"
  | "autoFocus"
  | "autoPlay"
  | "capture"
  | "cellPadding"
  | "cellSpacing"
  | "charSet"
  | "challenge"
  | "checked"
  | "cite"
  | "classID"
  | "cols"
  | "colSpan"
  | "content"
  | "controls"
  | "coords"
  | "crossOrigin"
  | "data"
  | "dateTime"
  | "default"
  | "defer"
  | "disabled"
  | "download"
  | "encType"
  | "form"
  | "formAction"
  | "formEncType"
  | "formMethod"
  | "formNoValidate"
  | "formTarget"
  | "frameBorder"
  | "headers"
  | "height"
  | "high"
  | "href"
  | "hrefLang"
  | "htmlFor"
  | "httpEquiv"
  | "indeterminate"
  | "integrity"
  | "keyParams"
  | "keyType"
  | "kind"
  | "label"
  | "list"
  | "loop"
  | "low"
  | "manifest"
  | "marginHeight"
  | "marginWidth"
  | "max"
  | "maxLength"
  | "media"
  | "mediaGroup"
  | "method"
  | "min"
  | "minLength"
  | "multiple"
  | "muted"
  | "name"
  | "nonce"
  | "noValidate"
  | "open"
  | "optimum"
  | "pattern"
  | "placeholder"
  | "playsInline"
  | "poster"
  | "preload"
  | "readOnly"
  | "rel"
  | "required"
  | "reversed"
  | "rows"
  | "rowSpan"
  | "sandbox"
  | "scope"
  | "scoped"
  | "scrolling"
  | "seamless"
  | "selected"
  | "shape"
  | "size"
  | "sizes"
  | "span"
  | "src"
  | "srcDoc"
  | "srcLang"
  | "srcSet"
  | "start"
  | "step"
  | "summary"
  | "target"
  | "type"
  | "useMap"
  | "value"
  | "width"
  | "wmode"
  | "wrap";

export type SvgPropNames =
  | AriaPropNames
  | HtmlPropNames
  | "color"
  | "height"
  | "id"
  | "lang"
  | "max"
  | "media"
  | "method"
  | "min"
  | "name"
  | "style"
  | "target"
  | "type"
  | "width"
  | "role"
  | "tabIndex"
  | "crossOrigin"
  | "accentHeight"
  | "accumulate"
  | "additive"
  | "alignmentBaseline"
  | "text-after-edge"
  | "allowReorder"
  | "alphabetic"
  | "amplitude"
  | "arabicForm"
  | "ascent"
  | "attributeName"
  | "attributeType"
  | "autoReverse"
  | "azimuth"
  | "baseFrequency"
  | "baselineShift"
  | "baseProfile"
  | "bbox"
  | "begin"
  | "bias"
  | "by"
  | "calcMode"
  | "capHeight"
  | "clip"
  | "clipPath"
  | "clipPathUnits"
  | "clipRule"
  | "colorInterpolation"
  | "colorInterpolationFilters"
  | "colorProfile"
  | "colorRendering"
  | "contentScriptType"
  | "contentStyleType"
  | "cursor"
  | "cx"
  | "cy"
  | "d"
  | "decelerate"
  | "descent"
  | "diffuseConstant"
  | "direction"
  | "display"
  | "divisor"
  | "dominantBaseline"
  | "dur"
  | "dx"
  | "dy"
  | "edgeMode"
  | "elevation"
  | "enableBackground"
  | "end"
  | "exponent"
  | "externalResourcesRequired"
  | "fill"
  | "fillOpacity"
  | "fillRule"
  | "filter"
  | "filterRes"
  | "filterUnits"
  | "floodColor"
  | "floodOpacity"
  | "focusable"
  | "fontFamily"
  | "fontSize"
  | "fontSizeAdjust"
  | "fontStretch"
  | "fontStyle"
  | "fontVariant"
  | "fontWeight"
  | "format"
  | "from"
  | "fx"
  | "fy"
  | "g1"
  | "g2"
  | "glyphName"
  | "glyphOrientationHorizontal"
  | "glyphOrientationVertical"
  | "glyphRef"
  | "gradientTransform"
  | "gradientUnits"
  | "hanging"
  | "horizAdvX"
  | "horizOriginX"
  | "href"
  | "ideographic"
  | "imageRendering"
  | "in2"
  | "in"
  | "intercept"
  | "k1"
  | "k2"
  | "k3"
  | "k4"
  | "k"
  | "kernelMatrix"
  | "kernelUnitLength"
  | "kerning"
  | "keyPoints"
  | "keySplines"
  | "keyTimes"
  | "lengthAdjust"
  | "letterSpacing"
  | "lightingColor"
  | "limitingConeAngle"
  | "local"
  | "markerEnd"
  | "markerHeight"
  | "markerMid"
  | "markerStart"
  | "markerUnits"
  | "markerWidth"
  | "mask"
  | "maskContentUnits"
  | "maskUnits"
  | "mathematical"
  | "mode"
  | "numOctaves"
  | "offset"
  | "opacity"
  | "operator"
  | "order"
  | "orient"
  | "orientation"
  | "origin"
  | "overflow"
  | "overlinePosition"
  | "overlineThickness"
  | "paintOrder"
  | "panose1"
  | "path"
  | "pathLength"
  | "patternContentUnits"
  | "patternTransform"
  | "patternUnits"
  | "pointerEvents"
  | "points"
  | "pointsAtX"
  | "pointsAtY"
  | "pointsAtZ"
  | "preserveAlpha"
  | "preserveAspectRatio"
  | "primitiveUnits"
  | "r"
  | "radius"
  | "refX"
  | "refY"
  | "renderingIntent"
  | "repeatCount"
  | "repeatDur"
  | "requiredExtensions"
  | "requiredFeatures"
  | "restart"
  | "result"
  | "rotate"
  | "rx"
  | "ry"
  | "scale"
  | "seed"
  | "shapeRendering"
  | "slope"
  | "spacing"
  | "specularConstant"
  | "specularExponent"
  | "speed"
  | "spreadMethod"
  | "startOffset"
  | "stdDeviation"
  | "stemh"
  | "stemv"
  | "stitchTiles"
  | "stopColor"
  | "stopOpacity"
  | "strikethroughPosition"
  | "strikethroughThickness"
  | "string"
  | "stroke"
  | "strokeDasharray"
  | "strokeDashoffset"
  | "strokeLinecap"
  | "strokeLinejoin"
  | "strokeMiterlimit"
  | "strokeOpacity"
  | "strokeWidth"
  | "surfaceScale"
  | "systemLanguage"
  | "tableValues"
  | "targetX"
  | "targetY"
  | "textAnchor"
  | "textDecoration"
  | "textLength"
  | "textRendering"
  | "to"
  | "transform"
  | "u1"
  | "u2"
  | "underlinePosition"
  | "underlineThickness"
  | "unicode"
  | "unicodeBidi"
  | "unicodeRange"
  | "unitsPerEm"
  | "vAlphabetic"
  | "values"
  | "vectorEffect"
  | "version"
  | "vertAdvY"
  | "vertOriginX"
  | "vertOriginY"
  | "vHanging"
  | "vIdeographic"
  | "viewBox"
  | "viewTarget"
  | "visibility"
  | "vMathematical"
  | "widths"
  | "wordSpacing"
  | "writingMode"
  | "x1"
  | "x2"
  | "x"
  | "xChannelSelector"
  | "xHeight"
  | "xlinkActuate"
  | "xlinkArcrole"
  | "xlinkHref"
  | "xlinkRole"
  | "xlinkShow"
  | "xlinkTitle"
  | "xlinkType"
  | "xmlBase"
  | "xmlLang"
  | "xmlns"
  | "xmlnsXlink"
  | "xmlSpace"
  | "y1"
  | "y2"
  | "y"
  | "yChannelSelector"
  | "z"
  | "zoomAndPan";

export type AllHtmlTags =
  | "a"
  | "abbr"
  | "address"
  | "area"
  | "article"
  | "aside"
  | "audio"
  | "b"
  | "base"
  | "bdi"
  | "bdo"
  | "big"
  | "blockquote"
  | "body"
  | "br"
  | "button"
  | "canvas"
  | "caption"
  | "cite"
  | "code"
  | "col"
  | "colgroup"
  | "data"
  | "datalist"
  | "dd"
  | "del"
  | "details"
  | "dfn"
  | "dialog"
  | "div"
  | "dl"
  | "dt"
  | "em"
  | "embed"
  | "fieldset"
  | "figcaption"
  | "figure"
  | "footer"
  | "form"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "head"
  | "header"
  | "hgroup"
  | "hr"
  | "html"
  | "i"
  | "iframe"
  | "img"
  | "input"
  | "ins"
  | "kbd"
  | "keygen"
  | "label"
  | "legend"
  | "li"
  | "link"
  | "main"
  | "map"
  | "mark"
  | "menu"
  | "menuitem"
  | "meta"
  | "meter"
  | "nav"
  | "noindex"
  | "noscript"
  | "object"
  | "ol"
  | "optgroup"
  | "option"
  | "output"
  | "p"
  | "param"
  | "picture"
  | "pre"
  | "progress"
  | "q"
  | "rp"
  | "rt"
  | "ruby"
  | "s"
  | "samp"
  | "slot"
  | "script"
  | "section"
  | "select"
  | "small"
  | "source"
  | "span"
  | "strong"
  | "style"
  | "sub"
  | "summary"
  | "sup"
  | "table"
  | "template"
  | "tbody"
  | "td"
  | "textarea"
  | "tfoot"
  | "th"
  | "thead"
  | "time"
  | "title"
  | "tr"
  | "track"
  | "u"
  | "ul"
  | "var"
  | "video"
  | "wbr"
  | "webview"
  | "svg"
  | "animate"
  | "animateMotion"
  | "animateTransform"
  | "circle"
  | "clipPath"
  | "defs"
  | "desc"
  | "ellipse"
  | "feBlend"
  | "feColorMatrix"
  | "feComponentTransfer"
  | "feComposite"
  | "feConvolveMatrix"
  | "feDiffuseLighting"
  | "feDisplacementMap"
  | "feDistantLight"
  | "feDropShadow"
  | "feFlood"
  | "feFuncA"
  | "feFuncB"
  | "feFuncG"
  | "feFuncR"
  | "feGaussianBlur"
  | "feImage"
  | "feMerge"
  | "feMergeNode"
  | "feMorphology"
  | "feOffset"
  | "fePointLight"
  | "feSpecularLighting"
  | "feSpotLight"
  | "feTile"
  | "feTurbulence"
  | "filter"
  | "foreignObject"
  | "g"
  | "image"
  | "line"
  | "linearGradient"
  | "marker"
  | "mask"
  | "metadata"
  | "mpath"
  | "path"
  | "pattern"
  | "polygon"
  | "polyline"
  | "radialGradient"
  | "rect"
  | "stop"
  | "switch"
  | "symbol"
  | "text"
  | "textPath"
  | "tspan"
  | "use"
  | "view";

export type EventHandlerName =
  | "click"
  | "doubleClick"
  | "clickAway"
  | "mouseDown"
  | "mouseUp"
  | "mouseEnter"
  | "mouseLeave"
  | "mouseOver"
  | "mouseOut"
  | "mouseMove"
  | "keydown"
  | "keyup"
  | "blur"
  | "focus"
  | "focusin"
  | "focusout"
  | "focusAway"
  | "input"
  | "checkboxChange"
  | "change"
  | "submit"
  | "fileChange"
  | "mount"
  | "scroll"
  | "mousemove";

export interface DelayStatement {
  t: "Delay";
  /** positive integer */
  ms: SqlExpression;
}

export interface CommitUiTreeChangesStatement {
  t: "CommitUiTreeChanges";
}

export interface RunTreeChangeEffectsStatement {
  t: "RunTreeChangeEffects";
}

/**
 * This will run a set of statements as a new asynchronous task, this means this can
 * run concurrently with the task that spawned it.
 *
 * `detached` makes it so that the task is not aborted when the parent task is aborted, by default
 * the task is aborted when the parent task is aborted.
 */
export interface SpawnStatement {
  t: "Spawn";
  disableAutoUiCommit?: boolean;
  detached?: boolean;
  handleScalar?: string;
  statements: DomProcStatement[];
}

export interface WaitOnTaskStatement {
  t: "WaitOnTask";
  handle: SqlExpression;
}

export interface JoinTasksStatement {
  t: "JoinTasks";
  /** Either a query or list of expressions of task handles */
  tasks: SqlQuery | SqlExpression[];
}

export interface SelectTasksStatement {
  t: "SelectTasks";
  /** Either a query or list of expressions of task handles */
  tasks: SqlQuery | SqlExpression[];
}

export interface AbortTaskStatement {
  t: "AbortTask";
  handle: SqlExpression;
}

export interface ScrollIntoViewStatement {
  t: "ScrollElIntoView";
  elementId: SqlExpression;
  behavior?: "'auto'" | "'instant'" | "'smooth'" | SqlExpression;
  block?: "'start'" | "'center'" | "'end'" | "'nearest'" | SqlExpression;
  inline?: "'start'" | "'center'" | "'end'" | "'nearest'" | SqlExpression;
}

export interface FocusElStatement {
  t: "FocusEl";
  elementId: SqlExpression;
}

export type ElProperty =
  | "scrollHeight"
  | "scrollWidth"
  | "scrollTop"
  | "scrollLeft";

export interface GetElPropertyStatement {
  t: "GetElProperty";
  property: ElProperty;
  scalar: string;
  elementId: SqlExpression;
}

export type WindowProperty =
  | "outerHeight"
  | "outerWidth"
  | "innerHeight"
  | "innerWidth"
  | "scrollY"
  | "scrollX"
  | "screenLeft"
  | "screenTop";

export interface GetWindowPropertyStatement {
  t: "GetWindowProperty";
  property: WindowProperty;
  scalar: string;
}

export interface GetBoundingClientRectStatement {
  t: "GetBoundingClientRect";
  elementId: SqlExpression;
  record: string;
}

export interface DoServiceProcStatement {
  t: "ServiceProc";
  /**
   * Don't execute ancestor allows for. Useful for an unauthorized branch below a state node with an allow
   */
  ignoreAncestorAllows?: boolean;
  statements: ServiceProcStatement[];
}

export interface Download {
  t: "Download";
  filename: SqlExpression;
  content: SqlExpression;
}

export interface PreventDefault {
  t: "PreventDefault";
}

export interface StopPropagation {
  t: "StopPropagation";
}

export interface AddFileStatement {
  t: "AddFile";
  domUuid: SqlExpression;
  fileRecord: string;
}

export interface ImageResize {
  /** positive integer */
  width: SqlExpression;
  /** positive integer */
  height: SqlExpression;
  type: "'crop'" | "'cover'" | "'scale_down'" | "'contain'" | SqlExpression;
}

export interface AddImageStatement {
  t: "AddImage";
  domUuid: SqlExpression;
  fileRecord: string;
  /** integer between 0 and 100 */
  jpegQuality: SqlExpression;
  resize?: ImageResize;
}

export type ViewTransitionTiming =
  | "immediate"
  | "not_immediate"
  | "fallback"
  | "final"
  | "next"
  | "next_not_immediate"
  | "next_and_final"
  | "all";

export interface TriggerViewTransition {
  t: "TriggerViewTransition";
  on: ViewTransitionTiming;
  type?: string;
}

export type DomProcStatement =
  | IfStatement<DomProcStatement>
  | WhileStatement<DomProcStatement>
  | BlockStatement<DomProcStatement>
  | ForEachCursorStatement<DomProcStatement>
  | ForEachQueryStatement<DomProcStatement>
  | ForEachTableStatement<DomProcStatement>
  | TryStatement<DomProcStatement>
  | BaseStatement
  | NavigateStatement
  | PreventDefault
  | StopPropagation
  | Download
  | SetQueryParam
  | DoServiceProcStatement
  | DelayStatement
  | CommitUiTreeChangesStatement
  | SpawnStatement
  | WaitOnTaskStatement
  | JoinTasksStatement
  | SelectTasksStatement
  | AbortTaskStatement
  | FocusElStatement
  | ScrollIntoViewStatement
  | RequestStatement
  | AddImageStatement
  | AddFileStatement
  | GetWindowPropertyStatement
  | GetBoundingClientRectStatement
  | GetElPropertyStatement
  | LogOutStatment
  | TriggerViewTransition
  | RunTreeChangeEffectsStatement;

export interface LogOutStatment {
  t: "LogOut";
}

export interface NavigateStatement {
  t: "Navigate";
  to: SqlExpression;
  replace?: SqlExpression;
}

export interface SetQueryParam {
  t: "SetQueryParam";
  param: SqlExpression;
  value: SqlExpression;
  replace?: SqlExpression;
}

export interface StartTransactionStatement {
  t: "StartTransaction";
}

export interface CommitTransactionStatement {
  t: "CommitTransaction";
}

export interface RollbackTransactionStatement {
  t: "RollbackTransaction";
}

export interface UndoTx {
  t: "UndoTx";
  tx: SqlExpression;
}

export type ServiceProcStatement =
  | IfStatement<ServiceProcStatement>
  | WhileStatement<ServiceProcStatement>
  | BlockStatement<ServiceProcStatement>
  | ForEachCursorStatement<ServiceProcStatement>
  | ForEachQueryStatement<ServiceProcStatement>
  | ForEachTableStatement<ServiceProcStatement>
  | TryStatement<ServiceProcStatement>
  | BaseStatement
  | NavigateStatement
  | SetQueryParam
  | DynamicQueryStatement
  | DynamicModifyStatement
  | DynamicQueryToCsv
  | StartTransactionStatement
  | CommitTransactionStatement
  | RequestStatement
  | UndoTx
  | UserStatement
  | RollbackTransactionStatement
  | RemoveFilesStatement
  | SearchStatement;

export interface DynamicQueryStatement {
  t: "DynamicQuery";
  query: SqlExpression;
  resultTable: string;
  columnCount: number;
  columnMetaTable?: string;
}

export interface DynamicModifyStatement {
  t: "DynamicModify";
  sql: SqlExpression;
}

export interface DynamicQueryToCsv {
  t: "DynamicQueryToCsv";
  query: SqlExpression;
  scalar: string;
}

export interface App {
  name: string;
  displayName: string;
  pullConfig?: PullConfig;
  executionConfig?: AppDbExecutionConfig;
  domain?: string;
  loginHtml?: string;
  loginCss?: string;
  htmlHead: string;
  pwaManifest: object;
  css: string;
  defaultFallbackDelay?: number;
  collation?: Collation;
  autoTrim?: AutoTrim;
  immediateInitialRender?: boolean;
  tree: Node;
  deviceDb?: {
    defaultUniqueDistinctNulls?: boolean;
    tables: Table[];
  };
  navigationViewTransitionConfig?: NavigationViewTransitionConfig;
  globalRefreshConfig?: GlobalRefreshConfig;
}

export interface GlobalRefreshConfig {
  /**
   * This defines the behavior of the app when the window regains focus or has a visibilitychange.
   *
   * If set, it will increment the `global_refresh_key`
   * If not set, it will do nothing.
   */
  windowFocus?: GlobalRefreshWindowFocusConfig;
  /**
   * When doing polling pulls, we can see if there is a new transaction and if so this defines the behavior.
   *
   * If set, it will increment the `global_refresh_key`
   * If not set, it will do nothing.
   */
  pullTransactionChange?: GlobalRefreshPullTransactionChangeConfig;
}

export interface GlobalRefreshWindowFocusConfig {
  /**
   * Defines the view transition to use when doing the refresh, if desired
   */
  viewTransition?: SimpleViewTransitionConfig;
}

export interface GlobalRefreshPullTransactionChangeConfig {
  /**
   * Defines the view transition to use when doing the refresh, if desired
   */
  viewTransition?: SimpleViewTransitionConfig;
}

export interface NavigationViewTransitionConfig {
  link?: SimpleViewTransitionConfig;
  popstate?: PopstateViewTransitionConfig;
  statement?: SimpleViewTransitionConfig;
}

export interface PopstateViewTransitionConfig {
  timing: ViewTransitionTiming;
  forwardType: string;
  backwardType: string;
  otherType: string;
}

export interface SimpleViewTransitionConfig {
  timing: ViewTransitionTiming;
  type: string;
}

export type Node =
  | SqlExpression
  | (Node | null | undefined)[]
  | EachNode
  | IfNode
  | SwitchNode
  | StateNode
  | ModeNode
  | RouteNode
  | RoutesNode
  | PortalNode
  | ElementNode
  | QueryParamsNode
  | LineChartNode
  | BarChartNode
  | PieChartNode
  | DataGridNode
  | EventHandlersNode
  | SourceMapNode
  | RecursiveNode
  | RecurseNode;

export interface SourceMapNode {
  t: "SourceMap";
  source: string;
  children: Node;
}

export interface EachNode {
  t: "Each";
  table: string;
  recordName: string;
  where?: SqlExpression;
  orderBy?: string;
  key?: SqlExpression;
  children: Node;
}

export interface RecursiveNode {
  t: "Recursive";
  table: string;
  recordName: string;
  where?: SqlExpression;
  orderBy?: string;
  key?: SqlExpression;
  children: Node;
}

export interface RecurseNode {
  t: "Recurse";
  where: SqlExpression;
  recordName: string;
}

/**
 * Creates table to keep around a dom File, so it doesn't get garbage collected.
 *
 * Table is of the form:
 *  uuid: not null and type uuid
 *  data: nullable and type string, this has no meaning to us, but it can be used to help manage the files
 */
export interface FileRefTableStatement {
  t: "FileRefTable";
  name: string;
}

export type StateStatement =
  | IfStatement<StateStatement>
  | WhileStatement<StateStatement>
  | BlockStatement<StateStatement>
  | ForEachCursorStatement<StateStatement>
  | ForEachQueryStatement<StateStatement>
  | ForEachTableStatement<StateStatement>
  | TryStatement<StateStatement>
  | BaseStatement
  | DynamicQueryStatement
  | DynamicQueryToCsv
  | DynamicModifyStatement
  | FileRefTableStatement
  | GetWindowPropertyStatement
  | RequestStatement
  | SearchStatement;

export interface StateNode {
  t: "State";
  /**
   * Expressions to watch for changes, if any of these change, the state will be re-evaluated.
   *
   * Equality is as expected for most types, but null is considered equal to null.
   */
  watch?: SqlExpression[];
  /**
   * Expression that will be executed on the service determining if the current user is allowed to execute this
   * state node or any below.
   */
  allow?: SqlExpression;
  /**
   * Don't execute ancestor allows for this state node. Useful for an unauthorized branch below a state node with an allow
   */
  ignoreAncestorAllows?: boolean;
  procedure: StateStatement[];
  /** positive integer of miliseconds of delay */
  fallbackDelay?: SqlExpression;
  /** boolean, defaults to false */
  acceptOldResponses?: SqlExpression;
  /** boolean, defaults to false */
  longRunning?: SqlExpression;
  /**
   * Indicates the status of the state. Accessible in `children` nodes.
   *
   * This creates a scalar of type `enums.sys_state_status` with the following values:
   *
   * received: means that this has successfully ran
   * requested: means that we have tried to run this on the client, seen it needs something from the service
   *  and have requested it from the service.
   * delayed: means that due to the debounce config, we have delayed running this.
   * fallback_triggered: means that it has been requesting for longer than the fallbackDelay and we might want to show
   *  something else in the ui.
   * failed: means that the state has failed to run.
   * disallowed: means that the allow returned null or false
   */
  statusScalar?: string;
  /**
   * Creates an error record accessible in `children` nodes if this state failed.
   *
   * It has the following fields:
   *
   * type: not null and a value of enums.sys_error_type
   * message: nullable string
   * description: nullable string
   */
  errorRecord?: string;
  debounce?: StateDebounceConfig;
  children: Node;
}

export interface StateDebounceConfig {
  /** positive integer of miliseconds of delay */
  wait: SqlExpression;
  /** boolean, defaults to false */
  noWaitOnFirst?: SqlExpression;
  /** positive integer of miliseconds of delay */
  maxWait?: SqlExpression;
  /** boolean, defaults to false */
  leading?: SqlExpression;
  /** boolean, defaults to true */
  trailing?: SqlExpression;
}

export interface ModeNode {
  t: "Mode";
  render?: "'lazy'" | "'lazy_on_first'" | "'immediate'" | SqlExpression;
  children: Node;
}

export interface IfNode {
  t: "If";
  condition: SqlExpression;
  then?: Node;
  else?: Node;
}

export interface SwitchNode {
  t: "Switch";
  cases: SwitchNodeCase[];
}

export interface SwitchNodeCase {
  condition: SqlExpression;
  node?: Node;
}

export interface RouteNode {
  t: "Route";
  path: string;
  exact?: boolean;
  children: Node;
}

export interface RoutesNode {
  t: "Routes";
  children: RouteNode[];
}

export interface PortalNode {
  t: "Portal";
  children: Node;
}

export interface QueryParamsNode {
  t: "QueryParams";
  params: QueryParam[];
  children: Node;
}

export interface QueryParam {
  name: string;
  default?: SqlExpression;
  type: FieldType;
}

export interface LineChartNode {
  t: "LineChart";
  labels?: SqlQuery;
  series: ChartSeries[];
  classes: LineChartClasses;
  lineSmooth?: LineSmoothing;
  axisX?: AxisOpts;
  axisY?: AxisOpts;
  /** boolean */
  showLine?: SqlExpression;
  /** boolean */
  showPoint?: SqlExpression;
  /** boolean */
  showArea?: SqlExpression;
  /** boolean */
  areaBase?: SqlExpression;
  /** double */
  showGridBackground?: SqlExpression;
  /** double */
  low?: SqlExpression;
  /** double */
  high?: SqlExpression;
  /** double */
  referenceValue?: SqlExpression;
  chartPadding?: ChartPadding;
  /** boolean */
  fullWidth?: SqlExpression;
  /** boolean */
  reverseData?: SqlExpression;
  /** boolean */
  showPointLabel?: SqlExpression;
  /** Height of foreignObject for point label, defaults to 48 */
  pointLabelHeight?: SqlExpression;
  /** Width of foreignObject for point label, defaults to 48 */
  pointLabelWidth?: SqlExpression;
  /** x offset of foreignObject for point label, defaults to 24 */
  pointLabelXOffset?: SqlExpression;
  /** y offset of foreignObject for point label, defaults to 24 */
  pointLabelYOffset?: SqlExpression;
}

export interface ChartPadding {
  /** double */
  top?: SqlExpression;
  /** double */
  right?: SqlExpression;
  /** double */
  bottom?: SqlExpression;
  /** double */
  left?: SqlExpression;
}

export interface AxisOpts {
  /** double, The offset of the labels to the chart area */
  offset?: SqlExpression;
  /**
   * Position where labels are placed. Can be set to `start` or `end` where `start` is equivalent to left or top on vertical axis and `end` is equivalent to right or bottom on horizontal axis.
   */
  position?: "'start'" | "'end'" | SqlExpression;
  /**
   * double, Allows you to correct label positioning on this axis by positive or negative x offset.
   */
  labelOffsetX?: SqlExpression;
  /**
   * double, Allows you to correct label positioning on this axis by positive or negative y offset.
   */
  labelOffsetY?: SqlExpression;
  /** boolean */
  showLabel?: SqlExpression;
  /** boolean */
  showGrid?: SqlExpression;
  /**
   * Sql expression called to intercept value from axis label
   *
   * The expression is introduced two scalars into scope `label` (a string) and `index` (an int)
   */
  labelInterpolation?: SqlExpression;
  /**
   * What kind of axis this is.
   *
   * If not defined, 'step' will be used for the X-Axis, where the ticks option will be set to the labels in the data and the stretch option will be set to the global fullWidth option.
   */
  type?: "'auto'" | "'fixed'" | "'step'" | SqlExpression;
  /** double, Valid for fixed, auto axes  */
  high?: SqlExpression;
  /** double, Valid for fixed, auto axes  */
  low?: SqlExpression;
  /**
   * double, valid for auto type axes
   *
   * This option will be used when finding the right scale division settings.
   * The amount of ticks on the scale will be determined so that as many ticks as possible will be displayed, while not violating this minimum required space (in pixel).
   */
  scaleMinSpace?: SqlExpression;
  /**
   * boolean, auto type axes
   *
   * Can be set to true or false. If set to true, the scale will be generated with whole numbers only.
   */
  onlyInteger?: SqlExpression;
  /**
   * double, auto type axes
   *
   * The reference value can be used to make sure that this value will always be on the chart.
   * This is especially useful on bipolar charts where the bipolar center always needs to be part of the chart.
   */
  referenceValue?: SqlExpression;
  /**
   * double, fixed type axes
   *
   * If specified then the value range determined from minimum to maximum (or low and high) will be divided by this number and ticks will be generated at those division points.
   * The default divisor is 1.
   */
  divisor?: SqlExpression;
  /**
   * for fixed axes
   *
   * If ticks is explicitly set, then the axis will not compute the ticks with the divisor, but directly use the data in ticks to determine at what points on the axis a tick need to be generated.
   *
   * for step axes
   *
   * Ticks to be used to distribute across the axis length. As this axis type relies on the index of the value rather than the value, arbitrary data that can be converted to a string can be used as ticks.
   */
  ticks?: SqlQuery;
  /**
   * boolean, step type axes
   *
   * If set to true the full width will be used to distribute the values where the last value will be at the maximum of the axis length. If false the spaces between the ticks will be evenly distributed instead.
   */
  stretch?: SqlExpression;
}

export interface LineSmoothing {
  // none, simple, cardinal, monotoneCubic, step
  kind: SqlExpression;
  fillHoles?: SqlExpression;
  // cardinal
  tension?: SqlExpression;
  // simple
  divisor?: SqlExpression;
  // step
  postpone?: SqlExpression;
}

export interface ChartSeries {
  query: string;
  className?: string;
}

export interface LineChartClasses {
  root?: string;
  chart?: string;
  label?: string;
  pointLabel?: string;
  labelGroup?: string;
  series?: string;
  line?: string;
  downLine?: string;
  upLine?: string;
  equalLine?: string;
  point?: string;
  area?: string;
  grid?: string;
  gridGroup?: string;
  gridBackground?: string;
  vertical?: string;
  horizontal?: string;
  start?: string;
  end?: string;
}

export interface BarChartNode {
  t: "BarChart";
  labels?: string;
  series: ChartSeries[];
  classes: BarChartClasses;
  low?: string;
  high?: string;
  referenceValue?: string;
  chartPadding?: ChartPadding;
  reverseData?: string;
  axisX?: AxisOpts;
  axisY?: AxisOpts;
  showGridBackground?: string;
  seriesBarDistance?: string;
  stackBars?: string;
  stackMode?: string;
  horizontalBars?: string;
  distributeSeries?: string;
}

export interface BarChartClasses {
  root?: string;
  horizontalBars?: string;
  chart?: string;
  label?: string;
  labelGroup?: string;
  series?: string;
  bar?: string;
  grid?: string;
  gridGroup?: string;
  gridBackground?: string;
  vertical?: string;
  horizontal?: string;
  start?: string;
  end?: string;
}

export interface PieChartNode {
  t: "PieChart";
  labels?: SqlQuery;
  series: SqlQuery;
  classes: PieChartClasses;
  low?: SqlExpression;
  high?: SqlExpression;
  referenceValue?: SqlExpression;
  chartPadding?: SqlExpression;
  startAngle?: SqlExpression;
  total?: SqlExpression;
  donut?: SqlExpression;
  donutWidth?: SqlExpression;
  showLabel?: SqlExpression;
  /**
   * Label position offset from the standard position which is half distance of the radius.
   * This value can be either positive or negative. Positive values will position the label away from the center.
   */
  labelOffset?: SqlExpression;
  /**
   * This option can be set to 'inside', 'outside' or 'center'. Positioned with 'inside' the labels will be
   * placed on half the distance of the radius to the border of the Pie by respecting the 'labelOffset'.
   * The 'outside' option will place the labels at the border of the pie and 'center' will place the labels in the absolute center point of the chart.
   * The 'center' option only makes sense in conjunction with the 'labelOffset' option.
   */
  labelPosition?: "'inside'" | "'outside'" | "'center'" | SqlExpression;
  /**
   * Label direction can be 'neutral', 'explode' or 'implode'. The labels anchor will be positioned based on those settings
   * as well as the fact if the labels are on the right or left side of the center of the chart. Usually explode
   * is useful when labels are positioned far away from the center.
   */
  labelDirection?: "'neutral'" | "'explode'" | "'implode'" | SqlExpression;
  ignoreEmptyValues?: string;
  labelInterpolation?: string;
}

export interface PieChartClasses {
  root?: string;
  chartPie?: string;
  chartDonut?: string;
  series?: string;
  slicePie?: string;
  sliceDonut?: string;
  label?: string;
}

export interface DataGridNode {
  t: "DataGrid";
  classes: DataGridClasses;
  table: string;
  tableKey?: SqlExpression;

  columns: DataGridColumn[];
  on: DataGridEventHandlers;
  recordName: string;

  headerHeight: SqlExpression;
  rowHeight: SqlExpression;
  focusedRow: SqlExpression;
  focusedColumn: SqlExpression;
  shouldFocusCell: SqlExpression;
}

export interface DataGridClasses {
  root?: string;
  row?: string;
  cell?: string;
  headerCell?: string;
  header?: string;
}

export interface DataGridEventHandlers {
  keyboardNavigation: EventHandler;
  cellClick: EventHandler;
  cellDoubleClick?: EventHandler;
  cellKeydown?: EventHandler;
  fetchMore?: EventHandler;
}

export interface DataGridColumn {
  header: Node;
  cell: Node;
  width: SqlExpression;
  visible?: SqlExpression;
  ordering?: SqlExpression;
}

export interface EventHandlerObject {
  procedure: DomProcStatement[];
  /**
   * This indicates that the event handler should not be aborted when the node
   * is removed.
   *
   * By default, when a node is removed, all event handlers associated with it
   * are aborted. This is to prevent memory leaks.
   */
  detachedFromNode?: boolean;
  disableAutoUiCommit?: boolean;
}

export type EventHandler = EventHandlerObject | DomProcStatement[];

export type ElementProps = Partial<
  Record<AllHtmlPropNames | SvgPropNames, SqlExpression>
>;
export type ElementEventHandlers = Partial<
  Record<EventHandlerName, EventHandler>
>;

export interface FloatingOpts {
  anchorEl: SqlExpression;
  placement:
    | "'top'"
    | "'top-start'"
    | "'top-end'"
    | "'right'"
    | "'right-start'"
    | "'right-end'"
    | "'bottom'"
    | "'bottom-start'"
    | "'bottom-end'"
    | "'left'"
    | "'left-start'"
    | "'left-end'"
    | SqlExpression;
  strategy: "'absolute'" | "'fixed'" | SqlExpression;
  offset?: {
    mainAxis: SqlExpression;
    crossAxis: SqlExpression;
  };
  flip?: {
    mainAxis: SqlExpression;
    crossAxis: SqlExpression;
  };
  shift?: {
    mainAxis: SqlExpression;
    crossAxis: SqlExpression;
  };
  arrow?: { elementId: SqlExpression };
}

export interface ScrollLockOpts {
  enabled: SqlExpression;
  reserveScrollBarGap?: SqlExpression;
}

export interface DynamicClass {
  classes: string;
  condition: SqlExpression;
}

/** Represents an html or svg element */
export interface ElementNode {
  t: "Element";
  tag: AllHtmlTags;
  focusLock?: {};
  floating?: FloatingOpts;
  scrollLock?: ScrollLockOpts;
  classes?: string;
  dynamicClasses?: DynamicClass[];
  style?: Record<string, SqlExpression>;
  props?: ElementProps;
  on?: ElementEventHandlers;
  children?: Node;
}

export interface EventHandlersNode {
  t: "EventHandlers";
  window?: ElementEventHandlers;
  document?: ElementEventHandlers;
  mount?: EventHandler;
}

//
// Request
//

export interface RequestStatement {
  t: "Request";
  uri: SqlExpression;
  method: "'GET'" | "'POST'" | "'DELETE'" | "'PUT'" | "'PATCH'" | SqlExpression;
  headers?: { name: SqlExpression; value: SqlExpression }[];
  sendBody?: SendBody;
  receiveBody?: ReceiveBody;
  /**
   * The name of the record for the response information.
   *
   * It has the following fields:
   *
   * status: number (the status code)
   */
  responseRecord?: string;
  /**
   * The name of the table for the response headers.
   *
   * It has the following fields:
   *
   * name: string
   * value: string
   */
  responseHeadersTable?: string;
}

export type SendBody =
  | { type: "Text"; expr: SqlExpression }
  | { type: "Json"; expr: SqlExpression };

export type ReceiveBody =
  | { type: "Text"; scalar: string }
  | { type: "Json"; scalar: string };

//
// API
//

export type EndpointMethod = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";

export interface ApiEndpoint {
  path: string;
  method: EndpointMethod;
  query?: {
    name: string;
    default?: SqlExpression;
    type: FieldType;
  }[];
  body?: ReceiveBody;
  procedure?: ApiEndpointStatement[];
}

export interface SetHttpStatusStatement {
  t: "SetHttpStatus";
  status: SqlExpression;
}

export interface GetHeaderStatement {
  t: "GetHeader";
  name: SqlExpression;
  scalar: string;
}

export interface SetHeaderStatement {
  t: "SetHeader";
  name: SqlExpression;
  value: SqlExpression;
}

export type ApiEndpointStatement =
  | IfStatement<ApiEndpointStatement>
  | WhileStatement<ApiEndpointStatement>
  | BlockStatement<ApiEndpointStatement>
  | ForEachCursorStatement<ApiEndpointStatement>
  | ForEachQueryStatement<ApiEndpointStatement>
  | ForEachTableStatement<ApiEndpointStatement>
  | TryStatement<ApiEndpointStatement>
  | BaseStatement
  | SetHttpStatusStatement
  | DynamicModifyStatement
  | DynamicQueryStatement
  | DynamicQueryToCsv
  | StartTransactionStatement
  | CommitTransactionStatement
  | RequestStatement
  | UndoTx
  | UserStatement
  | RemoveFilesStatement
  | SearchStatement
  | GetHeaderStatement
  | SetHeaderStatement;

export interface AppApi {
  endpoints: ApiEndpoint[];
}

///
/// SCRIPT
///

export interface ScriptDb {
  name: string;
  db: Database;
  mapping?: DatabaseMapping;
}

export interface Script {
  name: string;
  procedure: ScriptStatement[];
}

export interface ImportCsvStatement {
  t: "ImportCsv";
  db: string;
  dir: string;
}

export interface SaveDbToDirStatement {
  t: "SaveDbToDir";
  db?: string;
  dir: string;
}

export interface LoadDbFromDirStatement {
  t: "LoadDbFromDir";
  db?: string;
  dir: string;
  /**
   * When loading another db, you can choose to load the db with a prefix for the enums as enums
   * are in a global namespace. This allows you to load a database that has the same enums as your
   * current database without overwriting them.
   */
  prefixEnums?: string;
}

export interface PullStatement {
  t: "Pull";
  dir?: string;
  /**
   * @default true
   *
   * Whether or not to load the database into memory after pulling it from the server.
   * This is useful when you have made backwards incompatible changes to the database and
   * want to still download the database
   */
  loadIntoMemory?: boolean;
}

export interface PushStatement {
  t: "Push";
}

export interface AddUsersStatement {
  t: "AddUsers";
  app: string;
  /**
   * Query for the users that should be added to yolm's authentication system.
   *
   * Expects a query with the folloiwng fields:
   *
   * eamil: string (email of the user, will be sent an email and invited to yolm)
   * notification_type: string (either "none" or "new_app" or "user")
   */
  query: SqlQuery;
  /**
   * The name of the table that should be created to store the users that have been added.
   *
   * It has the following fields:
   *
   * global_id: uuid (id of the user in yolm's authentication system)
   */
  outputTable?: string;
}

export interface UpdateUsersStatement {
  t: "UpdateUsers";
  app: string;
  query: SqlQuery;
}

export interface RemoveUsersStatement {
  t: "RemoveUsers";
  app: string;
  query: SqlQuery;
}

export type UserStatement =
  | AddUsersStatement
  | UpdateUsersStatement
  | RemoveUsersStatement;

export interface RemoveFilesStatement {
  t: "RemoveFiles";
  query: SqlQuery;
}

export interface UploadDbStatement {
  t: "UploadDb";
  allowOverwrite?: boolean;
}

export interface ScriptCommitTransactionStatement {
  t: "CommitTransaction";
  db: string;
}

export interface ScriptStartTransactionDbStatement {
  t: "StartTransaction";
  db: string;
}

export interface ScriptRollbackTransactionStatement {
  t: "RollbackTransaction";
  db: string;
}

export interface ExportQueryToCsvStatement {
  t: "ExportQueryToCsv";
  query: SqlQuery;
  file: string;
}

export interface DownloadBackupStatement {
  t: "DownloadBackup";
  version?: SqlExpression;
  dir: string;
}

export type ScriptStatement =
  | BaseStatement
  | IfStatement<ScriptStatement>
  | WhileStatement<ScriptStatement>
  | BlockStatement<ScriptStatement>
  | ForEachCursorStatement<ScriptStatement>
  | ForEachQueryStatement<ScriptStatement>
  | ForEachTableStatement<ScriptStatement>
  | TryStatement<ScriptStatement>
  | RemoveFilesStatement
  | UserStatement
  | SaveDbToDirStatement
  | UploadDbStatement
  | LoadDbFromDirStatement
  | ImportCsvStatement
  | PullStatement
  | PushStatement
  | ScriptCommitTransactionStatement
  | ScriptStartTransactionDbStatement
  | ScriptRollbackTransactionStatement
  | ExportQueryToCsvStatement
  | DownloadBackupStatement;

///
/// TEST
///

interface BaseTestData {
  name: string;
}

export interface TestDataPath extends BaseTestData {
  /** Path to directory containing data.db, map.json to load */
  dir: string;
}

export interface TestDataProcedure extends BaseTestData {
  time: string;
  /** Use this procedure to intialize the database */
  procedure: BasicStatement[];
}

export type TestData = TestDataPath | TestDataProcedure;

export type Body =
  | { type: "Text"; text: string }
  | { type: "Json"; value: any };

export interface AssertApi {
  t: "AssertApi";
  path: string;
  method: EndpointMethod;
  requestHeaders?: { name: string; value: string }[];
  status: number;
  response?: Body;
  body?: Body;
  responseHeaders?: { name: string; value: string }[];
}

export interface AssertQuery {
  t: "AssertQuery";
  query: SqlQuery;
  csv: string;
}

export type ApiTestStatment =
  | IfStatement<ApiTestStatment>
  | WhileStatement<ApiTestStatment>
  | BlockStatement<ApiTestStatment>
  | ForEachCursorStatement<ApiTestStatment>
  | ForEachQueryStatement<ApiTestStatment>
  | ForEachTableStatement<ApiTestStatment>
  | TryStatement<ApiTestStatment>
  | BaseStatement
  | AssertApi
  | AssertQuery;

export interface ApiTest {
  time: string;
  skip?: boolean;
  only?: boolean;
  seed?: number;
  name: string;
  data: string;
  procedure: ApiTestStatment[];
}

export interface TestModel {
  data: TestData[];
  api?: ApiTest[];
}

///
/// Mapping file
///

export interface DatabaseMapping {
  version: number;
  tables: Record<string, TableMapping>;
  enums: Record<string, EnumMapping>;
}

export interface TableMapping {
  id: number;
  primaryKeyFieldName: string;
  fields: Record<string, FieldMapping>;
}

export interface FieldMapping {
  id: number;
  type: MappingFieldType;
  notNull: boolean;
}

export interface EnumMapping {
  values: Record<string, number>;
}

export type MappingFieldType =
  | { type: "TinyUint" }
  | { type: "SmallUint" }
  | { type: "Uint" }
  | { type: "BigUint" }
  | { type: "TinyInt" }
  | { type: "SmallInt" }
  | { type: "Int" }
  | { type: "BigInt" }
  | { type: "Real" }
  | { type: "Double" }
  | { type: "Decimal"; precision: number; scale: number; signed: boolean }
  | { type: "Ordering" }
  | {
      type: "String";
      maxLength: number;
      minLength: number;
      maxBytesPerChar: number;
    }
  | { type: "Uuid" }
  | { type: "Date" }
  | { type: "Time" }
  | { type: "Timestamp" }
  | { type: "ForeignKey"; table: string }
  | { type: "Tx" }
  | { type: "Enum"; enum: string }
  | { type: "Bool" }
  | { type: "Json" };
