import type { Names } from "./modelTypes.js";
import type { FuzzyConfig, Tokenizer } from "./yom.js";

export type HelperName = string | (Partial<Names> & { name: string });

export interface BoostConfig {
  createNameObject: (name: HelperName) => Names;
  defaultFuzzyConfig: FuzzyConfig;
  defaultTokenizer: Tokenizer;
}
