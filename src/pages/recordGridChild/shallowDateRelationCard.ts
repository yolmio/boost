import { nodes } from "../../nodeHelpers";
import { system } from "../../system";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { divider } from "../../components/divider";
import { typography } from "../../components/typography";
import { card, cardOverflow } from "../../components/card";
import { Style } from "../../styleTypes";
import { Node } from "../../nodeTypes";
import { pluralize } from "../../utils/inflectors";
import { SqlExpression } from "../../yom";
import { getUniqueUiId } from "../../components/utils";
import { RecordGridBuilder } from "../recordGrid";
import {
  deleteRecordDialog,
  iconButton,
  input,
  materialIcon,
  alert,
  button,
} from "../../components";
import { normalizeCase } from "../../utils/inflectors";

export type Stat =
  | SqlExpression
  | {
      value: SqlExpression;
      showIfEmpty?: boolean;
      display?: (e: SqlExpression) => Node;
    };

export interface Opts {
  table: string;
  fkField?: string;
  styles?: Style;
  headerStartDecorator?: Node;
  header?: string;
  stats?: Stat[];
  dateField?: string;
  initialDateValue?: SqlExpression;
}

const styles = createStyles({
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    pb: 1.5,
  },
  list: {
    listStyle: "none",
    px: 0,
    py: 1,
    my: 0,
    overflowY: "auto",
    maxHeight: "300px",
  },
  listItem: {
    p: 0,
    display: "flex",
    alignItems: "center",
    gap: 2,
    "&:not(:last-child)": {
      borderBottom: "1px solid",
      borderBottomColor: "divider",
      mb: 1,
      pb: 1,
    },
    px: 2,
  },
  addingForm: {
    mt: 1,
  },
  addingButtons: {
    my: 1,
    display: "flex",
    justifyContent: "flex-end",
  },
  addingError: {
    mt: 1,
  },
  stat: {
    "&:first-of-type": {
      mt: 1.5,
    },
    mb: 0.5,
    mt: 0.5,
    mx: 2,
    fontSize: "md",
    color: "text-secondary",
  },
});

