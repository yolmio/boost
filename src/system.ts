import * as yom from "./yom";
import { Theme } from "./theme";
import { createTheme, ThemeOpts } from "./createTheme";
import {
  camelize,
  normalizeCase,
  pluralize,
  upcaseFirst,
} from "./utils/inflectors";
import {
  ApiTestStatements,
  ApiTestStatementsOrFn,
  BasicStatements,
  BasicStatementsOrFn,
  DomStatements,
  DomStatementsOrFn,
  EndpointStatements,
  EndpointStatementsOrFn,
  ScriptStatements,
  ScriptStatementsOrFn,
  StateStatementsOrFn,
} from "./statements";
import { ident, stringLiteral } from "./utils/sqlHelpers";
import { Style, StyleObject } from "./styleTypes";
import { WebAppManifest } from "./pwaManifest";
import { navbarShell, NavbarProps } from "./shells/navbar";
import { Node, RouteNode, RoutesNode } from "./nodeTypes";
import { dashboardGridPage, DashboardGridBuilder } from "./pages/dashboardGrid";
import { recordGridPage, RecordGridBuilder } from "./pages/recordGrid";
import { dbManagementPage, DbManagmentPageOpts } from "./pages/dbManagement";
import { insertFormPage, InsertFormPageOpts } from "./pages/insertForm";
import { SimpleReportsPageBuilder } from "./pages/simpleReportPage";
import {
  simpleDatagridPage,
  SimpleDatagridPageBuilder,
} from "./pages/simpleDatagrid";
import {
  createDatagridPageNode,
  datagridPage,
  DatagridPageBuilder,
} from "./pages/datagrid";
import { updateFormPage, UpdateFormPage } from "./pages/updateForm";
import {
  multiCardInsertPage,
  MultiCardInsertPageOpts,
} from "./pages/multiCardInsert";
import { ComponentOpts } from "./components/types";
import { addMigrationScript, MigrationScriptOpts } from "./migrate";
import { KeyFrames, NodeTransformer } from "./nodeTransform";
import { SequentialIDGenerator } from "./utils/SequentialIdGenerator";
import { escapeHtml } from "./utils/escapeHtml";
import { default404Page } from "./pages/default404";
import { snackbar, SnackbarOpts } from "./components";
import { nodes } from "./nodeHelpers";

/**
 * The app singleton.
 *
 * This is where everything about the app is configured, the database, the ui, the api, everything.
 */
export class System {
  /**
   * The name of the application it will show up at: yolm.app/{YOUR_ACCOUNT_NAME}/{APP_NAME}
   *
   * It needs to be unique within an account
   */
  name = "please-rename";
  region?: yom.Region;
  replicas: yom.Replica[] = [];
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
  collation = "NoCase" as yom.Collation;
  autoTrim = "None" as yom.AutoTrim;
  vcpus: yom.VCpus = 1;
  memoryMb: yom.MemoryMb = 1024;
  fileSizeGb: number = 1;
  db: Db = new Db();
  apps: Record<string, App> = {};
  api: Api = new Api();
  enums: Record<string, Enum> = {};
  recordRuleFunctions: Record<string, RecordRuleFn> = {};
  ruleFunctions: Record<string, RuleFunction> = {};
  scalarFunctions: Record<string, ScalarFunction> = {};
  tableFunctions: Record<string, TableFunction> = {};
  test = new Test();
  scripts: yom.Script[] = [];
  scriptDbs: ScriptDb[] = [];
  currentAppName?: string;

  get currentApp() {
    return this.currentAppName ? this.apps[this.currentAppName] : undefined;
  }

