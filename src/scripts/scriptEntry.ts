import * as path from "path";
import { fileURLToPath } from "url";
import { execWithTranspiler } from "./transpileUtils";

execWithTranspiler(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "script.js")
);
