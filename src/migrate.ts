import { addScript, addScriptDbFromMappingFile } from "./modelHelpers.js";
import { loadDb, modify, saveDb, table } from "./procHelpers.js";
import { model } from "./singleton.js";
import { ScriptStatement } from "./yom.js";
import * as path from "path";
import toposort from "toposort";

function isTableReferencedByOthers(t: string) {
  for (const otherTable of Object.values(model.database.tables)) {
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
  before?: ScriptStatement[];
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

export function createMigrationScript(opts: MigrationScriptOpts) {
  const scriptName = opts.scriptName ?? "migrate";
  const scriptDbName = opts.scriptDbName ?? scriptName;
  addScriptDbFromMappingFile(
    scriptDbName,
    path.join(opts.inputDir, "map.json")
  );
  const tableImports: ScriptStatement[] = [];
  const graph: [string, string][] = [];
  for (const t of Object.values(model.database.tables)) {
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
    const t = model.database.tables[tableName];
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
    tableImports.push(modify(insertSql));
    if (isTableReferencedByOthers(t.name)) {
      tableImports.push(
        table(
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
        )
      );
    }
  }
  addScript({
    name: scriptName,
    procedure: [
      loadDb(opts.inputDir, scriptDbName),
      ...(opts.before ?? []),
      ...tableImports,
      saveDb(opts.outputDir),
    ],
  });
}
