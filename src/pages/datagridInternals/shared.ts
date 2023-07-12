import { element, eventHandlers, ifNode, state } from "../../nodeHelpers.js";
import {
  commitUiChanges,
  delay,
  if_,
  record,
  scalar,
  setScalar,
  spawn,
  stopPropagation,
} from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";
import {
  BaseStatement,
  ClientProcStatement,
  StateStatement,
} from "../../yom.js";
import { ColumnEventHandlers, RowHeight } from "./types.js";

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

export function editFocusState(): StateStatement[] {
  return [
    record(
      "focus_state",
      "select 0 as column, 0 as row, false as should_focus"
    ),
    record(
      "editing_state",
      "select 0 as column, 0 as row, false as is_editing"
    ),
    scalar(`start_edit_with_char`, { type: "String", maxLength: 1 }),
    scalar("saving_edit", "false"),
    scalar(`display_error_message`, { type: "String", maxLength: 2000 }),
    scalar(`remove_error_task`, { type: "BigInt" }),
  ];
}

export function colKeydownHandlers(columns: ColumnEventHandlers[]) {
  const statements: ClientProcStatement[] = [];
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.keydownHeaderHandler) {
      statements.push(
        if_(`cell.row = 0 and cell.column = ${i}`, column.keydownHeaderHandler)
      );
    }
    if (column.keydownCellHandler) {
      statements.push(
        if_(`cell.row != 0 and cell.column = ${i}`, column.keydownCellHandler)
      );
    }
  }
  return statements;
}

export function colClickHandlers(columns: ColumnEventHandlers[]) {
  const headerStatements: ClientProcStatement[] = [];
  const cellStatements: ClientProcStatement[] = [];
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.headerClickHandler) {
      headerStatements.push(
        if_(`cell.column = ${i}`, column.headerClickHandler)
      );
    }
    if (column.cellClickHandler) {
      cellStatements.push(if_(`cell.column = ${i}`, column.cellClickHandler));
    }
  }
  if (headerStatements.length === 0 && cellStatements.length === 0) {
    return [];
  }
  return [if_(`cell.row = 0`, headerStatements, cellStatements)];
}

export function refreshKeyState() {
  return [scalar("dg_refresh_key", { type: "Int" }, "0")];
}

export function triggerQueryRefresh() {
  return setScalar(`ui.dg_refresh_key`, `ui.dg_refresh_key + 1`);
}

export interface ResizeableSeperatorOpts {
  minWidth?: number;
  width: string;
  setWidth: (width: string) => BaseStatement;
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
  return state({
    procedure: [
      scalar("start_width", { type: "BigInt" }),
      scalar(`start_x`, { type: "BigInt" }),
      scalar(`pending_width`, { type: "BigInt" }),
      scalar(`waiting`, `false`),
    ],
    children: element("div", {
      styles: styles.seperatorWrapper,
      dynamicClasses: [
        {
          classes: "active",
          condition: "start_width is not null",
        },
      ],
      on: {
        mouseDown: [
          setScalar("start_width", width),
          setScalar(`start_x`, `event.client_x`),
        ],
        click: [stopPropagation()],
      },
      children: [
        element("div", {
          styles: styles.seperator,
        }),
        ifNode(
          `start_width is not null`,
          eventHandlers({
            document: {
              mouseMove: [
                setScalar(`pending_width`, newValue),
                if_(`not waiting`, [
                  spawn({
                    detached: true,
                    statements: [
                      setScalar(`waiting`, `true`),
                      delay(`16`),
                      setWidth(`pending_width`),
                      setScalar(`waiting`, `false`),
                      commitUiChanges(),
                    ],
                  }),
                ]),
              ],
              mouseUp: [setScalar(`start_width`, `null`)],
            },
          })
        ),
      ],
    }),
  });
}
