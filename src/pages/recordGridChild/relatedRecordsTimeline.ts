import { VirtualType } from "../../modelTypes.js";
import {
  each,
  element,
  eventHandlers,
  ifNode,
  sourceMap,
  state,
} from "../../nodeHelpers.js";
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
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import {
  AllSystemCSSProperties,
  Style,
  StyleObject,
} from "../../styleTypes.js";
import { createStyles, cssVar } from "../../styleUtils.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import {
  createRelatedUnionQuery,
  UnionRecordHelper,
} from "../../utils/union.js";
import { chip } from "../../components/chip.js";
import { iconButton } from "../../components/iconButton.js";
import { materialIcon } from "../../components/materialIcon.js";
import { IconName } from "../../components/materialIconNames.js";
import { popoverMenu } from "../../components/menu.js";
import { typography } from "../../components/typography.js";
import { confirmDangerDialog } from "../../components/confirmDangerDialog.js";
import { updateDialog } from "../../components/updateDialog.js";
import { button } from "../../components/button.js";
import { insertDialog } from "../../components/insertDialog.js";
import { divider } from "../../components/divider.js";
import {
  ClientProcStatement,
  DynamicClass,
  ServiceProcStatement,
  StateStatement,
} from "../../yom.js";
import { Node } from "../../nodeTypes.js";
import { FormState } from "../../formState.js";
import { getUniqueUiId } from "../../components/utils.js";
import { AutoLabelOnLeftFieldOverride } from "../../components/internal/updateFormShared.js";
import { RecordGridContext } from "./shared.js";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay.js";

export const name = "relatedRecordsTimeline";

export interface Opts {
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

const styles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gridColumnSpan: "full",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    pt: 2,
    px: 1,
  },
  addButtonWrapper: {
    position: "relative",
  },
  addPopover: {
    width: 240,
  },
  editPopover: {
    width: 120,
  },
  item: {
    display: "flex",
    minHeight: 80,
  },
  date: {
    display: "flex",
    flexDirection: "column",
    mx: 1,
    mt: 1,
    color: cssVar(`palette-text-secondary`),
    alignItems: "center",
    fontSize: "sm",
    minWidth: 60,
  },
  iconWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  line: {
    width: 2,
    backgroundColor: cssVar(`palette-neutral-100`),
    flexGrow: 1,
  },
  itemContent: {
    ml: 2,
    flexGrow: 1,
    display: "flex",
    alignItems: "start",
  },
  itemLeft: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },
  itemValues: {
    display: "flex",
    gap: 1,
    flexWrap: "wrap",
    mb: 2,
  },
  itemValueWrapper: {
    display: "flex",
  },
  itemValue: {
    mr: 0.5,
    color: "text-secondary",
    my: 0,
    fontSize: "sm",
    alignSelf: "flex-end",
  },
  multilineValue: {
    whiteSpace: "pre-wrap",
    my: 0,
  },
});

const addButtonId = stringLiteral(getUniqueUiId());

