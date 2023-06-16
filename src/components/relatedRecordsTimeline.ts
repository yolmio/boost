import { VirtualType } from "../modelTypes.js";
import { each, element, eventHandlers, ifNode, state } from "../nodeHelpers.js";
import {
  commitTransaction,
  commitUiChanges,
  exit,
  getElProperty,
  getWindowProperty,
  if_,
  modify,
  scalar,
  serviceProc,
  setScalar,
  startTransaction,
  table,
  try_,
} from "../procHelpers.js";
import { model } from "../singleton.js";
import { AllSystemCSSProperties, Style, StyleObject } from "../styleTypes.js";
import { cssVar } from "../styleUtils.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { createRelatedUnionQuery, UnionRecordHelper } from "../utils/union.js";
import { chip } from "./chip.js";
import { iconButton } from "./iconButton.js";
import { materialIcon } from "./materialIcon.js";
import { IconName } from "./materialIconNames.js";
import { popoverMenu } from "./menu.js";
import { typography } from "./typography.js";
import { confirmDangerDialog } from "./confirmDangerDialog.js";
import { updateDialog } from "./updateDialog.js";
import { button } from "./button.js";
import { insertDialog } from "./insertDialog.js";
import { divider } from "./divider.js";
import {
  ClientProcStatement,
  DynamicClass,
  ServiceProcStatement,
  StateStatement,
} from "../yom.js";
import { Node } from "../nodeTypes.js";
import { FormState } from "../formState.js";
import { getUniqueUiId } from "./utils.js";
import { AutoLabelOnLeftFieldOverride } from "./internal/updateFormShared.js";

export interface RelatedRecordsTimelineOpts {
  foreignKeyId: string;
  foreignKeyTable: string;
  dateField: string;
  timelineHeader: string;
  additionalState?: StateStatement[];
  afterHeaderNode?: Node;
  styles?: Style;
  tables: {
    table: string;
    /**
     * Specify a special from clause for the query to get this table
     *
     * For example if you want to display a table in the timeline that is referenced only by
     * the main table (i.e. a to 1 relationship instead of to N).
     *
     * 'from db.contact join db.other_table on contact.fk = other_table.id'
     */
    customFrom?: string;

    dateExpr?: string;

    dotColor: AllSystemCSSProperties["backgroundColor"];
    icon: IconName;

    exprs?: { name: string; expr: string; type: VirtualType }[];

    displayFields?: string[];

    header: (v: UnionRecordHelper) => string;

    insertDialogOpts?: {
      withValues?: Record<string, string>;
      /** Runs before the insert */
      serviceCheck?: (state: FormState) => ServiceProcStatement[];
      /** Like afterSubmitService, but runs as part of the same transaction as the insert */
      postInsert?: (state: FormState) => ServiceProcStatement[];
    };
  }[];
}

const rootStyles = { display: "flex", flexDirection: "column" };