  addApp(name: string, displayName: string): App {
    this.apps[name] = new App(name, displayName);
    this.currentAppName = name;
    return this.apps[name];
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
    const displayName = system.displayNameConfig.enum(enum_.name);
    const values = enum_.values.map((v) => {
      if (typeof v === "string") {
        return { name: v, displayName: system.displayNameConfig.enumValue(v) };
      }
      return {
        displayName: system.displayNameConfig.enumValue(v.name),
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
    system.enums[enum_.name] = modelEnum;
    if (!enum_.disableDisplayRfn) {
      modelEnum.getDisplayName = (v) => `rfn.display_${enum_.name}(${v})`;
    }
  }

  addScriptDbDefinition(
    name: string,
    f: (builder: ScriptDbDefinition) => void,
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

  generateYom(): yom.Model {
    if (!system.db.tables[system.db.userTableName]) {
      system.db.addTable(system.db.userTableName, (t) => {
        t.catalog.addRequiredUserFields();
      });
    }
    const apps = Object.values(this.apps).map((app) => app.generateYom());
    if (system.name === "please-rename") {
      console.log();
      console.warn(
        "You should rename your system from 'please-rename' to something else.",
      );
      console.warn(
        "Unless you really want to use the name 'please-rename' for your system.",
      );
      console.log();
    }
    return {
      // todo make this part of the model
      locale: "en_us",
      region: (this.region ?? "not-set") as any,
      replicas: this.replicas,
      name: this.name,
      vcpus: this.vcpus,
      memoryMb: this.memoryMb,
      fileSizeGb: this.fileSizeGb,
      collation: this.collation,
      db: this.db.generateYom(),
      recordRuleFunctions: Object.values(this.recordRuleFunctions).map(
        generateRecordRuleFn,
      ),
      ruleFunctions: Object.values(this.ruleFunctions).map(generateRuleFn),
      scalarFunctions: Object.values(this.scalarFunctions).map(
        generateScalarFunction,
      ),
      enums: Object.values(this.enums).map((e) => ({
        name: e.name,
        renameFrom: e.renameFrom,
        description: e.description,
        values: Object.values(e.values).map((v) => ({
          name: v.name,
          renameFrom: v.renameFrom,
          description: v.description,
        })),
      })),
      apps,
      scripts: this.scripts,
      api: this.api.generateYom(),
      test: this.test.generateYom(),
      scriptDbs: this.scriptDbs.map((db) => {
        if (db.definition.type === "MappingFile") {
          return { name: db.name, definition: db.definition };
        } else {
          return {
            name: db.name,
            definition: {
              type: "Model",
              db: {
                enableTransactionQueries: false,
                tables: Object.values(db.definition.db.tables).map((t) =>
                  t.generateYom(),
                ),
              },
            },
          };
        }
      }),
    };
  }
}

function defaultGetDisplayName(sqlName: string) {
  return upcaseFirst(normalizeCase(sqlName).join(" "));
}

interface CrossPageSnackbar {
  node: Node;
  stateProc?: StateStatementsOrFn;
}

export interface CrossPageSnackbarOpts {
  componentOpts: (close: BasicStatements) => SnackbarOpts;
  rootStateProc?: StateStatementsOrFn;
  autoHideDuration?: number;
}

export interface CustomCrossPageSnackbarOpts {
  node: Node;
  rootStateProc?: StateStatementsOrFn;
  autoHideDuration?: number;
}

export interface CrossPageSnackbarControls {
  openSnackbar: DomStatements;
  openSnackbarWithoutDelayedClose: BasicStatements;
  delayedCloseSnackbar: DomStatements;
  closeSnackbar: BasicStatements;
}

export class App {
  /**
   * The title of the html document for this application
   */
  title = "please-rename";
  webAppConfig: WebAppConfig = {
    htmlHead: "",
    viewport: `width=device-width, initial-scale=1`,
    logoGeneration: { type: "Default" },
    manifest: {},
  };
  deviceDb = new DeviceDb();
  pollingPullConfig?: yom.PollingPullConfig;
  executionConfig?: yom.AppDbExecutionConfig;
  theme: Theme = createTheme();
  shell?: (pages: Node) => Node;
  pages: Page[] = [];

  #globalStyles: StyleObject[] = [];
  #keyframeIdGen = new SequentialIDGenerator();
  #keyFrames: Map<KeyFrames, string> = new Map();
  #crosspageSnackbars: CrossPageSnackbar[] = [];

  constructor(public name: string, public displayName: string) {}

  //
  // Helper methods
  //

  setTheme(themeOptions: ThemeOpts) {
    this.theme = createTheme(themeOptions);
  }

  addGlobalStyle(style: StyleObject) {
    this.#globalStyles.push(style);
  }

  registerKeyframes(keyframes: KeyFrames) {
    if (this.#keyFrames.has(keyframes)) {
      return this.#keyFrames.get(keyframes)!;
    }
    const id = this.#keyframeIdGen.next();
    this.#keyFrames.set(keyframes, id);
    return id;
  }

  registerCrossPageSnackbar(
    opts: CrossPageSnackbarOpts,
  ): CrossPageSnackbarControls {
    const closeSnackbar = new BasicStatements().setScalar(
      "crosspage_snackbar_open",
      "null",
    );
    return this.registerCrossPageCustomSnackbar({
      node: snackbar(opts.componentOpts(closeSnackbar)),
      ...opts,
    });
  }

  registerCrossPageCustomSnackbar(
    opts: CustomCrossPageSnackbarOpts,
  ): CrossPageSnackbarControls {
    const i = this.#crosspageSnackbars.length;
    const closeSnackbar = new BasicStatements().setScalar(
      "crosspage_snackbar_open",
      "null",
    );
    this.#crosspageSnackbars.push({
      node: opts.node,
      stateProc: opts.rootStateProc,
    });
    const delayedClose =
      typeof opts.autoHideDuration === "number"
        ? new DomStatements().spawn({
            detached: true,
            procedure: (s) =>
              s
                .delay(opts.autoHideDuration!.toString())
                .if(`crosspage_snackbar_open = ${i}`, (s) =>
                  s.statements(closeSnackbar).commitUiTreeChanges(),
                ),
          })
        : new DomStatements().statements(closeSnackbar);
    return {
      openSnackbar: new DomStatements()
        .setScalar("crosspage_snackbar_open", i.toString())
        .conditionalStatements(
          typeof opts.autoHideDuration === "number",
          delayedClose,
        ),
      openSnackbarWithoutDelayedClose: new BasicStatements().setScalar(
        "crosspage_snackbar_open",
        i.toString(),
      ),
      closeSnackbar,
      delayedCloseSnackbar: delayedClose,
    };
  }

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
    fn: (builder: RecordGridBuilder) => unknown,
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
    f: (f: SimpleDatagridPageBuilder) => unknown,
  ) {
    simpleDatagridPage(table, f);
  }

  addDatagridPage(table: string, f: (f: DatagridPageBuilder) => unknown) {
    datagridPage(table, f);
  }

  createDatagridPageNode(
    table: string,
    f: (f: DatagridPageBuilder) => unknown,
  ) {
    return createDatagridPageNode(table, f);
  }

  generateYom(): yom.AppModel {
    if (!this.pages.some((p) => p.path === "/*" || p.path === "*")) {
      this.pages.push({
        path: "*",
        content: default404Page(),
      });
    }
    const pagesWithShell = this.pages
      .filter((p) => !p.ignoreShell)
      .map(
        (p) =>
          ({
            t: "Route",
            path: p.path,
            children: p.content,
          } as RouteNode),
      );
    const pagesWithoutShell = this.pages
      .filter((p) => p.ignoreShell)
      .map(
        (p) =>
          ({
            t: "Route",
            path: p.path,
            children: p.content,
          } as RouteNode),
      );
    let rootNode: Node;
    if (this.shell) {
      const shell = this.shell({
        t: "Routes",
        children: pagesWithShell,
      });
      rootNode =
        pagesWithoutShell.length === 0
          ? shell
          : ({
              t: "Routes",
              children: [
                ...pagesWithoutShell,
                { t: "Route", path: "*", children: shell },
              ],
            } as RoutesNode);
    } else {
      rootNode = {
        t: "Routes",
        children: [...pagesWithShell, ...pagesWithoutShell],
      };
    }
    if (this.#crosspageSnackbars.length !== 0) {
      rootNode = [
        rootNode,
        nodes.switch(
          ...this.#crosspageSnackbars.map((s, i) => ({
            condition: `crosspage_snackbar_open = ${i}`,
            node: s.node,
          })),
        ),
      ];
      for (const snackbar of this.#crosspageSnackbars) {
        if (snackbar.stateProc) {
          rootNode = nodes.state({
            procedure: snackbar.stateProc,
            children: rootNode,
          });
        }
      }
      rootNode = nodes.state({
        procedure: (s) =>
          s.scalar("crosspage_snackbar_open", { type: "SmallUint" }),
        children: rootNode,
      });
    }
    const transformer = new NodeTransformer(
      this,
      this.#keyFrames,
      this.#globalStyles,
    );
    const tree = transformer.transformNode(rootNode);
    let htmlHead = this.webAppConfig.htmlHead;
    if (this.title) {
      htmlHead += `<title>${escapeHtml(this.title)}</title>`;
    }
    if (this.webAppConfig.viewport) {
      htmlHead += `<meta name="viewport" content="${escapeHtml(
        this.webAppConfig.viewport,
      )}">`;
    }
    switch (this.webAppConfig.logoGeneration.type) {
      case "Default":
        htmlHead += `
  <link rel="apple-touch-icon" sizes="180x180" href="/global_assets/logo/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/global_assets/logo/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/global_assets/logo/favicon-16x16.png">
  <link rel="mask-icon" href="/global_assets/logo/safari-pinned-tab.svg" color="#5a35a3">
  <link rel="shortcut icon" href="/global_assets/logo/favicon.ico">
  <meta name="msapplication-TileColor" content="#00aba9">
  <meta name="theme-color" content="#ffffff">`;
        break;
      case "App":
        htmlHead += `
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/logo/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/logo/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/logo/favicon-16x16.png">
  <link rel="mask-icon" href="/assets/logo/safari-pinned-tab.svg" color="${this.webAppConfig.logoGeneration.safariPinnedTabColor}">
  <link rel="shortcut icon" href="/assets/logo/favicon.ico">
  <meta name="msapplication-TileColor" content="${this.webAppConfig.logoGeneration.msTileColor}">
  <meta name="theme-color" content="${this.webAppConfig.logoGeneration.themeColor}">`;
        break;
      case "Account":
        htmlHead += `
  <link rel="apple-touch-icon" sizes="180x180" href="/account_assets/logo/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/account_assets/logo/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/account_assets/logo/favicon-16x16.png">
  <link rel="mask-icon" href="/account_assets/logo/safari-pinned-tab.svg" color="${this.webAppConfig.logoGeneration.safariPinnedTabColor}">
  <link rel="shortcut icon" href="/account_assets/logo/favicon.ico">
  <meta name="msapplication-TileColor" content="${this.webAppConfig.logoGeneration.msTileColor}">
  <meta name="theme-color" content="${this.webAppConfig.logoGeneration.themeColor}">`;
        break;
      case "Custom":
        break;
    }
    if (!this.webAppConfig.manifest.name) {
      this.webAppConfig.manifest.name = this.displayName;
    }
    return {
      name: this.name,
      displayName: this.displayName,
      pwaManifest: this.webAppConfig.manifest,
      pollingPullConfig: this.pollingPullConfig,
      executionConfig: this.executionConfig,
      htmlHead: htmlHead,
      tree,
      css: transformer.getCss(),
      deviceDb: {
        tables: Object.values(this.deviceDb.tables).map((t) => t.generateYom()),
      },
    };
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

  generateYom(): yom.Database {
    return {
      userTableName: system.db.userTableName,
      collation: system.db.collation,
      autoTrim: system.db.autoTrim,
      enableTransactionQueries: system.db.enableTransactionQueries,
      recordRuleFunctions: Object.values(system.db.recordRuleFunctions).map(
        generateRecordRuleFn,
      ),
      ruleFunctions: Object.values(system.db.ruleFunctions).map(generateRuleFn),
      scalarFunctions: Object.values(system.db.scalarFunctions).map(
        generateScalarFunction,
      ),
      tables: Object.values(system.db.tables).map((t) => t.generateYom()),
      searchMatches: Object.values(system.db.searchMatches),
    };
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

export class Api {
  #endpoints: yom.ApiEndpoint[] = [];

  get(path: string, helper: GetEndpointHelper) {
    this.#endpoints.push({
      method: "GET",
      path,
      procedure: EndpointStatements.normalizeToArray(helper.procedure),
      query: helper.query,
    });
  }

  #addEndpoint(
    method: yom.EndpointMethod,
    path: string,
    helper: EndpointHelper,
  ) {
    this.#endpoints.push({
      method,
      path,
      body: helper.jsonBodyScalar
        ? { type: "Json", scalar: helper.jsonBodyScalar }
        : helper.textBodyScalar
        ? { type: "Text", scalar: helper.textBodyScalar }
        : undefined,
      procedure: EndpointStatements.normalizeToArray(helper.procedure),
      query: helper.query,
    });
  }

  post(path: string, helper: EndpointHelper) {
    this.#addEndpoint("POST", path, helper);
  }

  put(path: string, helper: EndpointHelper) {
    this.#addEndpoint("PUT", path, helper);
  }

  patch(path: string, helper: EndpointHelper) {
    this.#addEndpoint("PATCH", path, helper);
  }

  delete(path: string, helper: EndpointHelper) {
    this.#addEndpoint("DELETE", path, helper);
  }

  generateYom(): yom.AppApi {
    return { endpoints: this.#endpoints };
  }
}

