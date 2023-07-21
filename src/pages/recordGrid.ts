import { alert } from "../components/alert.js";
import { circularProgress } from "../components/circularProgress.js";
import { addPage } from "../modelHelpers.js";
import { element, sourceMap, state, switchNode } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { navigate, scalar, setScalar } from "../procHelpers.js";
import { model } from "../singleton.js";
import { Style } from "../styleTypes.js";
import {
  baseGridStyles,
  containerStyles,
  createStyles,
} from "../styleUtils.js";
import { pluralize } from "../utils/inflectors.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { updateFormPage } from "./updateForm.js";
import { ChildOpts, childFnMap } from "./recordGridChild/index.js";
import { RecordGridContext } from "./recordGridChild/shared.js";
import { materialIcon } from "../components/materialIcon.js";

export type { RecordGridContext };

export interface CustomChild {
  type: "custom";
  content: (props: RecordGridContext) => Node;
}

export type RecordGridChild = ChildOpts | CustomChild;

export interface RecordGridPageOpts {
  path?: string;
  allow?: string;
  table: string;
  createUpdatePage?: boolean;
  rootStyles?: Style;
  children: RecordGridChild[];
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

export function recordGridPage(opts: RecordGridPageOpts) {
  const tableModel = model.database.tables[opts.table];
  const pathBase = pluralize(opts.table.split("_").join(" "))
    .split(" ")
    .join("-");
  const path = opts.path ?? pathBase + `/{record_id:id}`;
  if (!tableModel.recordDisplayName) {
    throw new Error(
      "Table must have recordDisplayName or you must have an explicit header for cardGridRecordPage"
    );
  }
  const props: RecordGridContext = {
    recordId: "ui.record_id",
    refreshKey: "ui.record_grid_refresh_key",
    triggerRefresh: setScalar(
      "ui.record_grid_refresh_key",
      `ui.record_grid_refresh_key + 1`
    ),
    table: tableModel,
    pathBase,
  };
  const children: Node[] = [];
  for (const child of opts.children) {
    if (child.type === "custom") {
      children.push(child.content(props));
    } else {
      children.push(childFnMap[child.type](child as any, props));
    }
  }
  const tableLowercase = stringLiteral(tableModel.displayName.toLowerCase());
  const content = state({
    procedure: [
      // If we update this on the service proc and not on the client proc, it will run the new state
      // in the same round trip and so there will be no switch to status = 'fallback_triggered'
      scalar(`record_grid_refresh_key`, `0`),
    ],
    children: state({
      watch: [`record_grid_refresh_key`],
      procedure: [
        scalar(
          `record_exists`,
          `exists (select id from db.${opts.table} where id = record_id)`
        ),
      ],
      allow: opts.allow,
      statusScalar: "status",
      children: switchNode(
        [
          `status = 'fallback_triggered'`,
          element("div", {
            styles: styles.notContentWrapper,
            children: circularProgress({ size: "lg" }),
          }),
        ],
        [
          `status = 'failed' or status = 'disallowed'`,
          element("div", {
            styles: styles.notContentWrapper,
            children: alert({
              color: "danger",
              startDecorator: materialIcon("Report"),
              size: "lg",
              children: `'Unable to get ' || ${tableLowercase}`,
            }),
          }),
        ],
        [
          `not record_exists`,
          element("div", {
            styles: styles.notContentWrapper,
            children: alert({
              color: "danger",
              startDecorator: materialIcon("Report"),
              size: "lg",
              children: `'Unable to get ' || ${tableLowercase}`,
            }),
          }),
        ],
        [
          `true`,
          element("div", {
            styles: opts.rootStyles
              ? [styles.root(), opts.rootStyles]
              : styles.root(),
            children,
          }),
        ]
      ),
    }),
  });
  if (opts.createUpdatePage) {
    updateFormPage({
      table: opts.table,
      afterSubmitService: () => [
        navigate(`${stringLiteral(pathBase)} || '/' || ui.record_id`),
      ],
      content: {
        type: "AutoLabelOnLeft",
        header: `Edit ` + tableModel.displayName,
      },
    });
  }
  addPage({
    path,
    content: sourceMap(`recordGridPage(table: ${opts.table})`, content),
  });
}