export function content(opts: Opts, ctx: RecordGridContext) {
  const query = createRelatedUnionQuery({
    foreignKeyExpr: ctx.recordId,
    foreignKeyTable: ctx.table.name,
    limit: `row_count`,
    orderBy: "date desc, event_type, id desc",
    orderByFields: ["date"],
    tables: opts.tables.map((t) => {
      const tableModel = model.database.tables[t.table];
      const fields: string[] = [];
      const exprs = t.exprs ?? [];
      for (const field of Object.values(tableModel.fields)) {
        if (field.type === "ForeignKey") {
          if (field.table === ctx.table.name) {
            continue;
          }
          const otherTable = model.database.tables[field.table];
          if (otherTable.recordDisplayName) {
            const nameExpr = otherTable.recordDisplayName.expr(
              ...otherTable.recordDisplayName.fields.map((f) => `record.${f}`)
            );
            exprs.push({
              name: `${field.name}_name`,
              expr: `(select ${nameExpr} from db.${otherTable.name} as record where record.id = ${tableModel.name}.${field.name})`,
              type: { type: "String" },
            });
          }
        }
        fields.push(field.name);
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
    styles: styles.item,
    children: [
      element("div", {
        styles: styles.date,
        children: [
          element("span", {
            children: `format.date(record.date, '%-d %b')`,
          }),
          element("span", {
            children: `format.date(record.date, '%Y')`,
          }),
        ],
      }),
      element("div", {
        styles: styles.iconWrapper,
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
          ifNode(
            `record.iteration_index != (select count(*) from result) - 1`,
            element("span", {
              styles: styles.line,
            })
          ),
        ],
      }),
      state({
        procedure: [scalar(`editing`, `false`), scalar(`deleting`, `false`)],
        children: element("div", {
          styles: styles.itemContent,
          children: [
            element("div", {
              styles: styles.itemLeft,
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
                  styles: styles.itemValues,
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
                              `Field ${f} does not exist in table ${tableModel.name}}`
                            );
                          }
                          if (field.type === "Bool") {
                            return ifNode(
                              recordHelper.field(f),
                              chip({
                                variant: "soft",
                                color: "neutral",
                                size: "sm",
                                children: stringLiteral(field.displayName),
                              })
                            );
                          }

                          let content = element("div", {
                            styles: styles.itemValueWrapper,
                            children: [
                              element("p", {
                                styles: styles.itemValue,
                                children: `${stringLiteral(
                                  field.displayName
                                )} || ':'`,
                              }),
                              inlineFieldDisplay(field, recordHelper.field(f)),
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
                styles: styles.editPopover,
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
                    field.table === ctx.table.name
                  ) {
                    ignoreFields.push(field.name);
                    continue;
                  }
                  const override: AutoLabelOnLeftFieldOverride = {
                    initialValue: recordHelper.field(field.name),
                  };
                  fieldOverrides[field.name] = override;
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
                    afterSubmitService: () => [ctx.triggerRefresh],
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
                      ctx.triggerRefresh,
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
                      table.displayName.toLowerCase()
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
  return sourceMap(
    `relatedRecordsTimeline`,
    state({
      procedure: [scalar(`row_count`, `50`)],
      children: state({
        watch: [ctx.refreshKey, `row_count`],
        procedure: [
          table(`result`, query.query),
          scalar(`service_row_count`, `row_count`),
          ...(opts.additionalState ?? []),
        ],
        statusScalar: `status`,
        children: element("div", {
          styles: opts.styles ? [styles.root, opts.styles] : styles.root,
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
              styles: styles.header,
              children: [
                typography({ level: "h5", children: opts.timelineHeader }),
                state({
                  procedure: opts.tables.map((t, i) =>
                    scalar(`adding_${i}`, `false`)
                  ),
                  children: [
                    element("div", {
                      styles: styles.addButtonWrapper,
                      children: popoverMenu({
                        menuListOpts: {
                          styles: styles.addPopover,
                          floating: {
                            strategy: "'fixed'",
                            placement: `'bottom-end'`,
                            flip: { mainAxis: "true", crossAxis: "true" },
                            shift: { mainAxis: "false", crossAxis: "false" },
                          },
                        },
                        id: addButtonId,
                        button: ({ buttonProps, onButtonClick }) =>
                          button({
                            variant: "soft",
                            size: "sm",
                            color: "primary",
                            children: `'Add'`,
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
                              model.database.tables[t.table].displayName
                            ),
                          onClick: [setScalar(`ui.adding_${i}`, `true`)],
                        })),
                      }),
                    }),
                    opts.tables.map((t, i) => {
                      const tableModel = model.database.tables[t.table];
                      const withValues: Record<string, string> =
                        t.insertDialogOpts?.withValues ?? {};
                      let foreignKeyField = Object.values(
                        tableModel.fields
                      ).find(
                        (f) =>
                          f.type === "ForeignKey" && f.table === ctx.table.name
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
                        overrides[foreignKeyField.name] = {
                          initialValue: ctx.recordId,
                        };
                        withValues[foreignKeyField.name] = ctx.recordId;
                      }
                      const ignoreFields = Object.keys(withValues);
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
                        afterSubmitService: () => [ctx.triggerRefresh],
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
    })
  );
}
