import { each, element, ifNode, state, switchNode } from "../nodeHelpers.js";
import {
  commitTransaction,
  debugQuery,
  download,
  dynamicModify,
  dynamicQuery,
  dynamicQueryToCsv,
  exit,
  focusEl,
  if_,
  scalar,
  serviceProc,
  setScalar,
  startTransaction,
  throwError,
  try_,
} from "../procHelpers.js";
import { alert } from "../components/alert.js";
import { button } from "../components/button.js";
import { circularProgress } from "../components/circularProgress.js";
import { materialIcon } from "../components/materialIcon.js";
import { tabs } from "../components/tabs.js";
import { textarea } from "../components/textarea.js";
import { typography } from "../components/typography.js";
import { ClientProcStatement, SqlExpression } from "../yom.js";
import { input } from "../components/input.js";
import { addPage } from "../modelHelpers.js";
import { Node } from "../nodeTypes.js";

function undoTxTab() {
  return state({
    procedure: [
      scalar(`tx_id`, `''`),
      scalar(`succeeded`, `false`),
      scalar(`err_type`, { type: "Enum", enum: "sys_error_type" }),
      scalar(`err_message`, { type: "String", maxLength: 2000 }),
      scalar(`err_description`, { type: "String", maxLength: 2000 }),
    ],
    children: [
      input({
        styles: { mt: 2 },
        slots: {
          input: {
            props: { value: `tx_id`, placeholder: `'a valid transaction id'` },
            on: {
              input: [setScalar(`ui.tx_id`, `target_value`)],
            },
          },
        },
      }),
      element("div", {
        styles: { display: "flex", gap: 1, mt: 1 },
        children: [
          button({
            children: `'Undo transaction'`,
            on: {
              click: [
                try_<ClientProcStatement>({
                  body: [
                    if_(`try_cast(ui.tx_id as bigint) is null`, [exit()]),
                    serviceProc([
                      startTransaction(),
                      { t: "UndoTx", tx: `cast(ui.tx_id as bigint)` },
                      commitTransaction(),
                    ]),
                    setScalar(`ui.succeeded`, `true`),
                    setScalar(`ui.err_type`, `null`),
                    setScalar(`ui.err_message`, `null`),
                    setScalar(`ui.err_description`, `null`),
                  ],
                  errorName: `err`,
                  catch: [
                    setScalar(`ui.succeeded`, `false`),
                    setScalar(`ui.err_type`, `err.type`),
                    setScalar(`ui.err_message`, `err.message`),
                    setScalar(`ui.err_description`, `err.description`),
                  ],
                }),
              ],
            },
          }),
        ],
      }),
      ifNode(
        `succeeded`,
        alert({
          startDecorator: materialIcon("CheckCircle"),
          color: "success",
          children: `'Successfully undid transaction ' || tx_id`,
        })
      ),
      ifNode(
        `err_type is not null`,
        element("div", {
          styles: { maxWidth: 400 },
          children: [
            alert({
              startDecorator: materialIcon("Report"),
              color: "danger",
              children: `'Error Type: ' || err_type`,
            }),
            typography({
              children: `err_message`,
            }),
            typography({
              children: `err_description`,
            }),
          ],
        })
      ),
    ],
  });
}

function modifyTab() {
  return state({
    procedure: [
      scalar(`statement`, `''`),
      scalar(`tx_id`, { type: "BigUint" }),
      scalar(`err_type`, { type: "Enum", enum: "sys_error_type" }),
      scalar(`err_message`, { type: "String", maxLength: 2000 }),
      scalar(`err_description`, { type: "String", maxLength: 2000 }),
    ],
    children: [
      textarea({
        styles: { mt: 2 },
        slots: {
          textarea: {
            props: {
              value: `statement`,
              rows: `10`,
              placeholder: `'delete from problem where is_easy'`,
            },
            on: {
              input: [setScalar(`ui.statement`, `target_value`)],
            },
          },
        },
      }),
      element("div", {
        styles: { display: "flex", gap: 1, my: 1 },
        children: [
          button({
            children: `'Run statement'`,
            on: {
              click: [
                try_<ClientProcStatement>({
                  body: [
                    serviceProc([
                      startTransaction(),
                      setScalar(`ui.tx_id`, `current_tx()`),
                      dynamicModify(`ui.statement`),
                      commitTransaction(),
                    ]),
                    setScalar(`ui.err_type`, `null`),
                    setScalar(`ui.err_message`, `null`),
                    setScalar(`ui.err_description`, `null`),
                  ],
                  errorName: `err`,
                  catch: [
                    setScalar(`ui.tx_id`, `null`),
                    setScalar(`ui.err_type`, `err.type`),
                    setScalar(`ui.err_message`, `err.message`),
                    setScalar(`ui.err_description`, `err.description`),
                  ],
                }),
              ],
            },
          }),
        ],
      }),
      ifNode(
        `tx_id is not null`,
        alert({
          startDecorator: materialIcon("CheckCircle"),
          color: "success",
          children: `'Successfully ran statement. Transaction id is: ' || tx_id`,
        })
      ),
      ifNode(
        `err_type is not null`,
        element("div", {
          styles: { maxWidth: 400 },
          children: [
            alert({
              startDecorator: materialIcon("Report"),
              color: "danger",
              children: `'Error Type: ' || err_type`,
            }),
            typography({
              children: `err_message`,
            }),
            typography({
              children: `err_description`,
            }),
          ],
        })
      ),
    ],
  });
}

