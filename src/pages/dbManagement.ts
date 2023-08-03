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
import { addPage } from "../appHelpers.js";
import { Node } from "../nodeTypes.js";
import { app } from "../singleton.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { createStyles, flexGrowStyles } from "../styleUtils.js";
import { chip } from "../components/chip.js";
import { divider } from "../components/divider.js";
import { isDeploy } from "../utils/env.js";

const styles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    lg: { flexDirection: "row" },
  },
  schemaWrapper: {
    height: "100%",
    width: "100%",
    position: "relative",
    borderRight: "1px solid",
    borderColor: "divider",
    flexShrink: 0,
    order: 1,
    lg: { width: 340, order: 0 },
  },
  schema: {
    position: "absolute",
    inset: 0,
    px: 1,
    py: 1,
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
    lg: {
      overflowY: "auto",
    },
  },
  tableFields: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "primary-50",
    dark: {
      backgroundColor: "primary-800",
    },
    p: 1,
  },
  enumValues: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "primary-50",
    dark: {
      backgroundColor: "primary-800",
    },
    p: 1,
  },
  enumValue: {
    fontSize: "sm",
    py: 0.5,
    borderBottom: "1px solid",
    borderColor: "divider",
    alignItems: "center",
    width: "100%",
  },
  schemaField: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    py: 0.5,
    borderBottom: "1px solid",
    borderColor: "divider",
    alignItems: "center",
  },
  tabs: {
    flexGrow: 1,
    py: 2,
    px: 1,
  },
  expandable: {
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    px: 1,
    py: 1,
    fontSize: "sm",
    fontWeight: "md",
    textDecoration: "none",
    color: "text-secondary",
    borderRadius: "md",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "primary-50",
      dark: {
        backgroundColor: "primary-800",
      },
    },
    "&.active": {
      color: "primary-plain-color",
      backgroundColor: "primary-50",
      dark: {
        backgroundColor: "primary-800",
      },
    },
    "&:active": {
      backgroundColor: "primary-100",
      dark: {
        backgroundColor: "primary-700",
      },
    },
  },
  fieldName: {
    display: "block",
    fontSize: "sm",
  },
  notNullFieldName: {
    display: "flex",
    gap: 1,
  },
  fieldType: {
    display: "block",
    fontSize: "sm",
    color: "text-secondary",
  },
  txInfoText: {
    my: 1,
    fontSize: "sm",
  },
  txInfoCode: {
    my: 1,
    fontFamily: "monospace",
    fontSize: "sm",
  },
});

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

interface FieldDisplayOpts {
  name: string;
  notNull: boolean;
  type: string;
}

function displayField({ name, notNull, type }: FieldDisplayOpts) {
  return element("div", {
    styles: styles.schemaField,
    children: [
      notNull
        ? element("div", {
            styles: styles.notNullFieldName,
            children: [
              element("span", {
                styles: styles.fieldName,
                children: stringLiteral(name),
              }),
              notNull
                ? chip({
                    color: "neutral",
                    variant: "soft",
                    children: `'not null'`,
                    size: "sm",
                  })
                : undefined,
            ],
          })
        : element("span", {
            styles: styles.fieldName,
            children: stringLiteral(name),
          }),
      element("span", {
        styles: styles.fieldType,
        children: stringLiteral(type),
      }),
    ],
  });
}

function collapse(label: string, node: Node) {
  return state({
    procedure: [scalar(`open`, `false`)],
    children: [
      element("div", {
        styles: styles.expandable,
        dynamicClasses: [
          {
            condition: `open`,
            classes: "active",
          },
        ],
        children: [
          stringLiteral(label),
          element("div", { styles: flexGrowStyles }),
          ifNode(
            `open`,
            materialIcon("KeyboardArrowDown"),
            materialIcon("KeyboardArrowRight")
          ),
        ],
        on: {
          click: [setScalar(`ui.open`, `not open`)],
        },
      }),
      ifNode(`open`, node),
    ],
  });
}

