import { system } from "./system";
import * as path from "path";
import toposort from "toposort";
import { ScriptStatements, ScriptStatementsOrFn } from "./statements";
import * as yom from "./yom";
import * as fs from "fs";

function isTableReferencedByOthers(t: string) {
  for (const otherTable of Object.values(system.db.tables)) {
    for (const field of Object.values(otherTable.fields)) {
      if (field.type === "ForeignKey" && field.table === t) {
        return true;
      }
    }
  }
  return false;
}

export interface AutoImportScriptOpts {
  inputDir: string;
  outputDir: string;
  scriptName: string;
  scriptDbName?: string;
  before?: ScriptStatementsOrFn;
  afterTransaction?: ScriptStatementsOrFn;
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

export function addAutoImportScript(opts: AutoImportScriptOpts) {
  const scriptName = opts.scriptName;
  const scriptDbName = opts.scriptDbName ?? path.basename(opts.inputDir);
  const prefixEnums = `db_${scriptDbName}_`;
  createScriptDbFromDir({
    dbName: scriptDbName,
    prefixEnums,
    dir: opts.inputDir,
  });
  const scriptDb = system.scriptDbs[scriptDbName];
  const tableImports = new ScriptStatements();
  const graph: [string, string][] = [];
  for (const t of Object.values(system.db.tables)) {
    const nameInScriptDb = opts.transformTableName?.(t.name) ?? t.name;
    if (
      opts.ignoreTables?.includes(t.name) ||
      !system.scriptDbs[scriptDbName].tables[nameInScriptDb]
    ) {
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
    const t = system.db.tables[tableName];
    const tableOpts = opts.tables?.[t.name] ?? {};
    const scriptDbTableName = opts.transformTableName?.(t.name) ?? t.name;
    const scriptDbTable = scriptDb.tables[scriptDbTableName];
    const fields = Object.values(t.fields)
      .filter((f) => {
        const fieldNameInScriptDb = opts.transformFieldName?.(f.name) ?? f.name;
        return (
          !tableOpts.ignoreFields?.includes(f.name) &&
          scriptDbTable.fields[fieldNameInScriptDb]
        );
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
        `select id as old_id, rank() over () - 1 as new_id from ${scriptDbName}.${scriptDbTableName}`,
      );
    }
  }
  system.addScript(scriptName, (s) =>
    s
      .loadDbFromDir({
        dir: opts.inputDir,
        db: scriptDbName,
        prefixEnums,
      })
      .startTransaction("db")
      .statements(opts.before, tableImports)
      .commitTransaction("db")
      .statements(opts.afterTransaction)
      .saveDbToDir(opts.outputDir),
  );
}

export interface ScriptDbFromDirOpts {
  dir: string;
  dbName?: string;
  prefixEnums?: string;
}

export function createScriptDbFromDir(opts: ScriptDbFromDirOpts) {
  const mappingPath = path.join(opts.dir, "mapping.json");
  const mapping: yom.DatabaseMapping = JSON.parse(
    fs.readFileSync(mappingPath, "utf8"),
  );
  const dbName = opts.dbName ?? path.basename(opts.dir);
  const prefixEnums = opts.prefixEnums ?? `db_${dbName}_`;
  const enumsClone = JSON.parse(JSON.stringify(mapping.enums)) as Record<
    string,
    yom.EnumMapping
  >;
  mapping.enums = {};
  for (const [enumName, enumValues] of Object.entries(enumsClone)) {
    const nameWithPrefix = prefixEnums + enumName;
    mapping.enums[nameWithPrefix] = enumValues;
    system.addEnum({
      name: nameWithPrefix,
      values: Object.keys(enumValues.values),
    });
  }
  system.addScriptDb(dbName, (db) => {
    db.mapping = mapping;
    for (const [name, tableMapping] of Object.entries(mapping.tables)) {
      db.addTable(name, (t) => {
        t.primaryKeyFieldName(tableMapping.primaryKeyFieldName);
        for (const [fieldName, field] of Object.entries(tableMapping.fields)) {
          switch (field.type.type) {
            case "TinyInt":
              t.tinyInt(fieldName);
              break;
            case "SmallInt":
              t.smallInt(fieldName);
              break;
            case "Int":
              t.int(fieldName);
              break;
            case "BigInt":
              t.bigInt(fieldName);
              break;
            case "TinyUint":
              t.tinyUint(fieldName);
              break;
            case "SmallUint":
              t.smallUint(fieldName);
              break;
            case "Uint":
              t.uint(fieldName);
              break;
            case "BigUint":
              t.bigUint(fieldName);
              break;
            case "String":
              t.string(fieldName, field.type.maxLength)
                .maxBytesPerChar(field.type.maxBytesPerChar)
                .minLength(field.type.minLength);
              break;
            case "Enum":
              t.enum(fieldName, prefixEnums + field.type.enum);
              break;
            case "Bool":
              t.bool(fieldName);
              break;
            case "Timestamp":
              t.timestamp(fieldName);
              break;
            case "Date":
              t.date(fieldName);
              break;
            case "Time":
              t.time(fieldName);
              break;
            case "Decimal":
              t.decimal(fieldName, {
                precision: field.type.precision,
                scale: field.type.scale,
                signed: field.type.signed,
              });
              break;
            case "Double":
              t.double(fieldName);
              break;
            case "Real":
              t.real(fieldName);
              break;
            case "Json":
              t.json(fieldName);
              break;
            case "Ordering":
              t.ordering(fieldName);
              break;
            case "Uuid":
              t.uuid(fieldName);
              break;
            case "Tx":
              t.tx(fieldName);
              break;
            case "ForeignKey":
              t.fk(fieldName, field.type.table);
              break;
            // @ts-ignore
            case "NuvaId":
              // @ts-ignore
              t.nuvaId(fieldName);
              break;
          }
        }
      });
    }
  });
}
