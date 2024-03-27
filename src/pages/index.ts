import { Node } from "../nodeTypes";
import { App, Page } from "../system";
import { DashboardGridBuilder } from "./dashboardGrid";
import {
  DbManagmentPageOpts,
  createDbManagementPageNode,
} from "./dbManagement";
import { FormPages } from "./forms/index";
import { RecordGridBuilder } from "./recordGrid";
import { SimpleDatagridPageBuilder } from "./simpleDatagrid";
import { SimpleReportsPageBuilder } from "./simpleReportPage";
import { DatagridPageBuilder } from "./datagrid";

export class Pages {
  #pages: Page[] = [];
  forms: FormPages;

  constructor(private app: App) {
    this.forms = new FormPages(this.app);
  }

  /**
   * Adds a page to the app.
   */
  push(page: Page) {
    this.#pages.push(page);
  }

  get pages() {
    return this.#pages;
  }

  /**
   * Creates a dashboard grid page, but doesn't add it to the pages, instead returns the node.
   */
  createDashboardGridNode(fn: (page: DashboardGridBuilder) => any): Node {
    const builder = new DashboardGridBuilder();
    fn(builder);
    return (builder as any).createNode();
  }

  /**
   * Defines a dashboard grid page.
   *
   * This creates a page with a grid layout (12 columns) and has components like stats, tables, charts, etc.
   *
   * The default path of the page is `/`, this can be ovewritten.
   */
  dashboardGrid(fn: (page: DashboardGridBuilder) => any) {
    const builder = new DashboardGridBuilder();
    fn(builder);
    this.push((builder as any).createPage());
  }

  createDbManagementNode(opts: DbManagmentPageOpts = {}): Node {
    return createDbManagementPageNode(opts);
  }

  dbManagement(opts: DbManagmentPageOpts = {}) {
    this.push({
      path: opts.path ?? `/db-management`,
      content: this.createDbManagementNode(opts),
    });
  }

  createRecordGridNode(
    table: string,
    fn: (builder: RecordGridBuilder) => any,
  ): Node {
    const builder = new RecordGridBuilder(table, this.app);
    fn(builder);
    return (builder as any).createNode();
  }

  /**
   * Defines a page for a table that displays information about a single record.
   *
   * This creates a page with a grid layout (12 columns) and has components to display information about
   * the record.
   *
   * The default path of the page is `/table/{record_id:id}`, this can be ovewritten. Check `Table.getBaseUrl()`
   * for the default path logic for tables.
   */
  recordGrid(table: string, fn: (builder: RecordGridBuilder) => any) {
    const builder = new RecordGridBuilder(table, this.app);
    fn(builder);
    this.push((builder as any).createPage());
  }

  createSimpleReportsNode(
    fn: (builder: SimpleReportsPageBuilder) => any,
  ): Node {
    const builder = new SimpleReportsPageBuilder();
    fn(builder);
    return (builder as any).createNode();
  }

  simpleReports(fn: (builder: SimpleReportsPageBuilder) => any) {
    const builder = new SimpleReportsPageBuilder();
    fn(builder);
    this.push((builder as any).createPage());
  }

  createSimpleDatagridNode(
    table: string,
    fn: (builder: SimpleDatagridPageBuilder) => any,
  ): Node {
    const builder = new SimpleDatagridPageBuilder(table);
    fn(builder);
    return (builder as any).createNode();
  }

  simpleDatagrid(
    table: string,
    fn: (builder: SimpleDatagridPageBuilder) => any,
  ) {
    const builder = new SimpleDatagridPageBuilder(table);
    fn(builder);
    this.push((builder as any).createPage());
  }

  /**
   * Creates a datagrid page, but doesn't add it to the pages, instead returns the node.
   */
  createDatagridNode(
    table: string,
    fn: (builder: DatagridPageBuilder) => any,
  ): Node {
    const builder = new DatagridPageBuilder(table);
    fn(builder);
    return (builder as any).createNode();
  }

  /**
   * Defines an editable datagrid page for this table.
   *
   * By default will be at the tables base path (e.g. /contacts for contact), but can be overwritten. Check `Table.getBaseUrl()`
   * for the default path logic for tables
   */
  datagrid(table: string, fn: (builder: DatagridPageBuilder) => any) {
    const builder = new DatagridPageBuilder(table);
    fn(builder);
    this.push((builder as any).createPage());
  }
}
