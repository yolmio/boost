import { app, DecisionTable, ScalarFunction, Table } from "./app";
import { StyleSerializer, transformNode } from "./nodeTransform";
import { addRootStyles } from "./rootStyles";
import type * as yom from "./yom";
import { default404Page } from "./pages/default404";
import { Node, RouteNode, RoutesNode } from "./nodeTypes";
import { escapeHtml } from "./utils/escapeHtml";

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

function generateDatabase(): yom.Database {
  return {
    userTableName: app.db.userTableName,
    collation: app.db.collation,
    autoTrim: app.db.autoTrim,
    enableTransactionQueries: app.db.enableTransactionQueries,
    decisionTables: Object.values(app.db.decisionTables).map(
      generateDecisionTable
    ),
    scalarFunctions: Object.values(app.db.scalarFunctions).map(
      generateScalarFunction
    ),
    tables: Object.values(app.db.tables).map(generateTable),
    searchMatches: Object.values(app.db.searchMatches),
  };
}

function getTransformedUi(): [yom.Node, string] {
  if (!app.ui.pages.some((p) => p.path === "/*" || p.path === "*")) {
    app.ui.pages.push({
      path: "*",
      content: default404Page(),
    });
  }
  const pagesWithShell = app.ui.pages
    .filter((p) => !p.ignoreShell)
    .map(
      (p) =>
        ({
          t: "Route",
          path: p.path,
          children: p.content,
        } as RouteNode)
    );
  const pagesWithoutShell = app.ui.pages
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
  if (app.ui.shell) {
    const shell = app.ui.shell({
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
  for (const style of app.ui.globalStyles) {
    serializer.addGlobalStyle(style);
  }
  addRootStyles(serializer, app.theme);
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
  if (app.name === "please-rename") {
    console.log();
    console.warn(
      "You should rename your app from 'please-rename' to something else using `setAppName()`."
    );
    console.warn(
      "Unless you really want to use the name 'please-rename' for your app."
    );
    console.log();
  }
  let htmlHead = app.ui.webAppConfig.htmlHead;
  if (app.title) {
    htmlHead += `<title>${escapeHtml(app.title)}</title>`;
  }
  if (app.ui.webAppConfig.viewport) {
    htmlHead += `<meta name="viewport" content="${escapeHtml(
      app.ui.webAppConfig.viewport
    )}">`;
  }
  switch (app.ui.webAppConfig.logoGeneration.type) {
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
  <link rel="mask-icon" href="/assets/logo/safari-pinned-tab.svg" color="${app.ui.webAppConfig.logoGeneration.safariPinnedTabColor}">
  <link rel="shortcut icon" href="/assets/logo/favicon.ico">
  <meta name="msapplication-TileColor" content="${app.ui.webAppConfig.logoGeneration.msTileColor}">
  <meta name="theme-color" content="${app.ui.webAppConfig.logoGeneration.themeColor}">`;
      break;
    case "Account":
      htmlHead += `
  <link rel="apple-touch-icon" sizes="180x180" href="/account_assets/logo/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/account_assets/logo/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/account_assets/logo/favicon-16x16.png">
  <link rel="mask-icon" href="/account_assets/logo/safari-pinned-tab.svg" color="${app.ui.webAppConfig.logoGeneration.safariPinnedTabColor}">
  <link rel="shortcut icon" href="/account_assets/logo/favicon.ico">
  <meta name="msapplication-TileColor" content="${app.ui.webAppConfig.logoGeneration.msTileColor}">
  <meta name="theme-color" content="${app.ui.webAppConfig.logoGeneration.themeColor}">`;
      break;
    case "Custom":
      break;
  }
  if (!app.ui.webAppConfig.manifest.name) {
    app.ui.webAppConfig.manifest.name = app.displayName;
  }
  return {
    // todo make this part of the model
    locale: "en_us",
    name: app.name,
    displayName: app.displayName,
    dbExecutionMode: app.dbRunMode,
    appDomain: app.appDomain,
    collation: app.collation,
    autoTrim: app.autoTrim,
    textCast: {
      date: "%F",
      timestamp: "%+",
      time: "%T",
    },
    db: generateDatabase(),
    decisionTables: Object.values(app.decisionTables).map(
      generateDecisionTable
    ),
    scalarFunctions: Object.values(app.scalarFunctions).map(
      generateScalarFunction
    ),
    enums: Object.values(app.enums).map((e) => ({
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
      pwaManifest: app.ui.webAppConfig.manifest,
      htmlHead: htmlHead,
      tree: uiTree,
      css,
      deviceDb: {
        tables: Object.values(app.ui.deviceDb.tables).map(generateTable),
      },
    },
    scripts: app.scripts,
    scriptDbs: app.scriptDbs.map((db) => {
      if (db.definition.type === "MappingFile") {
        return { name: db.name, definition: db.definition };
      } else {
        return {
          name: db.name,
          definition: {
            type: "Model",
            db: {
              enableTransactionQueries: false,
              tables: Object.values(db.definition.db.tables).map(generateTable),
            },
          },
        };
      }
    }),
  };
}
