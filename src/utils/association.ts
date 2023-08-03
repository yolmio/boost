import { Field, Table } from "../appTypes.js";
import { app } from "../singleton.js";

interface AssociationTableMatch {
  table: Table;
  toLeft: Field;
  toRight: Field;
}

type GetAssociationTableResult =
  | "ambiguous"
  | "notFound"
  | AssociationTableMatch;

export function getAssociationTable(
  leftTable: string,
  rightTable: string
): GetAssociationTableResult {
  const possibleMatches: AssociationTableMatch[] = [];
  for (const assocTable of Object.values(app.database.tables)) {
    const assocTableFields = Object.values(assocTable.fields);
    const toLeft = assocTableFields.find(
      (f) => f.type === "ForeignKey" && f.table === leftTable
    );
    const toRight = assocTableFields.find(
      (f) => f.type === "ForeignKey" && f.table === rightTable
    );
    if (toLeft && toRight) {
      possibleMatches.push({ table: assocTable, toLeft, toRight });
    }
  }
  if (possibleMatches.length === 0) {
    return "notFound";
  }
  if (possibleMatches.length > 1) {
    return "ambiguous";
  }
  return possibleMatches[0];
}
