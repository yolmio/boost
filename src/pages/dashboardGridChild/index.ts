import * as simpleDistinctLineChartCard from "./simpleDistinctLineChartCard.js";

export const childFnMap = {
  [simpleDistinctLineChartCard.name]: simpleDistinctLineChartCard.content,
};

export type ChildOpts =
  | simpleDistinctLineChartCard.Opts & {
      type: typeof simpleDistinctLineChartCard.name;
    };
