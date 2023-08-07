import { pluralize } from "./inflectors";

export function getTableBaseUrl(table: string): string {
  return pluralize(table.split("_").join(" ")).split(" ").join("-");
}