export interface GetEndpointHelper {
  query?: yom.QueryParam[];
  procedure: EndpointStatementsOrFn;
}

export interface EndpointHelper {
  query?: yom.QueryParam[];
  jsonBodyScalar?: string;
  textBodyScalar?: string;
  procedure: EndpointStatementsOrFn;
}

export class Test {
  #data: yom.TestData[] = [];
  #api: yom.ApiTest[] = [];

  addTestDataProc(name: string, time: Date, procedure: BasicStatementsOrFn) {
    this.#data.push({
      name,
      time: time.toISOString(),
      procedure: BasicStatements.normalizeToArray(procedure),
    });
  }

  addTestDataDir(name: string, dir: string) {
    this.#data.push({
      name,
      dir,
    });
  }

  addApiTest(helper: ApiTestHelper) {
    this.#api.push({
      name: helper.name,
      time: helper.time.toISOString(),
      seed: helper.seed,
      skip: helper.skip,
      only: helper.only,
      data: helper.data,
      procedure: ApiTestStatements.normalizeToArray(helper.procedure),
    });
  }

  generateYom(): yom.TestModel {
    return {
      data: this.#data,
      api: this.#api,
    };
  }
}

export interface ApiTestHelper {
  name: string;
  time: Date;
  seed?: number;
  skip?: boolean;
  only?: boolean;
  data: string;
  procedure: ApiTestStatementsOrFn;
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
    newLabel: string,
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
    public displayName: string,
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
      ...displayNameFn.fields.map((f) => `${record ?? this.identName}.${f}`),
    );
  }

  /**
   * Get the field which is a foreign key to the given table, if any.
   *
   * Returns the first foreign key field found.
   */
  getFkFieldToTable(table: string): ForeignKeyField | undefined {
    return Object.values(this.fields).find(
      (f) => f.type === "ForeignKey" && f.table === table,
    ) as ForeignKeyField | undefined;
  }

  generateYom(): yom.Table {
    const checks = this.checks.map((c) => c.check(c.fields));
    const fields = Object.values(this.fields).map((f): yom.TableField => {
      for (const check of f.checks) {
        checks.push(check.check(f.name));
      }
      return {
        name: f.name,
        renameFrom: f.renameFrom,
        notNull: f.notNull,
        default: f.default,
        indexed: f.indexed,
        type: f.generateYomFieldType(),
      };
    });
    return {
      primaryKeyFieldName: this.primaryKeyFieldName,
      name: this.name,
      renameFrom: this.renameFrom,
      uniqueConstraints: this.uniqueConstraints,
      checks,
      fields,
    };
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

  abstract generateYomFieldType(): yom.FieldType;
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

  generateYomFieldType(): yom.FieldType {
    return {
      type: "String",
      maxLength: this.maxLength,
      maxBytesPerChar: this.maxBytesPerChar,
      collation: this.collation,
      autoTrim: this.autoTrim,
      minLength: this.minLength,
    };
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

  generateYomFieldType(): yom.FieldType {
    return { type: "TinyUint" };
  }
}
export class SmallUintField extends IntegerFieldBase {
  type = "SmallUint" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "SmallUint" };
  }
}
export class UintField extends IntegerFieldBase {
  type = "Uint" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "Uint" };
  }
}
export class BigUintField extends IntegerFieldBase {
  type = "BigUint" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "BigUint" };
  }
}
export class TinyIntField extends IntegerFieldBase {
  type = "TinyInt" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "TinyInt" };
  }
}
export class SmallIntField extends IntegerFieldBase {
  type = "SmallInt" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "SmallInt" };
  }
}
export class IntField extends IntegerFieldBase {
  type = "Int" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "Int" };
  }
}
export class BigIntField extends IntegerFieldBase {
  type = "BigInt" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "BigInt" };
  }
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

  generateYomFieldType(): yom.FieldType {
    return { type: "Real" };
  }
}
export class DoubleField extends NumericFieldBase {
  type = "Double" as const;
  isVariablePrecision(): boolean {
    return true;
  }

