import { app } from "./app";
import * as path from "path";
import toposort from "toposort";
import { ScriptStatements, ScriptStatementsOrFn } from "./statements";

function isTableReferencedByOthers(t: string) {
  for (const otherTable of Object.values(app.db.tables)) {
    for (const field of Object.values(otherTable.fields)) {
      if (field.type === "ForeignKey" && field.table === t) {
        return true;
      }
    }
  }
  return false;
}

export interface MigrationScriptOpts {
  inputDir: string;
  outputDir: string;
  scriptName?: string;
  scriptDbName?: string;
  before?: ScriptStatementsOrFn;
  ignoreTables?: string[];
  transformTableName?: (v: string) => string;
  transformFieldName?: (v: string) => string;
  tables?: Record<
    string,
    {
      ignoreFields?: string[];
      fieldOverrides?: Record<string, string>;
      where?: string;
    }
  >;
}

export function addMigrationScript(opts: MigrationScriptOpts) {
  const scriptName = opts.scriptName ?? "migrate";
  const scriptDbName = opts.scriptDbName ?? scriptName;
  app.scriptDbs.push({
    name: scriptDbName,
    definition: {
      type: "MappingFile",
      file: path.join(opts.inputDir, "map.json"),
    },
  });
  const tableImports = new ScriptStatements();
  const graph: [string, string][] = [];
  for (const t of Object.values(app.db.tables)) {
    if (opts.ignoreTables?.includes(t.name)) {
      continue;
    }
    for (const f of Object.values(t.fields)) {
      if (f.type === "ForeignKey") {
        graph.push([t.name, f.table]);
      }
    }
  }
  const sortedTables = toposort(graph);
  sortedTables.reverse();
  for (const tableName of sortedTables) {
    const t = app.db.tables[tableName];
    const tableOpts = opts.tables?.[t.name] ?? {};
    const scriptDbTableName = opts.transformTableName?.(t.name) ?? t.name;
    const fields = Object.values(t.fields)
      .filter((f) => {
        return !tableOpts.ignoreFields?.includes(f.name);
      })
      .map((f) => {
        const fieldName = opts.transformFieldName?.(f.name) ?? f.name;
        if (tableOpts.fieldOverrides?.[f.name]) {
          return tableOpts.fieldOverrides[f.name] + " as " + f.name;
        }
        if (f.type === "ForeignKey") {
          return `(select new_id from ${f.table}_mapping where record.${fieldName} = old_id) as ${f.name}`;
        }
        if (f.type == "Enum") {
          return `cast(cast(record.${fieldName} as string) as enums.${f.enum}) as ${f.name}`;
        }
        return `record.${fieldName} as ${f.name}`;
      });
    let insertSql = `insert into db.${t.name} select ${fields} from ${scriptDbName}.${scriptDbTableName} as record`;
    if (tableOpts.where) {
      insertSql += ` where ${tableOpts.where}`;
    }
    tableImports.modify(insertSql);
    if (isTableReferencedByOthers(t.name)) {
      tableImports.table(
        `${t.name}_mapping`,
        [
          {
            name: "old_id",
            notNull: true,
            indexed: true,
            type: { type: "Int" },
          },
          {
            name: "new_id",
            notNull: true,
            type: { type: "Int" },
          },
        ],
        `select id as old_id, rank() over () - 1 as new_id from ${scriptDbName}.${scriptDbTableName}`
      );
    }
  }
  app.addScript(scriptName, (s) =>
    s
      .loadDbFromDir(opts.inputDir, scriptDbName)
      .startTransaction("db")
      .statements(opts.before, tableImports)
      .commitTransaction("db")
      .saveDbToDir(opts.outputDir)
  );
}