function transactionQueryReference(): Node[] {
  const userFk = app.database.userTableName;
  return [
    typography({ level: "h5", children: "'Transaction Queries'" }),
    divider(),
    collapse(
      "tx",
      element("div", {
        styles: styles.tableFields,
        children: [
          displayField({ name: "id", type: "biguint", notNull: true }),
          displayField({
            name: "timestamp",
            type: "timestamp",
            notNull: true,
          }),
          displayField({
            name: "creator",
            type: `${userFk} (fk)`,
            notNull: false,
          }),
        ],
      })
    ),
    collapse(
      "tx_op",
      element("div", {
        styles: styles.tableFields,
        children: [
          displayField({ name: "tx_id", type: "biguint", notNull: true }),
          displayField({
            name: "tx_timestamp",
            type: "timestamp",
            notNull: true,
          }),
          displayField({
            name: "tx_creator",
            type: `${userFk} (fk)`,
            notNull: false,
          }),
          displayField({
            name: "kind",
            type: "sys_op_kind (enum)",
            notNull: true,
          }),
          displayField({
            name: "table",
            type: "sys_db_table (enum)",
            notNull: true,
          }),
          displayField({
            name: "skip_count",
            type: "biguint",
            notNull: false,
          }),
          displayField({
            name: "sequence_id",
            type: "biguint",
            notNull: true,
          }),
          displayField({
            name: "record_id",
            type: "biguint",
            notNull: true,
          }),
        ],
      })
    ),
    collapse(
      "{table}_as_of",
      element("div", {
        styles: styles.tableFields,
        children: [
          element("p", {
            styles: styles.txInfoText,
            children: `'This table gives you access to all the fields of a table record as of a certain transaction (i.e. after that transaction was applied). For example: '`,
          }),
          element("p", {
            styles: styles.txInfoCode,
            children: `'select first_name from contact_as_of(0, 1)'`,
          }),
          element("p", {
            styles: styles.txInfoText,
            children: `'The above query gets the first_name of the contact with id 0 after the second transaction (transaction with id 1) was applied.'`,
          }),
        ],
      })
    ),
    collapse(
      "{table}_insert_op",
      element("div", {
        styles: styles.tableFields,
        children: [
          element("p", {
            styles: styles.txInfoText,
            children: `'This table gives you detailed access to insert operations for the table specified. In addition to the fields below you can access all of the fields in the insert with field_{field_name}. For example:'`,
          }),
          element("p", {
            styles: styles.txInfoCode,
            children: `'select field_name from contact_insert_op'`,
          }),
          element("p", {
            styles: styles.txInfoText,
            children: `'The above query gets the name field value on all insert operations.'`,
          }),
          displayField({ name: "tx_id", type: "biguint", notNull: true }),
          displayField({
            name: "tx_timestamp",
            type: "timestamp",
            notNull: true,
          }),
          displayField({
            name: "tx_creator",
            type: `${userFk} (fk)`,
            notNull: false,
          }),
          displayField({
            name: "record_id",
            type: "biguint",
            notNull: true,
          }),
        ],
      })
    ),
    collapse(
      "{table}_update_op",
      element("div", {
        styles: styles.tableFields,
        children: [
          element("p", {
            styles: styles.txInfoText,
            children: `'This table gives you detailed access to update operations for the table specified. In addition to the fields below you can access all of the fields in the update with field_{field_name} and you can check if it is populated through populated_{field_name}. For example:'`,
          }),
          element("p", {
            styles: styles.txInfoCode,
            children: `'select field_checked from todo_update_op where populated_checked'`,
          }),
          element("p", {
            styles: styles.txInfoText,
            children: `'The above query gets the checked field value on all update operations where the checked field was populated.'`,
          }),
          displayField({ name: "tx_id", type: "biguint", notNull: true }),
          displayField({
            name: "tx_timestamp",
            type: "timestamp",
            notNull: true,
          }),
          displayField({
            name: "tx_creator",
            type: `${userFk} (fk)`,
            notNull: false,
          }),
          displayField({
            name: "record_id",
            type: "biguint",
            notNull: true,
          }),
        ],
      })
    ),
    collapse(
      "sys_op_kind",
      element("div", {
        styles: styles.enumValues,
        children: [
          element("div", {
            styles: styles.enumValue,
            children: `'insert'`,
          }),
          element("div", {
            styles: styles.enumValue,
            children: `'update'`,
          }),
          element("div", {
            styles: styles.enumValue,
            children: `'delete'`,
          }),
          element("div", { styles: styles.enumValue, children: `'skip'` }),
          element("div", {
            styles: styles.enumValue,
            children: `'restore'`,
          }),
        ],
      })
    ),
    collapse(
      "sys_db_table",
      element("div", {
        styles: styles.enumValues,
        children: Object.keys(app.database.tables).map((name) =>
          element("div", {
            styles: styles.enumValue,
            children: stringLiteral(name),
          })
        ),
      })
    ),
  ];
}

function schemaReference() {
  return element("div", {
    styles: styles.schemaWrapper,
    children: element("div", {
      styles: styles.schema,
      children: [
        typography({ level: "h5", children: "'Tables'" }),
        divider(),
        Object.values(app.database.tables).map((table) => {
          const fields = Object.values(table.fields).map((field) => {
            let typeString = field.type.toLowerCase();
            if (field.type === "ForeignKey") {
              typeString = `${field.table} (fk)`;
            } else if (field.type === "Enum") {
              typeString = `${field.enum} (enum)`;
            } else if (field.type === "Tx") {
              typeString = `tx (biguint)`;
            }
            return displayField({
              name: field.name,
              notNull: field.notNull ?? false,
              type: typeString,
            });
          });
          if (app.database.enableTransactionQueries) {
            fields.unshift(
              displayField({
                name: "last_modified_by_tx",
                notNull: true,
                type: "tx (biguint)",
              }),
              displayField({
                name: "created_by_tx",
                notNull: true,
                type: "tx (biguint)",
              })
            );
          }
          fields.unshift(
            displayField({
              name: table.primaryKeyFieldName,
              notNull: true,
              type: "pk (biguint)",
            })
          );
          return collapse(
            table.name,
            element("div", { styles: styles.tableFields, children: fields })
          );
        }),
        typography({ level: "h5", children: "'Enums'" }),
        divider(),
        Object.values(app.enums)
          .filter((enum_) =>
            Object.values(app.database.tables).some((t) =>
              Object.values(t.fields).some(
                (f) => f.type === "Enum" && f.enum === enum_.name
              )
            )
          )
          .map((enum_) => {
            return collapse(
              enum_.name,
              element("div", {
                styles: styles.enumValues,
                children: Object.values(enum_.values).map((v) =>
                  element("div", {
                    styles: styles.enumValue,
                    children: stringLiteral(v.name),
                  })
                ),
              })
            );
          }),
        ...(app.database.enableTransactionQueries
          ? transactionQueryReference()
          : []),
      ],
    }),
  });
}

interface DbManagmentPageOpts {
  path?: string;
  allow?: SqlExpression;
  doNotDeploy?: boolean;
}

export function dbManagementPage(opts: DbManagmentPageOpts = {}) {
  if (opts.doNotDeploy && !isDeploy()) {
    return;
  }
  let content: Node = element("div", {
    styles: styles.root,
    children: [
      schemaReference(),
      tabs({
        styles: styles.tabs,
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
    path: opts.path ?? `/db-management`,
    content,
  });
}