  generateYomFieldType(): yom.FieldType {
    return { type: "Double" };
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
    public signed: boolean,
  ) {
    super(name, displayName);
  }

  generateYomFieldType(): yom.FieldType {
    return {
      type: "Decimal",
      precision: this.precision,
      scale: this.scale,
      signed: this.signed,
    };
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

  generateYomFieldType(): yom.FieldType {
    return { type: "Date" };
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

  generateYomFieldType(): yom.FieldType {
    return { type: "Time" };
  }
}

export class TimestampField extends FieldBase {
  type = "Timestamp" as const;
  formatString?: string;

  formatExpr(expr: yom.SqlExpression): yom.SqlExpression {
    const formatString = stringLiteral(
      this.formatString ?? "%-d %b %Y %l:%M%p",
    );
    return `format.date(${expr}, ${formatString})`;
  }

  generateYomFieldType(): yom.FieldType {
    return { type: "Timestamp" };
  }
}

export class TxField extends FieldBase {
  type = "Tx" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "Tx" };
  }
}

export class NuvaIdField extends FieldBase {
  type = "NuvaId" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "NuvaId" as any };
  }
}

export interface BoolEnumLikeConfig {
  null?: string;
  false: string;
  true: string;
}

export class BoolField extends FieldBase {
  type = "Bool" as const;
  enumLike?: BoolEnumLikeConfig;