export function content(opts: Opts, ctx: RecordGridBuilder) {
  const otherTable = system.db.tables[opts.table];
  const listScrollId = stringLiteral(getUniqueUiId());
  if (!otherTable) {
    throw new Error(`Table ${opts.table} not found`);
  }
  const foreignKeyField = opts.fkField
    ? otherTable.fields[opts.fkField]
    : Object.values(otherTable.fields).find(
        (f) => f.type === "ForeignKey" && f.table === ctx.table.name,
      );
  if (!foreignKeyField) {
    throw new Error(
      `No foreign key field found for ${ctx.table.name} to ${opts.table}`,
    );
  }
  const dateField = opts.dateField
    ? otherTable.fields[opts.dateField]
    : Object.values(otherTable.fields).find(
        (f) => f.type === "Date" || f.type === "Timestamp",
      );
  if (!dateField) {
    throw new Error(`No date field found for ${ctx.table.name}`);
  }
  const stats = opts.stats ?? [];
  return nodes.state({
    procedure: (s) => s.scalar(`adding`, `false`).scalar(`row_count`, `20`),
    children: card({
      variant: "outlined",
      styles: opts.styles,
      children: [
        nodes.element("div", {
          styles: styles.header,
          children: [
            typography({
              level: "body-lg",
              startDecorator: opts.headerStartDecorator,
              children:
                opts.header ?? stringLiteral(pluralize(otherTable.displayName)),
            }),
            iconButton({
              variant: "plain",
              color: "primary",
              size: "sm",
              ariaLabel: `'Add'`,
              children: nodes.if({
                condition: `adding`,
                then: materialIcon("Close"),
                else: materialIcon("Add"),
              }),
              on: {
                click: (s) => s.setScalar(`ui.adding`, `not ui.adding`),
              },
            }),
          ],
        }),
        divider(),
        nodes.if(
          `adding`,
          nodes.state({
            procedure: (s) =>
              s
                .scalar(`date`, opts.initialDateValue ?? `current_date()`)
                .scalar(`in_progress`, `false`)
                .scalar(`failed`, `false`),
            children: nodes.element("div", {
              styles: styles.addingForm,
              children: [
                input({
                  slots: {
                    input: {
                      props: {
                        value: `date`,
                        yolmFocusKey: `true`,
                        type: "'date'",
                      },
                      on: {
                        input: (s) =>
                          s.setScalar(`date`, "try_cast(target_value as date)"),
                      },
                    },
                  },
                }),
                nodes.if(
                  `failed`,
                  alert({
                    styles: styles.addingError,
                    color: "danger",
                    children: `'Unable to add note at this time'`,
                  }),
                ),
                nodes.element("div", {
                  styles: styles.addingButtons,
                  children: [
                    button({
                      children: `'Add ' || ${stringLiteral(normalizeCase(otherTable.displayName).join(" "))}`,
                      loading: `in_progress`,
                      on: {
                        click: (s) =>
                          s
                            .if(`in_progress`, (s) => s.return())
                            .setScalar(`in_progress`, `true`)
                            .setScalar(`failed`, `false`)
                            .commitUiTreeChanges()
                            .try({
                              body: (s) =>
                                s
                                  .serviceProc((s) =>
                                    s
                                      .startTransaction()
                                      .modify(
                                        `insert into db.${otherTable.identName} (${dateField.identName}, ${foreignKeyField.identName}) values (ui.date, ${ctx.recordId})`,
                                      )
                                      .commitTransaction()
                                      .statements(ctx.triggerRefresh),
                                  )
                                  .setScalar(`ui.adding`, `false`),
                              catch: (s) =>
                                s
                                  .setScalar(`ui.in_progress`, `false`)
                                  .setScalar(`ui.failed`, `true`),
                            }),
                      },
                    }),
                  ],
                }),
              ],
            }),
          }),
        ),
        cardOverflow({
          children: nodes.state({
            watch: [ctx.refreshKey, `row_count`],
            procedure: (s) => {
              s.record(
                "related",
                `select ${otherTable.primaryKeyIdent} as id, ${dateField.identName} as date from db.${otherTable.identName} where ${foreignKeyField.name} = ${ctx.recordId} order by date desc limit row_count`,
              ).scalar(`service_row_count`, `row_count`);
              for (let i = 0; i < stats.length; i++) {
                const state = stats[i];
                s.scalar(
                  `stat_${i}`,
                  typeof state === "string" ? state : state.value,
                );
              }
            },
            children: [
              stats.map((state, i) => {
                const node = nodes.element("p", {
                  styles: styles.stat,
                  children:
                    typeof state !== "string" && state.display
                      ? state.display(`stat_${i}`)
                      : `stat_${i}`,
                });
                if (typeof state !== "string" && state.showIfEmpty) {
                  return node;
                }
                return nodes.if(`stat_${i} is not null`, node);
              }),
              nodes.element("ul", {
                styles: styles.list,
                props: { id: listScrollId },
                on: {
                  scroll: (s) =>
                    s
                      .if(
                        `status != 'received' or (service_row_count is not null and (select count(*) from related) < service_row_count)`,
                        (s) => s.return(),
                      )
                      .getElProperty(
                        "scrollHeight",
                        "el_scroll_height",
                        listScrollId,
                      )
                      .getBoundingClientRect(listScrollId, "el_rect")
                      .getElProperty("scrollTop", "el_scroll_top", listScrollId)
                      .if(
                        `el_scroll_height - el_scroll_top - el_rect.height < 300`,
                        (s) => s.setScalar(`row_count`, `row_count + 20`),
                      ),
                },
                children: nodes.each({
                  table: "related",
                  recordName: "related_record",
                  key: "related_record.id",
                  children: nodes.element("li", {
                    styles: styles.listItem,
                    children: [
                      `format.date(related_record.date, '%-d %b %Y')`,
                      nodes.element("div", {
                        styles: flexGrowStyles,
                      }),
                      nodes.state({
                        procedure: (s) => s.scalar(`deleting`, `false`),
                        children: [
                          iconButton({
                            variant: "plain",
                            color: "neutral",
                            size: "sm",
                            children: materialIcon("DeleteOutlined"),
                            ariaLabel: "'Delete'",
                            on: {
                              click: (s) => s.setScalar(`deleting`, `true`),
                            },
                          }),
                          deleteRecordDialog({
                            open: `deleting`,
                            onClose: (s) => s.setScalar(`deleting`, `false`),
                            recordId: `related_record.id`,
                            table: otherTable.name,
                            afterTransactionCommit: ctx.triggerRefresh,
                          }),
                        ],
                      }),
                    ],
                  }),
                }),
              }),
            ],
          }),
        }),
        ,
      ],
    }),
  });
}
