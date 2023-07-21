import type { BoostModel } from "./modelTypes.js";
import { ThemeOpts, createTheme } from "./createTheme.js";
import { normalizeCase, upcaseFirst } from "./utils/inflectors.js";
import { ident, stringLiteral } from "./utils/sqlHelpers.js";

export const model: BoostModel = {
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
      filters: [{ type: "Lowercase" }],
    },
  },
  pwaConfig: {
    name: "Temporary name",
    display: "minimal-ui",
  },
  dbRunMode: "BrowserSync",
  autoTrim: "None",
  collation: "NoCase",
  database: {
    userTableName: "user",
    autoTrim: "Both",
    collation: "NoCase",
    enableTransactionQueries: true,
    decisionTables: {},
    scalarFunctions: {},
    searchMatches: {},
    tables: {},
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

  deviceDb: { tables: {} },
  globalStyles: [],
  pages: [],
};

function defaultGetDisplayName(sqlName: string) {
  return upcaseFirst(normalizeCase(sqlName).join(" "));
}

export function setTheme(themeOptions: ThemeOpts) {
  model.theme = createTheme(themeOptions);
}
