import { model } from "./singleton.js";
import { StyleSerializer, transformNode } from "./nodeTransform.js";
import { addRootStyles } from "./rootStyles.js";
import type * as yom from "./yom.js";
import type {
  Database,
  DecisionTable,
  ScalarFunction,
  Table,
} from "./modelTypes";
import { default404Page } from "./pages/default404.js";
import { Node, RouteNode, RoutesNode } from "./nodeTypes.js";
import { escapeHtml } from "./utils/escapeHtml.js";

function generateDecisionTable(dt: DecisionTable): yom.DecisionTable {
  return {
    name: dt.name,
    outputs: Object.values(dt.outputs).map((o) => ({
      name: o.name,
      type: o.type,
      collation: o.collation,
    })),
    parameters: Object.values(dt.inputs).map((i) => ({
      name: i.name,
      type: i.type,
      notNull: i.notNull,
    })),
    setup: dt.setup,
    csv: dt.csv,
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

function generateTable(t: Table): yom.Table {
  const checks = t.checks.map((c) => c.check(c.fields));
  const fields = Object.values(t.fields).map((f): yom.TableField => {
    for (const check of f.checks) {
      checks.push(check.check(f.name));
    }
    const base = {
      name: f.name,
      renameFrom: f.renameFrom,
      description: f.description,
      notNull: f.notNull,
      default: f.default,
      indexed: f.indexed,
    };
    switch (f.type) {
      case "String":
        return {
          type: {
            type: "String",
            maxLength: f.maxLength,
            maxBytesPerChar: f.maxBytesPerChar,
          },
          ...base,
        };
      case "TinyInt":
      case "SmallInt":
      case "Int":
      case "BigInt":
      case "TinyUint":
      case "SmallUint":
      case "Uint":
      case "BigUint":
      case "Real":
      case "Double":
      case "Bool":
      case "Uuid":
      case "Date":
      case "Ordering":
      case "Time":
      case "Timestamp":
      case "Tx":
        return { type: { type: f.type }, ...base };
      case "Decimal":
        return {
          type: {
            type: "Decimal",
            precision: f.precision,
            scale: f.scale,
            signed: f.signed,
          },
          ...base,
        };
      case "ForeignKey":
        return {
          type: {
            type: "ForeignKey",
            table: f.table,
            onDelete: f.onDelete,
          },
          ...base,
        };
      case "Enum":
        return {
          type: {
            type: "Enum",
            enum: f.enum,
          },
          ...base,
        };
    }
  });
  return {
    primaryKeyFieldName: t.primaryKeyFieldName,
    name: t.name,
    renameFrom: t.renameFrom,
    uniqueConstraints: t.uniqueConstraints,
    checks,
    fields,
  };
}

function generateDatabase(database: Database): yom.Database {
  return {
    userTableName: database.userTableName,
    collation: database.collation,
    autoTrim: database.autoTrim,
    enableTransactionQueries: database.enableTransactionQueries,
    decisionTables: Object.values(database.decisionTables).map(
      generateDecisionTable
    ),
    scalarFunctions: Object.values(database.scalarFunctions).map(
      generateScalarFunction
    ),
    tables: Object.values(database.tables).map(generateTable),
    searchMatches: Object.values(database.searchMatches),
  };
}

function getTransformedUi(): [yom.Node, string] {
  if (!model.pages.some((p) => p.path === "/*" || p.path === "*")) {
    model.pages.push({
      path: "*",
      content: default404Page(),
    });
  }
  const pagesWithShell = model.pages
    .filter((p) => !p.ignoreShell)
    .map(
      (p) =>
        ({
          t: "Route",
          path: p.path,
          children: p.content,
        } as RouteNode)
    );
  const pagesWithoutShell = model.pages
    .filter((p) => p.ignoreShell)
    .map(
      (p) =>
        ({
          t: "Route",
          path: p.path,
          children: p.content,
        } as RouteNode)
    );
  let rootNode: Node;
  if (model.shell) {
    const shell = model.shell({
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
  const serializer = new StyleSerializer();
  for (const style of model.globalStyles) {
    serializer.addGlobalStyle(style);
  }
  addRootStyles(serializer, model.theme);
  const node = transformNode(rootNode, (styles, dynamicStyle) => {
    if (!styles) {
      return;
    }
    return serializer.addStyle(styles, !dynamicStyle);
  });
  return [node, serializer.getCss()];
}

export function generateYom(): yom.Model {
  const [uiTree, css] = getTransformedUi();
  if (model.name === "please-rename") {
    console.log();
    console.warn(
      "You should rename your app from 'please-rename' to something else using `setAppName()`."
    );
    console.warn(
      "Unless you really want to use the name 'please-rename' for your app."
    );
    console.log();
  }
  let htmlHead = model.webAppConfig.htmlHead;
  if (model.title) {
    htmlHead += `<title>${escapeHtml(model.title)}</title>`;
  }
  if (model.webAppConfig.viewport) {
    htmlHead += `<meta name="viewport" content="${escapeHtml(
      model.webAppConfig.viewport
    )}">`;
  }
  switch (model.webAppConfig.logoGeneration.type) {
    case "Default":
      htmlHead += `
  <link rel="apple-touch-icon" sizes="180x180" href="/global_assets/logo/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/global_assets/logo/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/global_assets/logo/favicon-16x16.png">
  <link rel="manifest" href="/global_assets/logo/site.webmanifest">
  <link rel="mask-icon" href="/global_assets/logo/safari-pinned-tab.svg" color="#5a35a3">
  <link rel="shortcut icon" href="/global_assets/logo/favicon.ico">
  <meta name="msapplication-TileColor" content="#00aba9">
  <meta name="msapplication-config" content="/global_assets/logo/browserconfig.xml">
  <meta name="theme-color" content="#ffffff">`;
      break;
    case "App":
      htmlHead += `
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/logo/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/logo/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/logo/favicon-16x16.png">
  <link rel="manifest" href="/assets/logo/site.webmanifest">
  <link rel="mask-icon" href="/assets/logo/safari-pinned-tab.svg" color="${model.webAppConfig.logoGeneration.safariPinnedTabColor}">
  <link rel="shortcut icon" href="/assets/logo/favicon.ico">
  <meta name="msapplication-TileColor" content="${model.webAppConfig.logoGeneration.msTileColor}">
  <meta name="msapplication-config" content="/assets/logo/browserconfig.xml">
  <meta name="theme-color" content="${model.webAppConfig.logoGeneration.themeColor}">`;
      break;
    case "Account":
      htmlHead += `
  <link rel="apple-touch-icon" sizes="180x180" href="/account_assets/logo/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/account_assets/logo/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/account_assets/logo/favicon-16x16.png">
  <link rel="manifest" href="/account_assets/logo/site.webmanifest">
  <link rel="mask-icon" href="/account_assets/logo/safari-pinned-tab.svg" color="${model.webAppConfig.logoGeneration.safariPinnedTabColor}">
  <link rel="shortcut icon" href="/account_assets/logo/favicon.ico">
  <meta name="msapplication-TileColor" content="${model.webAppConfig.logoGeneration.msTileColor}">
  <meta name="msapplication-config" content="/account_assets/logo/browserconfig.xml">
  <meta name="theme-color" content="${model.webAppConfig.logoGeneration.themeColor}">`;
      break;
    case "Custom":
      break;
  }
  if (!model.webAppConfig.manifest.name) {
    model.webAppConfig.manifest.name = model.displayName;
  }
  return {
    // todo make this part of the model
    locale: "en_us",
    name: model.name,
    displayName: model.displayName,
    dbExecutionMode: model.dbRunMode,
    collation: model.collation,
    autoTrim: model.autoTrim,
    textCast: {
      date: "%F",
      timestamp: "%+",
      time: "%T",
    },
    db: generateDatabase(model.database),
    decisionTables: Object.values(model.decisionTables).map(
      generateDecisionTable
    ),
    scalarFunctions: Object.values(model.scalarFunctions).map(
      generateScalarFunction
    ),
    enums: Object.values(model.enums).map((e) => ({
      name: e.name,
      renameFrom: e.renameFrom,
      description: e.description,
      values: Object.values(e.values).map((v) => ({
        name: v.name,
        renameFrom: v.renameFrom,
        description: v.description,
      })),
    })),
    ui: {
      pwaManifest: model.webAppConfig.manifest,
      htmlHead: htmlHead,
      tree: uiTree,
      css,
      deviceDb: {
        tables: Object.values(model.deviceDb.tables).map(generateTable),
      },
    },
    scripts: model.scripts,
    scriptDbs: model.scriptDbs.map((db) => {
      if (db.definition.type === "MappingFile") {
        return { name: db.name, definition: db.definition };
      } else {
        return {
          name: db.name,
          definition: {
            type: "Model",
            db: {
              collation: db.definition.db.collation,
              autoTrim: db.definition.db.autoTrim,
              enableTransactionQueries:
                db.definition.db.enableTransactionQueries,
              tables: Object.values(db.definition.db.tables).map(generateTable),
            },
          },
        };
      }
    }),
  };
}
