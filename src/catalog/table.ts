import { addTable } from "../appHelpers.js";

export interface Notes {
  type: "notes";
  mainTable: string;
}

function notes(catalog: Notes) {
  addTable(catalog.mainTable + "_note", (table) => {
    table.fk(catalog.mainTable).notNull();
    table.string("content", 2000).notNull();
    table.date("date").notNull();
  });
}

export interface Attachments {
  type: "attachments";
  mainTable: string;
}

function attachments(catalog: Attachments) {
  addTable(catalog.mainTable + "_attachment", (table) => {
    table.fk(catalog.mainTable).notNull();
    table.string("name", 100).notNull();
    table.uuid("file").notNull();
  });
}

export type TableCatalog = Notes | Attachments;

export function applyTableCatalog(catalog: TableCatalog) {
  switch (catalog.type) {
    case "notes":
      return notes(catalog);
    case "attachments":
      return attachments(catalog);
  }
}
