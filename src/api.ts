import { EndpointStatements, EndpointStatementsOrFn } from "./statements";
import * as yom from "./yom";
import { System } from "./system";
import { pluralize } from "./utils/inflectors";

export class Api {
  #endpoints: yom.ApiEndpoint[] = [];

  constructor(private system: System) {}

  /**
   * Adds a GET endpoint to the system at the provided path.
   */
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

  /**
   * Automatically generates restful endpoints for all tables in the system.
   */
  auto(opts: AutoOpts = {}) {
    for (const table of Object.values(this.system.db.tables)) {
      const tableOpts = opts.tables?.[table.name] ?? {};
      if (tableOpts.skip || table.skipAutoApi || table.name !== "contact") {
        continue;
      }
      const urlBase = table.getBaseUrl();
      if (!tableOpts.noDelete) {
        this.delete(`/${urlBase}/{record_id:id}`, {
          procedure: (s) =>
            s
              .startTransaction()
              .scalar(
                `existed`,
                `exists (select 1 from db.${table.identName} where ${table.primaryKeyIdent} = record_id)`,
              )
              .modify(
                `delete from db.${table.identName} where ${table.primaryKeyIdent} = record_id`,
              )
              .commitTransaction()
              .return(`cast(existed as json)`),
        });
      }
      const jsonFields = Object.values(table.fields).map(
        (f) => `'${f.name}', ${f.identName}`,
      );
      if (tableOpts.relations) {
        for (const relation of tableOpts.relations) {
          const relationOpts =
            typeof relation === "string" ? { otherTable: relation } : relation;
          const otherTable = this.system.db.tables[relationOpts.otherTable];
          if (!otherTable) {
            throw new Error(`Table ${relationOpts.otherTable} not found`);
          }
          const foreignKeyField =
            (relationOpts.foreignKey &&
              otherTable.fields[relationOpts.foreignKey]) ??
            Object.values(otherTable.fields).find(
              (f) => f.type === "ForeignKey" && f.table === table.name,
            );
          if (!foreignKeyField) {
            throw new Error(
              `No foreign key field found for ${table.name} to ${relationOpts.otherTable}`,
            );
          }
          const returnFields = relationOpts.returnFields
            ? relationOpts.returnFields
                .map((f) => otherTable.fields[f])
                .map((f) => `'${f.name}', ${f.identName}`)
            : Object.values(otherTable.fields)
                .filter((f) => f !== foreignKeyField)
                .map((f) => `'${f.name}', ${f.identName}`);
          jsonFields.push(
            `'${pluralize(otherTable.name).replaceAll(" ", "_")}', (select json_array_agg(json_build_object(
                    '${otherTable.primaryKeyFieldName}', ${otherTable.primaryKeyIdent},
                    ${returnFields.join(", ")}
                ))
                from db.${otherTable.identName}
                where ${otherTable.identName}.${foreignKeyField.identName} = ${table.identName}.${table.primaryKeyIdent})`,
          );
        }
      }
      const jsonFieldsText = jsonFields.join(", ");
      if (!tableOpts.noGetRecord) {
        this.get(`/${urlBase}/{record_id:id}`, {
          procedure: (s) =>
            s.if(
              `not exists (select 1 from db.${table.identName} where ${table.primaryKeyIdent} = record_id)`,
              (s) => s.setHttpStatus("404").return(`cast('null' as json)`),
            ).return(`(select json_build_object(
                '${table.primaryKeyFieldName}', ${table.primaryKeyIdent},
                ${jsonFieldsText}
            )
            from db.${table.identName}
            where ${table.primaryKeyIdent} = record_id)`),
        });
      }
      if (!tableOpts.noGetList) {
        this.get(`/${urlBase}`, {
          query: [
            { name: "limit", type: { type: "Int" }, default: `25` },
            { name: "offset", type: { type: "Int" }, default: `0` },
          ],
          procedure: (s) =>
            s.return(`(select json_array_agg(json_build_object(
                    '${table.primaryKeyFieldName}', ${table.primaryKeyIdent},
                    ${jsonFieldsText}
                ))
                from db.${table.identName}
                limit limit offset offset)`),
        });
      }
      if (!tableOpts.noPost) {
        const insertNames = Object.values(table.fields)
          .map((f) => f.identName)
          .join(", ");
        const insertValues = Object.values(table.fields)
          .map((f) => `cast(record_input->>'${f.name}' as ${f.castType})`)
          .join(", ");
        this.post(`/${urlBase}`, {
          jsonBodyScalar: `record_input`,
          procedure: (s) =>
            s
              .startTransaction()
              .modify(
                `insert into db.${table.identName} (${insertNames}) values (${insertValues})`,
              )
              .scalar(`record_id`, `last_record_id(db.${table.identName})`)
              .commitTransaction().return(`(select json_build_object(
                '${table.primaryKeyFieldName}', ${table.primaryKeyIdent},
                ${jsonFieldsText}
            )
            from db.${table.identName}
            where ${table.primaryKeyIdent} = record_id)`),
        });
      }
      if (!tableOpts.noPut) {
        const updateFields = Object.values(table.fields)
          .map(
            (f) =>
              `${f.identName} = case when (record_input->>'${f.name}') is not null then cast(record_input->>'${f.name}' as ${f.castType}) end`,
          )
          .join(", ");
        this.put(`/${urlBase}/{record_id:id}`, {
          jsonBodyScalar: `record_input`,
          procedure: (s) =>
            s
              .startTransaction()
              .modify(
                `update db.${table.identName} set ${updateFields} where ${table.primaryKeyIdent} = record_id`,
              )
              .commitTransaction().return(`(select json_build_object(
                '${table.primaryKeyFieldName}', ${table.primaryKeyIdent},
                ${jsonFieldsText}
            )
            from db.${table.identName}
            where ${table.primaryKeyIdent} = record_id)`),
        });
      }
    }
  }

  generateYom(): yom.AppApi {
    return { endpoints: this.#endpoints };
  }
}

export interface AutoOpts {
  tables?: Record<string, AutoTableOpts>;
}

export interface AutoTableOpts {
  skip?: boolean;
  noDelete?: boolean;
  noPost?: boolean;
  noPut?: boolean;
  noGetRecord?: boolean;
  noGetList?: boolean;
  relations?: (string | AutoRelationOpts)[];
}

export interface AutoRelationOpts {
  otherTable: string;
  foreignKey?: string;
  returnFields?: string[];
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
