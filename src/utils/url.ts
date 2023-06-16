import { pluralize } from "./inflectors.js";

export function getTableBaseUrl(table: string): string {
  return pluralize(table.split("_").join(" ")).split(" ").join("-");
}
