import * as threeStats from "./threeStats";
import * as table from "./table";
import * as header from "./header";
import * as lineChart from "./lineChart";
import * as pieChart from "./pieChart";
import * as barChart from "./barChart";

export const childFnMap = {
  [threeStats.name]: threeStats.content,
  [table.name]: table.content,
  [header.name]: header.content,
  [lineChart.name]: lineChart.content,
  [pieChart.name]: pieChart.content,
  [barChart.name]: barChart.content,
};

export type ChildOpts =
  | (threeStats.Opts & { type: typeof threeStats.name })
  | (table.Opts & { type: typeof table.name })
  | (header.Opts & { type: typeof header.name })
  | (lineChart.Opts & { type: typeof lineChart.name })
  | (pieChart.Opts & { type: typeof pieChart.name })
  | (barChart.Opts & { type: typeof barChart.name });
