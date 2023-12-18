import { chip } from "../../components/chip";
import { confirmDangerDialog } from "../../components/confirmDangerDialog";
import { iconButton } from "../../components/iconButton";
import { inlineFieldDisplay } from "../../components/internal/fieldInlineDisplay";
import { materialIcon } from "../../components/materialIcon";
import { popoverMenu } from "../../components/menu";
import { typography } from "../../components/typography";
import { updateDialog } from "../../components/updateDialog";
import { getUniqueUiId } from "../../components/utils";
import { Table } from "../../hub";
import { nodes } from "../../nodeHelpers";
import { createStyles } from "../../styleUtils";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import { RecordGridBuilder } from "../recordGrid";
import * as yom from "../../yom";
import { Node } from "../../nodeTypes";

export const styles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gridColumnSpan: "full",
  },
  items: {
    display: "flex",
    flexDirection: "column",
    mt: 2,
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
    color: "text-secondary",
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
    backgroundColor: "neutral-100",
    flexGrow: 1,
    dark: {
      backgroundColor: "neutral-700",
    },
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
  icon: {
    display: "flex",
    alignSelf: "baseline",
    color: "white",
    borderRadius: "50%",
    my: 1,
    p: 1,
    "--icon-font-size": "1.5rem",
  },
});

type GenericDisplayValue =
  | { type: "field"; field: string; exprValue: yom.SqlExpression }
  | {
      type: "expr";
      exprValue: yom.SqlExpression;
      display: (expr: yom.SqlExpression) => Node;
      label: string;
    };

interface RecordDefaultTableItemContentOpts {
  tableModel: Table;
  displayValues?: GenericDisplayValue[];
  header: Node;
  disableDefaultAction?: boolean;
  customAction?: Node;
}

const basePopoverMenuId = stringLiteral(getUniqueUiId());

export function recordDefaultItemContent(
  ctx: RecordGridBuilder,
  opts: RecordDefaultTableItemContentOpts,
) {
  const {
    tableModel,
    displayValues,
    customAction,
    disableDefaultAction,
    header,
  } = opts;
  const editIgnoreFields: string[] = [];
  for (const field of Object.values(tableModel.fields)) {
    if (field.type === "ForeignKey" && field.table === ctx.table.name) {
      editIgnoreFields.push(field.name);
      continue;
    }
  }
  let action: Node | undefined;
  if (customAction) {
    action = customAction;
  } else if (!disableDefaultAction) {
    action = nodes.state({
      procedure: (s) =>
        s.scalar(`editing`, `false`).scalar(`deleting`, `false`),
      children: [
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
              onClick: (s) => s.setScalar(`ui.deleting`, `true`),
              children: `'Delete'`,
            },
          ],
        }),
        nodes.if(
          `editing`,
          updateDialog({
            table: tableModel.name,
            open: `ui.editing`,
            onClose: (s) => s.setScalar(`ui.editing`, `false`),
            recordId: `record.id`,
            content: {
              type: "AutoLabelOnLeft",
              ignoreFields: editIgnoreFields,
            },
            afterTransactionCommit: () => [ctx.triggerRefresh],
          }),
        ),
        confirmDangerDialog({
          onConfirm: (closeModal) => (s) =>
            s
              .setScalar(`dialog_waiting`, `true`)
              .commitUiTreeChanges()
              .try({
                body: (s) =>
                  s.serviceProc((s) =>
                    s
                      .startTransaction()
                      .modify(
                        `delete from db.${ident(
                          tableModel.name,
                        )} where id = record.id`,
                      )
                      .commitTransaction()
                      .statements(ctx.triggerRefresh),
                  ),
                catch: (s) =>
                  s
                    .setScalar(`dialog_waiting`, `false`)
                    .setScalar(
                      `dialog_error`,
                      `'Unable to delete, try again another time.'`,
                    )
                    .return(),
              })
              .statements(closeModal),
          open: `ui.deleting`,
          onClose: (s) => s.setScalar(`ui.deleting`, `false`),
          description: `'Are you sure you want to delete this ' || ${stringLiteral(
            tableModel.displayName.toLowerCase(),
          )} || '?'`,
        }),
      ],
    });
  }
  return nodes.element("div", {
    styles: styles.itemContent,
    children: [
      nodes.element("div", {
        styles: styles.itemLeft,
        children: [
          typography({
            level: "body-lg",
            children: header,
          }),
          displayValues
            ? nodes.element("div", {
                styles: styles.itemValues,
                children: displayValues.map((value) => {
                  if (value.type === "field") {
                    const field = tableModel.fields[value.field];
                    if (!field) {
                      throw new Error(
                        `Field ${value} does not exist in table ${tableModel.name}}`,
                      );
                    }
                    if (field.type === "Bool") {
                      return nodes.if(
                        value.exprValue,
                        chip({
                          variant: "soft",
                          color: "neutral",
                          size: "sm",
                          children: stringLiteral(field.displayName),
                        }),
                      );
                    }
                    const content = nodes.element("div", {
                      styles: styles.itemValueWrapper,
                      children: [
                        nodes.element("p", {
                          styles: styles.itemValue,
                          children: `${stringLiteral(
                            field.displayName,
                          )} || ':'`,
                        }),
                        inlineFieldDisplay(field, value.exprValue),
                      ],
                    });
                    if (field.notNull) {
                      return content;
                    }
                    return nodes.if(value.exprValue + ` is not null`, content);
                  } else {
                    return nodes.element("div", {
                      styles: styles.itemValueWrapper,
                      children: [
                        nodes.element("p", {
                          styles: styles.itemValue,
                          children: `${stringLiteral(value.label)} || ':'`,
                        }),
                        value.display(value.exprValue),
                      ],
                    });
                  }
                }),
              })
            : undefined,
        ],
      }),
      action,
    ],
  });
}