  generateYomFieldType(): yom.FieldType {
    return { type: "Bool" };
  }
}

export class UuidField extends FieldBase {
  type = "Uuid" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "Uuid" };
  }
}

export class OrderingField extends FieldBase {
  type = "Ordering" as const;

  generateYomFieldType(): yom.FieldType {
    return { type: "Ordering" };
  }
}

export class EnumField extends FieldBase {
  type = "Enum" as const;
  enum: string;
  constructor(name: string, displayName: string, _enum: string) {
    super(name, displayName);
    this.enum = _enum;
  }

  generateYomFieldType(): yom.FieldType {
    return { type: "Enum", enum: this.enum };
  }
}

export class ForeignKeyField extends FieldBase {
  type = "ForeignKey" as const;
  constructor(
    name: string,
    displayName: string,
    public table: string,
    public onDelete: yom.OnDeleteBehavior,
  ) {
    super(name, displayName);
  }

  generateYomFieldType(): yom.FieldType {
    return { type: "ForeignKey", onDelete: this.onDelete, table: this.table };
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
    this.#displayName = system.displayNameConfig.table(name);
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
    const field = new BoolFieldBuilder(name);
    this.addField(field);
    return field;
  }

  ordering(name: string) {
    const field = new OrderingFieldBuilder(name);
    this.addField(field);
    return field;
  }

