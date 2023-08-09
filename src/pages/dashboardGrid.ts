import { app } from "../app";
import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { baseGridStyles, createStyles } from "../styleUtils";
import { containerStyles } from "../styleUtils";
import * as header from "./dashboardGridChild/header";
import * as threeStats from "./dashboardGridChild/threeStats";
import * as table from "./dashboardGridChild/table";
import * as barChart from "./dashboardGridChild/barChart";
import * as pieChart from "./dashboardGridChild/pieChart";
import * as lineChart from "./dashboardGridChild/lineChart";

const styles = createStyles({
  header: {
    ml: 1.5,
    my: 1,
  },
  loadingWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 156,
  },
  root: () => ({
    ...containerStyles(),
    ...baseGridStyles,
    py: 2,
    gap: 2,
    md: { gap: 4 },
  }),
});

export class DashboardGridBuilder {
  #path = "/";
  #children: Node[] = [];

  path(path: string): this {
    this.#path = path;
    return this;
  }

  header(opts: header.Opts) {
    this.#children.push(header.content(opts));
    return this;
  }

  threeStats(opts: threeStats.Opts) {
    this.#children.push(threeStats.content(opts));
    return this;
  }

  table(opts: table.Opts) {
    this.#children.push(table.content(opts));
    return this;
  }

  barChart(opts: barChart.Opts) {
    this.#children.push(barChart.content(opts));
    return this;
  }

  lineChart(opts: lineChart.Opts) {
    this.#children.push(lineChart.content(opts));
    return this;
  }

  pieChart(opts: pieChart.Opts) {
    this.#children.push(pieChart.content(opts));
    return this;
  }

  createPage() {
    return {
      path: this.#path,
      content: nodes.element("div", {
        styles: styles.root(),
        children: this.#children,
      }),
    };
  }
}

export function dashboardGridPage(fn: (page: DashboardGridBuilder) => any) {
  const builder = new DashboardGridBuilder();
  fn(builder);
  app.ui.pages.push(builder.createPage());
}
