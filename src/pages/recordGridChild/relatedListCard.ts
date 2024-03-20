import { nodes } from "../../nodeHelpers";
import { system } from "../../system";
import { createStyles } from "../../styleUtils";
import { stringLiteral } from "../../utils/sqlHelpers";
import { divider } from "../../components/divider";
import { typography } from "../../components/typography";
import { card, cardOverflow } from "../../components/card";
import { Style } from "../../styleTypes";
import { Node } from "../../nodeTypes";
import { pluralize } from "../../utils/inflectors";
import { getUniqueUiId } from "../../components/utils";
import { RecordGridBuilder } from "../recordGrid";
import {
  EmbeddedInsertDialog,
  EmbeddedUpdateDialog,
  resolveEmbeddedInsertDialog,
  resolveEmbeddedUpdateDialog,
} from "../../components/forms/dialogs";
import { deleteRecordDialog, iconButton, materialIcon } from "../../components";
import { popoverMenu } from "../../components/menu";

export interface Opts {
  table: string;
  fkField?: string;
  styles?: Style;
  headerStartDecorator?: Node;
  header?: string;
  selectFields: string;
  display: (record: string) => Node;
  insertDialog?: EmbeddedInsertDialog;
  updateDialog?: EmbeddedUpdateDialog;
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
  editPopover: {
    width: 120,
  },
});

export function content(opts: Opts, ctx: RecordGridBuilder) {
  const otherTable = system.db.tables[opts.table];
  const listScrollId = stringLiteral(getUniqueUiId());
  const itemBaseId = stringLiteral(getUniqueUiId());
  if (!otherTable) {
    throw new Error(`Table ${opts.table} not found`);
  }
  const foreignKeyField = Object.values(otherTable.fields).find(
    (f) => f.type === "ForeignKey" && f.table === ctx.table.name,
  );
  if (!foreignKeyField) {
    throw new Error(
      `No foreign key field found for ${ctx.table.name} to ${opts.table}`,
    );
  }
  return nodes.state({
    procedure: (s) => s.scalar(`row_count`, `20`).scalar(`adding`, `false`),
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
              children: materialIcon("Add"),
              on: {
                click: (s) => s.setScalar(`ui.adding`, `not ui.adding`),
              },
            }),
            resolveEmbeddedInsertDialog(
              {
                open: `ui.adding`,
                onClose: (s) => s.setScalar(`ui.adding`, `false`),
                table: otherTable.name,
                withValues: { [foreignKeyField.name]: ctx.recordId },
                afterTransactionCommit: (_, s) => {
                  s.statements(ctx.triggerRefresh);
                },
              },
              opts.insertDialog,
            ),
          ],
        }),
        divider(),
        cardOverflow({
          children: nodes.state({
            watch: [ctx.refreshKey, `row_count`],
            procedure: (s) =>
              s
                .record(
                  "related",
                  `select ${otherTable.primaryKeyIdent}, ${opts.selectFields} from db.${otherTable.identName} where ${foreignKeyField.identName} = ${ctx.recordId} order by ${otherTable.primaryKeyIdent} desc limit row_count`,
                )
                .scalar(`service_row_count`, `row_count`),
            children: nodes.element("ul", {
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
                    opts.display(`related_record`),
                    nodes.state({
                      procedure: (s) =>
                        s
                          .scalar(`editing`, `false`)
                          .scalar(`deleting`, `false`),
                      children: [
                        popoverMenu({
                          menuListOpts: {
                            styles: styles.editPopover,
                            floating: {
                              placement: `'bottom-end'`,
                            },
                          },
                          id: `${itemBaseId} || '-' || related_record.iteration_index`,
                          button: ({ buttonProps, onButtonClick }) =>
                            iconButton({
                              variant: "plain",
                              color: "neutral",
                              size: "sm",
                              children: materialIcon("MoreHoriz"),
                              ariaLabel: `'Open Actions Menu'`,
                              props: buttonProps,
                              on: {
                                click: onButtonClick,
                              },
                            }),
                          items: [
                            {
                              onClick: (s) => s.setScalar(`ui.editing`, `true`),
                              children: `'Edit'`,
                            },
                            {
                              onClick: (s) =>
                                s.setScalar(`ui.deleting`, `true`),
                              children: `'Delete'`,
                            },
                          ],
                        }),
                        nodes.if(
                          `editing`,
                          resolveEmbeddedUpdateDialog(
                            {
                              table: otherTable.name,
                              open: `ui.editing`,
                              onClose: (s) =>
                                s.setScalar(`ui.editing`, `false`),
                              recordId: `related_record.${otherTable.primaryKeyIdent}`,
                              ignoreFields: [foreignKeyField.name],
                              afterTransactionCommit: (_, s) =>
                                s.statements(ctx.triggerRefresh),
                            },
                            opts.updateDialog,
                          ),
                        ),
                        deleteRecordDialog({
                          open: `ui.deleting`,
                          onClose: (s) => s.setScalar(`ui.deleting`, `false`),
                          recordId: `related_record.${otherTable.primaryKeyIdent}`,
                          table: otherTable.name,
                          afterTransactionCommit: ctx.triggerRefresh,
                        }),
                      ],
                    }),
                  ],
                }),
              }),
            }),
          }),
        }),
        ,
      ],
    }),
  });
}
