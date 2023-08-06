import { TableBuilder } from "./appHelpers.js";
import type { BoostAppModel } from "./appTypes.js";
import { ThemeOpts, createTheme } from "./createTheme.js";
import { normalizeCase, upcaseFirst } from "./utils/inflectors.js";

export const app: BoostAppModel = {
  name: "please-rename",
  title: "please-rename",
  displayName: "Please Rename",
  theme: createTheme(),
  displayNameConfig: {
    default: defaultGetDisplayName,
    table: defaultGetDisplayName,
    field: defaultGetDisplayName,
    virtual: defaultGetDisplayName,
    enum: defaultGetDisplayName,
    enumValue: defaultGetDisplayName,
  },
  searchConfig: {
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
  },
  ui: {
    deviceDb: { tables: {} },
    globalStyles: [],
    pages: [],
    webAppConfig: {
      htmlHead: "",
      viewport: `width=device-width, initial-scale=1`,
      logoGeneration: { type: "Default" },
      manifest: {},
    },
    useNavbarShell(opts) {
      throw new Error("Not implemented");
    },
  },
  dbRunMode: "BrowserSync",
  autoTrim: "None",
  collation: "NoCase",
  db: {
    userTableName: "user",
    autoTrim: "Both",
    collation: "NoCase",
    enableTransactionQueries: true,
    decisionTables: {},
    scalarFunctions: {},
    searchMatches: {},
    tables: {},

    addTable: (name, f) => {
      const builder = new TableBuilder(name);
      f(builder);
      app.db.tables[name] = builder.finish();
    },
  },
  decisionTables: {},
  enums: {},
  scalarFunctions: {},

  test: {
    data: [],
    api: [],
    ui: [],
  },
  scripts: [],
  scriptDbs: [],
};

function defaultGetDisplayName(sqlName: string) {
  return upcaseFirst(normalizeCase(sqlName).join(" "));
}

export function setTheme(themeOptions: ThemeOpts) {
  app.theme = createTheme(themeOptions);
}
