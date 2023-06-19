import * as simpleDistinctLineChartCard from "./simpleDistinctLineChartCard.js";
import * as threeStats from "./threeStats.js";

export const childFnMap = {
  [simpleDistinctLineChartCard.name]: simpleDistinctLineChartCard.content,
  [threeStats.name]: threeStats.content,
};

export type ChildOpts =
  | (simpleDistinctLineChartCard.Opts & {
      type: typeof simpleDistinctLineChartCard.name;
    })
  | (threeStats.Opts & { type: typeof threeStats.name });