export function relatedRecordsTimeline(opts: RelatedRecordsTimelineOpts) {
  const query = createRelatedUnionQuery({
    foreignKeyExpr: opts.foreignKeyId,
    foreignKeyTable: opts.foreignKeyTable,
    limit: `row_count`,
    orderBy: "date desc, event_type, id desc",
    orderByFields: ["date"],
    tables: opts.tables.map((t) => {
      const tableModel = model.database.tables[t.table];
      const fields: string[] = [];
      const exprs = t.exprs ?? [];
      for (const field of Object.values(tableModel.fields)) {
        if (field.type === "ForeignKey") {
          if (field.table === opts.foreignKeyTable) {
            continue;
          }
          const otherTable = model.database.tables[field.table];
          if (otherTable.recordDisplayName) {
            const nameExpr = otherTable.recordDisplayName.expr(
              ...otherTable.recordDisplayName.fields.map((f) => `record.${f}`)
            );
            exprs.push({
              name: `${field.name.name}_name`,
              expr: `(select ${nameExpr} from db.${otherTable.name.name} as record where record.id = ${tableModel.name.name}.${field.name.name})`,
              type: { type: "String" },
            });
          }
        }
        fields.push(field.name.name);
      }
      return {
        table: t.table,
        customFrom: t.customFrom,
        exprs,
        fields,
        orderByExprs: [t.dateExpr ?? opts.dateField],
      };
    }),
  });
  const tableIconStyles: any = {};
  const tableIconDynamicClasses: DynamicClass[] = [];
  for (let i = 0; i < opts.tables.length; i++) {
    tableIconStyles["&.table-" + i] = {
      backgroundColor: opts.tables[i].dotColor,
    };
    tableIconDynamicClasses.push({
      condition: `record.event_type = ${i}`,
      classes: "table-" + i,
    });
  }
  const basePopoverMenuId = stringLiteral(getUniqueUiId());
  const item = element("div", {
    styles: { display: "flex", minHeight: 80 },
    children: [
      element("div", {
        styles: {
          display: "flex",
          flexDirection: "column",
          mx: 1,
          mt: 1,
          color: cssVar(`palette-text-secondary`),
          alignItems: "center",
          fontSize: "sm",
          minWidth: 60,
        },
        children: [
          element("span", {
            children: `date.format(record.date, '%-d %b')`,
          }),
          element("span", {
            children: `date.format(record.date, '%Y')`,
          }),
        ],
      }),
      element("div", {
        styles: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        },
        children: [
          element("span", {
            styles: {
              display: "flex",
              alignSelf: "baseline",
              color: "white",
              borderRadius: "50%",
              my: 1,
              p: 1,
              "--icon-font-size": "1.5rem",
              ...tableIconStyles,
            },
            dynamicClasses: tableIconDynamicClasses,
            children: {
              t: "Switch",
              cases: opts.tables.map((t, i) => ({
                condition: `record.event_type = ${i}`,
                node: materialIcon(t.icon),
              })),
            },
          }),
          element("span", {
            styles: {
              width: 2,
              backgroundColor: cssVar(`palette-neutral-100`),
              flexGrow: 1,
            },
          }),
        ],
      }),
      state({
        procedure: [scalar(`editing`, `false`), scalar(`deleting`, `false`)],
        children: element("div", {
          styles: {
            ml: 2,
            flexGrow: 1,
            display: "flex",
            alignItems: "start",
          },
          children: [
            element("div", {
              styles: {
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
              },
              children: [
                typography({
                  level: "h6",
                  children:
                    "case " +
                    opts.tables
                      .map((t, i) => {
                        const recordHelper = query.getRecordHelper(
                          t.table,
                          "record"
                        );
                        return `when record.event_type = ${i} then ${t.header(
                          recordHelper
                        )}`;
                      })
                      .join(" ") +
                    " end",
                }),
                element("div", {
                  styles: {
                    display: "flex",
                    gap: 1,
                    flexWrap: "wrap",
                    mb: 2,
                  },
                  children: {
                    t: "Switch",
                    cases: opts.tables.map((t, i) => {
                      const condition = `record.event_type = ${i}`;
                      if (!t.displayFields) {
                        return { condition };
                      }
                      const tableModel = model.database.tables[t.table];
                      const recordHelper = query.getRecordHelper(
                        t.table,
                        "record"
                      );
                      return {
                        condition,
                        node: t.displayFields.map((f) => {
                          const field = tableModel.fields[f];
                          if (!field) {
                            throw new Error(
                              `Field ${f} does not exist in table ${tableModel.name.name}}`
                            );
                          }
                          if (field.type === "Bool") {
                            return ifNode(
                              recordHelper.field(f),
                              chip({
                                variant: "soft",
                                color: "neutral",
                                size: "sm",
                                children: stringLiteral(field.name.displayName),
                              })
                            );
                          }
                          let valueNode;
                          switch (field.type) {
                            case "String":
                              if (field.multiline) {
                                valueNode = element("p", {
                                  styles: {
                                    whiteSpace: "pre-wrap",
                                    my: 0,
                                  },
                                  children: recordHelper.field(f),
                                });
                              } else {
                                valueNode = element("span", {
                                  children: recordHelper.field(f),
                                });
                              }
                              break;
                            case "Duration":
                              if (field.size === "minutes") {
                                valueNode = element("span", {
                                  children: `sfn.display_minutes_duration(${recordHelper.field(
                                    f
                                  )})`,
                                });
                              }
                              break;
                            case "TinyInt":
                            case "SmallInt":
                            case "Int":
                            case "BigInt":
                            case "TinyUint":
                            case "SmallUint":
                            case "Uint":
                            case "BigUint":
                              valueNode = element("span", {
                                children: field.displayText
                                  ? field.displayText(recordHelper.field(f))
                                  : recordHelper.field(f),
                              });
                              break;
                            case "Enum":
                              valueNode = element("span", {
                                children: `dt.display_${
                                  field.enum
                                }(${recordHelper.field(f)})`,
                              });
                              break;
                          }
                          let content = element("div", {
                            styles: { display: "flex" },
                            children: [
                              element("p", {
                                styles: {
                                  mr: 0.5,
                                  color: "text-secondary",
                                  my: 0,
                                  fontSize: "sm",
                                  alignSelf: "flex-end",
                                },
                                children: `${stringLiteral(
                                  field.name.displayName
                                )} || ':'`,
                              }),
                              valueNode,
                            ],
                          });
                          if (field.notNull) {
                            return content;
                          }
                          return ifNode(
                            recordHelper.field(f) + ` is not null`,
                            content
                          );
                        }),
                      };
                    }),
                  },
                }),
              ],
            }),
            popoverMenu({
              menuListOpts: {
                styles: { width: 120 },
                floating: {
                  placement: `'bottom-end'`,
                },
              },
              id: `${basePopoverMenuId} || '-' || record.iteration_index`,
              button: ({ buttonProps, onButtonClick }) =>
                iconButton({
                  variant: "plain",
                  color: "neutral",
                  size: "sm",
                  children: materialIcon("MoreHoriz"),
                  props: buttonProps,
                  on: {
                    click: onButtonClick,
                  },
                }),
              items: [
                {
                  onClick: [setScalar(`ui.editing`, `true`)],
                  children: `'Edit'`,
                },
                {
                  onClick: [setScalar(`ui.deleting`, `true`)],
                  children: `'Delete'`,
                },
              ],
            }),
            ifNode(`editing`, {
              t: "Switch",
              cases: opts.tables.map((t, i) => {
                const recordHelper = query.getRecordHelper(t.table, "record");
                const tableModel = model.database.tables[t.table];
                const ignoreFields: string[] = [];
                const fieldOverrides: Record<
                  string,
                  AutoLabelOnLeftFieldOverride
                > = {};
                for (const field of Object.values(tableModel.fields)) {
                  if (
                    field.type === "ForeignKey" &&
                    field.table === opts.foreignKeyTable
                  ) {
                    ignoreFields.push(field.name.name);
                    continue;
                  }
                  const override: AutoLabelOnLeftFieldOverride = {
                    initialValue: recordHelper.field(field.name.name),
                  };
                  if (field.type === "ForeignKey") {
                    const otherTable = model.database.tables[field.table];
                    if (otherTable.recordDisplayName) {
                      // override.comboboxInitialInputText = recordHelper
                      //   .field(
                      //     `${field.name.name}_name`,
                      //   );
                    }
                  }
                  fieldOverrides[field.name.name] = override;
                }
                return {
                  condition: `record.event_type = ${i}`,
                  node: updateDialog({
                    table: t.table,
                    open: `ui.editing`,
                    onClose: [setScalar(`ui.editing`, `false`)],
                    recordId: `record.id`,
                    content: {
                      type: "AutoLabelOnLeft",
                      fieldOverrides,
                      ignoreFields,
                    },
                    afterSubmitService: () => [
                      setScalar(`ui.refresh_key`, `ui.refresh_key + 1`),
                    ],
                  }),
                };
              }),
            }),
            confirmDangerDialog({
              onConfirm: (closeModal) => [
                setScalar(`dialog_waiting`, `true`),
                commitUiChanges(),
                try_<ClientProcStatement>({
                  body: [
                    serviceProc([
                      startTransaction(),
                      ...opts.tables.map((t, i) =>
                        if_(
                          `record.event_type = ${i}`,
                          modify(
                            `delete from db.${t.table} where id = record.id`
                          )
                        )
                      ),
                      commitTransaction(),
                      setScalar(`ui.refresh_key`, `ui.refresh_key + 1`),
                    ]),
                  ],
                  catch: [
                    setScalar(`dialog_waiting`, `false`),
                    setScalar(
                      `dialog_error`,
                      `'Unable to delete, try again another time.'`
                    ),
                    exit(),
                  ],
                }),
                ...closeModal,
              ],
              open: `ui.deleting`,
              onClose: [setScalar(`ui.deleting`, `false`)],
              description:
                "'Are you sure you want to delete this ' || case " +
                opts.tables
                  .map((t, i) => {
                    const table = model.database.tables[t.table];
                    return `when record.event_type = ${i} then ${stringLiteral(
                      table.name.displayName.toLowerCase()
                    )}`;
                  })
                  .join(" ") +
                " end || '?'",
            }),
          ],
        }),
      }),
    ],
  });
  return state({
    procedure: [scalar(`refresh_key`, `0`), scalar(`row_count`, `50`)],
    children: state({
      watch: [`refresh_key`, `row_count`],
      procedure: [
        table(`result`, query.query),
        scalar(`service_row_count`, `row_count`),
        ...(opts.additionalState ?? []),
      ],
      statusScalar: `status`,
      children: element("div", {
        styles: opts.styles ? [rootStyles, opts.styles] : rootStyles,
        children: [
          eventHandlers({
            document: {
              scroll: [
                if_(
                  `status != 'received' or (service_row_count is not null and (select count(*) from result) < service_row_count)`,
                  [exit()]
                ),
                getWindowProperty("scrollY", "scroll_y"),
                getWindowProperty("innerHeight", "height"),
                getElProperty(
                  "scrollHeight",
                  "doc_scroll_height",
                  "'yolm-document-body'"
                ),
                if_(`doc_scroll_height - scroll_y - height < 500`, [
                  setScalar(`row_count`, `row_count + 50`),
                ]),
              ],
            },
          }),
          divider(),
          element("div", {
            styles: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              pt: 2,
              px: 1,
            },
            children: [
              typography({ level: "h5", children: opts.timelineHeader }),
              state({
                procedure: opts.tables.map((t, i) =>
                  scalar(`adding_${i}`, `false`)
                ),
                children: [
                  element("div", {
                    styles: { position: "relative" },
                    children: popoverMenu({
                      menuListOpts: {
                        styles: { width: 240 },
                        floating: {
                          strategy: "'fixed'",
                          placement: `'bottom-end'`,
                          flip: { mainAxis: "true", crossAxis: "true" },
                          shift: { mainAxis: "false", crossAxis: "false" },
                        },
                      },
                      id: `'add-related-record'`,
                      button: ({ buttonProps, onButtonClick }) =>
                        button({
                          variant: "soft",
                          color: "info",
                          children: `'Add...'`,
                          startDecorator: materialIcon("Add"),
                          props: buttonProps,
                          on: {
                            click: onButtonClick,
                          },
                        }),
                      items: opts.tables.map((t, i) => ({
                        children:
                          `'Add ' || ` +
                          stringLiteral(
                            model.database.tables[t.table].name.displayName
                          ),
                        onClick: [setScalar(`ui.adding_${i}`, `true`)],
                      })),
                    }),
                  }),
                  opts.tables.map((t, i) => {
                    const tableModel = model.database.tables[t.table];
                    const withValues: Record<string, string> =
                      t.insertDialogOpts?.withValues ?? {};
                    let foreignKeyField = Object.values(tableModel.fields).find(
                      (f) =>
                        f.type === "ForeignKey" &&
                        f.table === opts.foreignKeyTable
                    );
                    const overrides: Record<
                      string,
                      AutoLabelOnLeftFieldOverride
                    > = {
                      date: {
                        initialValue: `current_date()`,
                      },
                    };
                    if (foreignKeyField) {
                      overrides[foreignKeyField.name.name] = {
                        initialValue: opts.foreignKeyId,
                      };
                      withValues[foreignKeyField.name.name] = opts.foreignKeyId;
                    }
                    const ignoreFields = Object.values(withValues);
                    return insertDialog({
                      open: `ui.adding_${i}`,
                      onClose: [setScalar(`ui.adding_${i}`, `false`)],
                      table: t.table,
                      content: {
                        type: "AutoLabelOnLeft",
                        fieldOverrides: overrides,
                        ignoreFields,
                      },
                      withValues,
                      serviceCheck: t.insertDialogOpts?.serviceCheck,
                      postInsert: t.insertDialogOpts?.postInsert,
                      afterSubmitService: () => [
                        setScalar(`ui.refresh_key`, `ui.refresh_key + 1`),
                      ],
                    });
                  }),
                ],
              }),
            ],
          }),
          opts.afterHeaderNode ? opts.afterHeaderNode : undefined,
          each({
            table: `result`,
            recordName: `record`,
            key: `record.id || '_' || record.event_type`,
            children: item,
          }),
        ],
      }),
    }),
  });
}