  date(name: string) {
    const field = new DateFieldBuilder(name);
    this.addField(field);
    return field;
  }

  time(name: string) {
    const field = new TimeFieldBuilder(name);
    this.addField(field);
    return field;
  }

  timestamp(name: string) {
    const field = new TimestampFieldBuilder(name);
    this.addField(field);
    return field;
  }

  tx(name: string) {
    const field = new TxFieldBuilder(name);
    this.addField(field);
    return field;
  }

  tinyInt(name: string) {
    const field = new TinyIntFieldBuilder(name);
    this.addField(field);
    return field;
  }

  smallInt(name: string) {
    const field = new SmallIntFieldBuilder(name);
    this.addField(field);
    return field;
  }

  int(name: string) {
    const field = new IntFieldBuilder(name);
    this.addField(field);
    return field;
  }

  bigInt(name: string) {
    const field = new BigIntFieldBuilder(name);
    this.addField(field);
    return field;
  }

  tinyUint(name: string) {
    const field = new TinyUintFieldBuilder(name);
    this.addField(field);
    return field;
  }

  smallUint(name: string) {
    const field = new SmallUintFieldBuilder(name);
    this.addField(field);
    return field;
  }

  uint(name: string) {
    const field = new UintFieldBuilder(name);
    this.addField(field);
    return field;
  }

