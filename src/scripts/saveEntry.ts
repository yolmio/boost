import * as path from "path";
import { fileURLToPath } from "url";
import { execWithTranspiler } from "./transpileUtils.js";

execWithTranspiler(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "save.js")
);
