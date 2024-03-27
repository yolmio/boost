import { system } from "../system";
import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { baseGridStyles, createStyles } from "../styleUtils";
import { containerStyles } from "../styleUtils";
import * as header from "./dashboardGridChild/header";
import * as statRow from "./dashboardGridChild/statRow";
import * as table from "./dashboardGridChild/table";
import * as barChart from "./dashboardGridChild/barChart";
import * as pieChart from "./dashboardGridChild/pieChart";
import * as lineChart from "./dashboardGridChild/lineChart";

const styles = createStyles({
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

  /**
   * Override the path for the page
   */
  path(path: string): this {
    this.#path = path;
    return this;
  }

  header(opts: header.Opts) {
    this.#children.push(header.content(opts));
    return this;
  }

  /**
   * Create a row of stats, this takes an array of 2-4 stats to display and will display them in a row
   * that goes across the whole page.
   *
   * It will be vertical on mobile and horizontal on desktop.
   */
  statRow(opts: statRow.Opts) {
    this.#children.push(statRow.content(opts));
    return this;
  }

  /**
   * Display a table with the given query and columns.
   */
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

  /**
   * Defines a pie chart to display on the dashboard.
   */
  pieChart(opts: pieChart.Opts) {
    this.#children.push(pieChart.content(opts));
    return this;
  }

  /**
   * Adds a custom node to the dashboard grid.
   *
   * Make sure to have styles on the root element that size it correctly in the grid.
   */
  custom(node: Node) {
    this.#children.push(node);
    return this;
  }

  // used externally, but we don't want to polute the public API

  private createNode() {
    return nodes.element("div", {
      styles: styles.root(),
      children: this.#children,
    });
  }

  private createPage() {
    return {
      path: this.#path,
      content: this.createNode(),
    };
  }
}