  bigUint(name: string) {
    const field = new BigUintFieldBuilder(name);
    this.addField(field);
    return field;
  }

  real(name: string) {
    const field = new RealFieldBuilder(name);
    this.addField(field);
    return field;
  }

  double(name: string) {
    const field = new DoubleFieldBuilder(name);
    this.addField(field);
    return field;
  }

  uuid(name: string) {
    const field = new UuidFieldBuilder(name);
    this.addField(field);
    return field;
  }

  decimal(
    name: string,
    opts: {
      precision: number;
      scale: number;
      signed?: boolean;
    },
  ) {
    const field = new DecimalFieldBuilder(
      name,
      opts.precision,
      opts.scale,
      opts.signed ?? true,
      undefined,
    );
    this.addField(field);
    return field;
  }

  string(name: string, maxLength: number) {
    const field = new StringFieldBuilder(name, maxLength);
    this.addField(field);
    return field;
  }

  fk(name: string, table?: string) {
    const field = new ForeignKeyFieldBuilder(name, table ?? name);
    this.addField(field);
    return field;
  }

  enum(name: string, enumName?: string) {
    const field = new EnumFieldBuilder(name, enumName ?? name);
    this.addField(field);
    return field;
  }

  money(
    name: string,
    opts?:
      | {
          precision: number;
          scale: number;
          signed?: boolean;
        }
      | yom.FieldIntegerTypes,
  ) {
    const usage = { type: "Money", currency: "USD" } as const;
    if (typeof opts === "string") {
      let field;
      switch (opts) {
        case "TinyUint":
          field = new TinyUintFieldBuilder(name, usage);
        case "SmallUint":
          field = new SmallUintFieldBuilder(name, usage);
        case "Uint":
          field = new UintFieldBuilder(name, usage);
        case "BigUint":
          field = new BigUintFieldBuilder(name, usage);
        case "TinyInt":
          field = new TinyIntFieldBuilder(name, usage);
        case "SmallInt":
          field = new SmallIntFieldBuilder(name, usage);
        case "Int":
          field = new IntFieldBuilder(name, usage);
        case "BigInt":
          field = new BigIntFieldBuilder(name, usage);
      }
      this.addField(field);
      return field;
    }
    const normalizedOpts = opts ?? { precision: 13, scale: 2, signed: true };
    const field = new DecimalFieldBuilder(
      name,
      normalizedOpts.precision,
      normalizedOpts.scale,
      normalizedOpts.signed ?? false,
      usage,
    );
    this.addField(field);
    return field;
  }

  percentage(
    name: string,
    opts: {
      precision: number;
      scale: number;
      signed?: boolean;
    },
  ) {
    const field = new DecimalFieldBuilder(
      name,
      opts.precision,
      opts.scale,
      opts.signed ?? false,
      { type: "Percentage" },
    );
    this.addField(field);
    return field;
  }

