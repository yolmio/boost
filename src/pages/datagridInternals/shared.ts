import { nodes } from "../../nodeHelpers";
import {
  BasicStatements,
  DomStatements,
  StateStatements,
} from "../../statements";
import { createStyles } from "../../styleUtils";
import { ColumnEventHandlers, RowHeight } from "./types";

export function rowHeightInPixels(height: RowHeight) {
  switch (height) {
    case "short":
      return 44;
    case "medium":
      return 56;
    case "tall":
      return 88;
    case "extraTall":
      return 128;
  }
}

export function editFocusState() {
  return new StateStatements()
    .record(
      "focus_state",
      "select 0 as column, 0 as row, false as should_focus"
    )
    .record(
      "editing_state",
      "select 0 as column, 0 as row, false as is_editing"
    )
    .scalar(`start_edit_with_char`, { type: "String", maxLength: 1 })
    .scalar("saving_edit", "false")
    .scalar(`display_error_message`, { type: "String", maxLength: 2000 })
    .scalar(`remove_error_task`, { type: "BigInt" });
}

export function colKeydownHandlers(columns: ColumnEventHandlers[]) {
  const statements = new DomStatements();
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.keydownHeaderHandler) {
      statements.if(
        `cell.row = 0 and cell.column = ${i}`,
        column.keydownHeaderHandler
      );
    }
    if (column.keydownCellHandler) {
      statements.if(
        `cell.row != 0 and cell.column = ${i}`,
        column.keydownCellHandler
      );
    }
  }
  return statements;
}

export function colClickHandlers(columns: ColumnEventHandlers[]) {
  const headerStatements = new DomStatements();
  const cellStatements = new DomStatements();
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.headerClickHandler) {
      headerStatements.if(`cell.column = ${i}`, column.headerClickHandler);
    }
    if (column.cellClickHandler) {
      cellStatements.if(`cell.column = ${i}`, column.cellClickHandler);
    }
  }
  if (headerStatements.statementsIsEmpty && cellStatements.statementsIsEmpty) {
    return new DomStatements();
  }
  return new DomStatements().if({
    condition: `cell.row = 0`,
    then: headerStatements,
    else: cellStatements,
  });
}

export function refreshKeyState() {
  return new BasicStatements().scalar("dg_refresh_key", { type: "Int" }, "0");
}

export function triggerQueryRefresh() {
  return new BasicStatements().setScalar(
    `ui.dg_refresh_key`,
    `ui.dg_refresh_key + 1`
  );
}

export interface ResizeableSeperatorOpts {
  minWidth?: number;
  width: string;
  setWidth: (width: string) => BasicStatements;
}

const styles = createStyles({
  seperatorWrapper: {
    position: "absolute",
    right: -8,
    cursor: "col-resize",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    width: 16,
    zIndex: 1000,
    "& > div": {
      visibility: "hidden",
    },
    "&:hover > div": {
      visibility: "visible",
    },
  },
  seperator: {
    display: "flex",
    alignItems: "center",
    cursor: "col-resize",
    fontSize: "2xl",
    color: "text-secondary",
    zIndex: 1000,
    userSelect: "none",
    height: 36,
    width: 4,
    backgroundColor: "primary-500",
    "&.active": {
      "& > div": {
        visibility: "visible",
      },
    },
  },
});

export function resizeableSeperator({
  minWidth,
  setWidth,
  width,
}: ResizeableSeperatorOpts) {
  let newValue = "start_width + (event.client_x - start_x)";
  if (typeof minWidth === "number") {
    newValue = `case when ${newValue} < ${minWidth} then ${minWidth} else ${newValue} end`;
  }
  return nodes.state({
    procedure: (s) =>
      s
        .scalar("start_width", { type: "BigInt" })
        .scalar(`start_x`, { type: "BigInt" })
        .scalar(`pending_width`, { type: "BigInt" })
        .scalar(`waiting`, `false`),
    children: nodes.element("div", {
      styles: styles.seperatorWrapper,
      dynamicClasses: [
        {
          classes: "active",
          condition: "start_width is not null",
        },
      ],
      on: {
        mouseDown: (s) =>
          s
            .setScalar("start_width", width)
            .setScalar(`start_x`, `event.client_x`),
        click: (s) => s.stopPropagation(),
      },
      children: [
        nodes.element("div", {
          styles: styles.seperator,
        }),
        nodes.if(
          `start_width is not null`,
          nodes.eventHandlers({
            document: {
              mouseMove: (s) =>
                s.setScalar(`pending_width`, newValue).if(`not waiting`, (s) =>
                  s.spawn({
                    detached: true,
                    procedure: (s) =>
                      s
                        .setScalar(`waiting`, `true`)
                        .delay(`16`)
                        .statements(setWidth(`pending_width`))
                        .setScalar(`waiting`, `false`)
                        .commitUiChanges(),
                  })
                ),
              mouseUp: (s) => s.setScalar(`start_width`, `null`),
            },
          })
        ),
      ],
    }),
  });
}
