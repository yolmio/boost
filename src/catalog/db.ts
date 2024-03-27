import { addViewTables } from "../pages/datagridInternals/datagridBase";
import { Db } from "../system";

export class DbCatalog {
  #db: Db;

  /**
   * Catalog for single tables.
   */
  table: DbTableCatalog;
  /**
   * Catalog for multiple tables.
   */
  tables: DbTablesCatalog;

  constructor(db: Db) {
    this.#db = db;
    this.table = new DbTableCatalog(this.#db);
    this.tables = new DbTablesCatalog(this.#db);
  }
}

export class DbTableCatalog {
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
  notes(mainTable: string) {
    this.#db.table(mainTable + "_note", (table) => {
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
  attachments(mainTable: string) {
    this.#db.table(mainTable + "_attachment", (table) => {
      table.fk(mainTable).notNull();
      table.string("name", 100).notNull();
      table.uuid("file").notNull();
    });
  }
}

export class DbTablesCatalog {
  #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /**
   * Adds tables that allow views to be stored and reused for various datagrids
   *
   * @param datagrids
   */
  datagridView(datagrids: string[]) {
    addViewTables(datagrids);
  }
}