  #duration = (
    name: string,
    size: DurationSize,
    backing: yom.FieldIntegerTypes,
  ) => {
    const usage = { type: "Duration", size } as const;
    let field;
    switch (backing) {
      case "TinyUint":
        field = new TinyUintFieldBuilder(name, usage);
      case "SmallUint":
        field = new SmallUintFieldBuilder(name, usage);
      case "Uint":
        field = new UintFieldBuilder(name, usage);
      case "BigUint":
        field = new BigUintFieldBuilder(name, usage);
      case "TinyInt":
        field = new TinyIntFieldBuilder(name, usage);
      case "SmallInt":
        field = new SmallIntFieldBuilder(name, usage);
      case "Int":
        field = new IntFieldBuilder(name, usage);
      case "BigInt":
        field = new BigIntFieldBuilder(name, usage);
    }
    this.addField(field);
    return field;
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
    const field = new StringFieldBuilder(name, 254, { type: "Email" });
    this.addField(field);
    return field;
  }

  phoneNumber(name: string) {
    const field = new StringFieldBuilder(name, 50, { type: "PhoneNumber" });
    this.addField(field);
    return field;
  }

  unique(
    constraint: yom.UniqueConstraintField[] | yom.UniqueConstraint,
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
        "Please make sure to specify an expression for setRecordDisplayName",
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
      if (field.unique) {
        this.unique([field.name]);
      }
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
          "recordDisplayNameFields only supports a length 1 or 2",
        );
      }
    }
    const tableName = this.name;
    if (this.#createDefaultNameMatch) {
      if (!displayNameFields) {
        throw new Error(
          "createDefaultNameMatch assumes recordDisplayNameFields",
        );
      }
      const name = tableName + "_name";
      system.db.searchMatches[name] = {
        name: tableName + "_name",
        table: tableName,
        tokenizer: system.searchConfig.defaultTokenizer,
        style: {
          ...system.searchConfig.defaultFuzzyConfig,
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
      this.#displayName,
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
      createByDefault: boolean,
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
      true,
    );
    const street2Field = createFieldName(
      opts.createFields?.streetTwo,
      "street_two",
      false,
    );
    const cityField = createFieldName(opts.createFields?.city, "city", true);
    const stateField = createFieldName(opts.createFields?.state, "state", true);
    const countryField = createFieldName(
      opts.createFields?.country,
      "country",
      true,
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
  system.addScalarFunction({
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
              `select value from string.split(input.value, ':') order by ordinal desc`,
            )
            .advanceCursor(`split`)
            .setScalar(`total`, `cast(split.value as bigint)`)
            .forEachCursor(`split`, (s) =>
              s.setScalar(`total`, `total + cast(split.value as bigint) * 60`),
            )
            .if(`input.value like '-%'`, (s) =>
              s.setScalar(`total`, `total * -1`),
            )
            .return(`total`),
        catch: (s) => s.return(),
      }),
  });
  system.addScalarFunction({
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

  constructor(name: string) {
    this._name = name;
    this._displayName = system.displayNameConfig.field(name);
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
    this._unique = true;
    return this;
  }

  check(
    check: (field: string) => string,
    errorMessage: (field: string) => string,
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

  constructor(name: string) {
    super(name);
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

  constructor(name: string, usage?: IntegerUsage) {
    super(name);
    this.#usage = usage;
  }

  writeBaseFields(field: IntegerField) {
    super.writeBaseFields(field);
    field.usage = this.#usage;
  }
}

interface IntegerFieldBuilder {
  new (name: string, usage?: IntegerUsage): BaseNumericBuilder;
}

function createIntegerBuilder(
  constructor: new (name: string, displayName: string) => IntegerField,
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

    precision: number,
    scale: number,
    signed: boolean,
    usage: DecimalUsage | undefined,
  ) {
    super(name);
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
      this.#signed,
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

    usage?: StringUsage,
  ) {
    super(name);
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
      this.#maxLength,
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

  constructor(name: string, tableName: string) {
    super(name);
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
      this.#onDelete,
    );
    this.writeBaseFields(field);
    return field;
  }
}

class EnumFieldBuilder extends BaseFieldBuilder {
  #enum: string;

  constructor(name: string, enumName: string) {
    super(name);
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

function generateRecordRuleFn(rfn: RecordRuleFn): yom.RecordRuleFunction {
  return {
    name: rfn.name,
    outputs: Object.values(rfn.outputs).map((o) => ({
      name: o.name,
      type: o.type,
      collation: o.collation,
    })),
    parameters: Object.values(rfn.parameters).map((i) => ({
      name: i.name,
      type: i.type,
      notNull: i.notNull,
    })),
    setup: rfn.setup,
    header: rfn.header,
    rules: rfn.rules,
  };
}

function generateRuleFn(rfn: RuleFunction): yom.RuleFunction {
  return {
    name: rfn.name,
    parameters: Object.values(rfn.parameters).map((i) => ({
      name: i.name,
      type: i.type,
      notNull: i.notNull,
    })),
    setup: rfn.setup,
    header: rfn.header,
    rules: rfn.rules,
    returnType: rfn.returnType,
  };
}

function generateScalarFunction(f: ScalarFunction): yom.ScalarFunction {
  return {
    name: f.name,
    parameters: Object.values(f.inputs).map((i) => ({
      name: i.name,
      type: i.type,
      notNull: i.notNull,
    })),
    procedure: f.procedure,
    returnType: f.returnType,
  };
}

/**
 * The total model of the database, applications, apis, etc.
 */
export const system = new System();
