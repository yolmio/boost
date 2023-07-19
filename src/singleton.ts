import type { Authorization, BoostModel } from "./modelTypes.js";
import { createTheme } from "./createTheme.js";
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
    userRoleTableName: "user_role",
    roleEnumName: "role",
    userIsAuthorized: (user: string, auth: Authorization) => {
      const table = model.database.tables[model.database.userRoleTableName];
      const roleField = ident(
        Object.values(table.fields).find(
          (f) => f.type === "Enum" && f.enum == model.database.roleEnumName
        )!.name
      );
      const userField = ident(
        Object.values(table.fields).find(
          (f) =>
            f.type === "ForeignKey" && f.table == model.database.userTableName
        )!.name
      );
      let whereExpr = "true";
      if ("allow" in auth) {
        if (typeof auth.allow === "string") {
          whereExpr = `${roleField} = ${stringLiteral(auth.allow)}`;
        } else {
          whereExpr = `${roleField} in (${stringLiteral(
            auth.allow.join(", ")
          )})`;
        }
      } else if ("deny" in auth) {
        if (typeof auth.deny === "string") {
          whereExpr = `${roleField} = ${stringLiteral(auth.deny)}`;
        } else {
          whereExpr = `${roleField} in (${stringLiteral(
            auth.deny.join(", ")
          )})`;
        }
      }
      return `exists (select id from db.${ident(
        table.name
      )} where ${userField} = ${user} and ${whereExpr})`;
    },
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
  pages: [],
};

function defaultGetDisplayName(sqlName: string) {
  return upcaseFirst(normalizeCase(sqlName).join(" "));
}