function queryTab() {
  return state({
    procedure: [
      scalar(`query`, `''`),
      scalar(`query_to_run`, { type: "String", maxLength: 2000 }),
    ],
    children: [
      textarea({
        styles: { mt: 2 },
        slots: {
          textarea: {
            props: {
              value: `query`,
              rows: `10`,
              placeholder: `'select id, creator, timestamp\nfrom tx\norder by id desc\nlimit 5'`,
            },
            on: {
              input: [setScalar(`ui.query`, `target_value`)],
              keydown: [
                if_(
                  `event.key = 'Enter' and (event.ctrl_key or event.meta_key)`,
                  [setScalar(`ui.query_to_run`, `ui.query`)]
                ),
              ],
            },
          },
        },
      }),
      element("div", {
        styles: { display: "flex", gap: 1, mt: 1 },
        children: [
          button({
            children: `'Display results'`,
            on: { click: [setScalar(`ui.query_to_run`, `ui.query`)] },
          }),
          button({
            children: `'Download query results'`,
            color: "neutral",
            variant: "soft",
            on: {
              click: [
                scalar(`csv`, { type: "String", maxLength: 65000 }),
                serviceProc([
                  dynamicQueryToCsv(`ui.query`, `query_csv`),
                  setScalar(`csv`, `query_csv`),
                ]),
                download(`'result.csv'`, `csv`),
              ],
            },
          }),
        ],
      }),
      state({
        watch: [`query_to_run`],
        procedure: [
          if_(`query_to_run is null`, [exit()]),
          dynamicQuery({
            resultTable: "dyn_result",
            query: `query_to_run`,
            columnCount: 20,
            columnMetaTable: `meta`,
          }),
        ],
        errorRecord: `error`,
        statusScalar: `status`,
        children: switchNode(
          [
            `status in ('requested', 'fallback_triggered')`,
            circularProgress({ size: "lg" }),
          ],
          [
            `status = 'failed'`,
            element("div", {
              styles: { maxWidth: 400 },
              children: [
                alert({
                  startDecorator: materialIcon("Report"),
                  color: "danger",
                  children: `'Error Type: ' || error.type`,
                }),
                typography({
                  children: `error.message`,
                }),
                typography({
                  children: `error.description`,
                }),
              ],
            }),
          ],
          [
            `status = 'received'`,
            element("table", {
              children: [
                element("thead", {
                  children: element("tr", {
                    children: each({
                      table: `meta`,
                      recordName: `column`,
                      children: element("th", {
                        styles: {
                          textAlign: "left",
                          px: "10px",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          typography: "body1",
                        },
                        children: `column.name`,
                      }),
                    }),
                  }),
                }),
                element("tbody", {
                  children: each({
                    table: `dyn_result`,
                    recordName: `record`,
                    children: element("tr", {
                      children: each({
                        table: `meta`,
                        recordName: `column`,
                        children: element("td", {
                          styles: {
                            px: "10px",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                            typography: "body1",
                          },
                          children: `dynamic_field(record, column.index)`,
                        }),
                      }),
                    }),
                  }),
                }),
              ],
            }),
          ]
        ),
      }),
    ],
  });
}

interface AdminPageOpts {
  path?: string;
  allow?: SqlExpression;
}

export function adminPage(opts: AdminPageOpts = {}) {
  let content: Node = element("div", {
    styles: { p: 2 },
    children: [
      tabs({
        idBase: `'tabs'`,
        tabs: [
          {
            content: queryTab(),
            tabButton: `'Query'`,
          },
          {
            content: modifyTab(),
            tabButton: `'Modify'`,
          },
          {
            content: undoTxTab(),
            tabButton: `'Undo Transaction'`,
          },
        ],
      }),
    ],
  });
  if (opts.allow) {
    content = state({
      allow: opts.allow,
      procedure: [],
      statusScalar: "status",
      children: [
        switchNode(
          [`status = 'fallback_triggered'`, circularProgress({ size: "lg" })],
          [
            `status = 'failed'`,
            alert({
              color: "danger",
              children: `'Unable to load page.'`,
            }),
          ],
          [
            `status = 'disallowed'`,
            alert({
              color: "danger",
              children: `'You are not authorized to view this page.'`,
            }),
          ],
          [`true`, content]
        ),
      ],
    });
  }
  addPage({
    path: opts.path ?? `/admin`,
    content,
  });
}
