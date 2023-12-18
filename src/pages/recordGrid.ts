import { alert } from "../components/alert";
import { circularProgress } from "../components/circularProgress";
import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { Table, hub } from "../hub";
import { Style } from "../styleTypes";
import { baseGridStyles, containerStyles, createStyles } from "../styleUtils";
import { pluralize } from "../utils/inflectors";
import { stringLiteral } from "../utils/sqlHelpers";
import { updateFormPage } from "./updateForm";
import { materialIcon } from "../components/materialIcon";
import { BasicStatements } from "../statements";
import * as yom from "../yom";
import * as superSimpleHeader from "./recordGridChild/superSimpleHeader";
import * as addressCard from "./recordGridChild/addressCard";
import * as staticTableCard from "./recordGridChild/staticTableCard";
import * as relatedTable from "./recordGridChild/relatedTable";
import * as namedPageHeader from "./recordGridChild/namedPageHeader";
import * as notesCard from "./recordGridChild/notesCard";
import * as simpleLinkRelationCard from "./recordGridChild/simpleLinkRelationCard";
import * as simpleLinkAssociationCard from "./recordGridChild/simpleLinkAssociationCard";
import * as timeline from "./recordGridChild/timeline";
import * as singleSourceTimeline from "./recordGridChild/singleSourceTimeline";
import * as addressesCard from "./recordGridChild/addressesCard";
import * as attachmentsCard from "./recordGridChild/attachmentsCard";
import * as notesListCard from "./recordGridChild/notesListCard";
import * as twoColumnDisplayCard from "./recordGridChild/twoColumnDisplayCard";

export class RecordGridBuilder {
  table: Table;
  recordId: string;
  refreshKey: string;
  triggerRefresh: BasicStatements;
  pathBase: string;
  #path?: string;
  #allow?: yom.SqlExpression;
  #rootStyles?: Style;
  #children: Node[] = [];

  constructor(table: string) {
    const tableModel = hub.db.tables[table];
    this.pathBase = pluralize(table.split("_").join(" ")).split(" ").join("-");
    this.recordId = "ui.record_id";
    this.refreshKey = "ui.record_grid_refresh_key";
    this.triggerRefresh = new BasicStatements().setScalar(
      "ui.record_grid_refresh_key",
      `ui.record_grid_refresh_key + 1`,
    );
    this.table = tableModel;
  }

  allow(expr: yom.SqlExpression) {
    this.#allow = expr;
    return this;
  }

  path(path: string) {
    this.#path = path;
    return this;
  }

  rootStyles(styles: Style) {
    this.#rootStyles = styles;
    return this;
  }

  createUpdatePage() {
    updateFormPage({
      table: this.table.name,
      afterTransactionCommit: (_, s) =>
        s.navigate(`${stringLiteral(this.pathBase)} || '/' || ui.record_id`),
      content: {
        type: "AutoLabelOnLeft",
        header: `Edit ` + this.table.displayName,
      },
    });
    return this;
  }

  superSimpleHeader(opts: superSimpleHeader.Opts) {
    this.#children.push(superSimpleHeader.content(opts, this));
    return this;
  }

  addressCard(opts: addressCard.Opts) {
    this.#children.push(addressCard.content(opts, this));
    return this;
  }

  staticTableCard(opts: staticTableCard.Opts) {
    this.#children.push(staticTableCard.content(opts, this));
    return this;
  }

  relatedTable(opts: relatedTable.Opts) {
    this.#children.push(relatedTable.content(opts, this));
    return this;
  }

  namedPageHeader(opts: namedPageHeader.Opts = {}) {
    this.#children.push(namedPageHeader.content(opts, this));
    return this;
  }

  notesCard(opts: notesCard.Opts = {}) {
    this.#children.push(notesCard.content(opts, this));
    return this;
  }

  simpleLinkRelationCard(opts: simpleLinkRelationCard.Opts) {
    this.#children.push(simpleLinkRelationCard.content(opts, this));
    return this;
  }

  simpleLinkAssociationCard(opts: simpleLinkAssociationCard.Opts) {
    this.#children.push(simpleLinkAssociationCard.content(opts, this));
    return this;
  }

  timeline(opts: timeline.Opts) {
    this.#children.push(timeline.content(opts, this));
    return this;
  }

  singleSourceTimeline(opts: singleSourceTimeline.Opts) {
    this.#children.push(singleSourceTimeline.content(opts, this));
    return this;
  }

  addressesCard(opts: addressesCard.Opts) {
    this.#children.push(addressesCard.content(opts, this));
    return this;
  }

  attachmentsCard(opts: attachmentsCard.Opts) {
    this.#children.push(attachmentsCard.content(opts, this));
    return this;
  }

  notesListCard(opts: notesListCard.Opts) {
    this.#children.push(notesListCard.content(opts, this));
    return this;
  }

  twoColumnDisplayCard(opts: twoColumnDisplayCard.Opts) {
    this.#children.push(twoColumnDisplayCard.content(opts, this));
    return this;
  }

  custom(node: Node) {
    this.#children.push(node);
    return this;
  }

  createPage() {
    const tableLowercase = stringLiteral(this.table.displayName.toLowerCase());
    const content = nodes.state({
      procedure:
        // If we update this on the service proc and not on the client proc, it will run the new state
        // in the same round trip and so there will be no switch to status = 'fallback_triggered'
        (s) => s.scalar(`record_grid_refresh_key`, `0`),
      children: nodes.state({
        watch: [`record_grid_refresh_key`],
        procedure: (s) =>
          s.scalar(
            `record_exists`,
            `exists (select 1 from db.${this.table.identName} where ${this.table.primaryKeyIdent} = ${this.recordId})`,
          ),
        allow: this.#allow,
        statusScalar: "status",
        children: nodes.switch(
          {
            condition: `status = 'fallback_triggered'`,
            node: nodes.element("div", {
              styles: styles.notContentWrapper,
              children: circularProgress({ size: "lg" }),
            }),
          },
          {
            condition: `status = 'failed' or status = 'disallowed'`,
            node: nodes.element("div", {
              styles: styles.notContentWrapper,
              children: alert({
                color: "danger",
                startDecorator: materialIcon("Report"),
                size: "lg",
                children: `'Unable to get ' || ${tableLowercase}`,
              }),
            }),
          },
          {
            condition: `not record_exists`,
            node: nodes.element("div", {
              styles: styles.notContentWrapper,
              children: alert({
                color: "danger",
                startDecorator: materialIcon("Report"),
                size: "lg",
                children: `'Unable to get ' || ${tableLowercase}`,
              }),
            }),
          },
          {
            condition: `true`,
            node: nodes.element("div", {
              styles: this.#rootStyles
                ? [styles.root(), this.#rootStyles]
                : styles.root(),
              children: this.#children,
            }),
          },
        ),
      }),
    });
    return {
      path: this.#path ?? this.pathBase + `/{record_id:id}`,
      content: nodes.sourceMap(`recordGridPage(${this.table.name})`, content),
    };
  }
}

const styles = createStyles({
  notContentWrapper: {
    display: "flex",
    justifyContent: "center",
    mt: 8,
  },
  root: () => {
    return {
      ...baseGridStyles,
      ...containerStyles(),
      py: 2,
      gap: 1.5,
      md: { gap: 2 },
    };
  },
});

export function recordGridPage(
  table: string,
  fn: (builder: RecordGridBuilder) => unknown,
) {
  const builder = new RecordGridBuilder(table);
  fn(builder);
  hub.currentApp!.pages.push(builder.createPage());
}
