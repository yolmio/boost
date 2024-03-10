import { HelperEventHandlers, nodes } from "../../nodeHelpers";
import {
  BasicStatements,
  DomStatements,
  DomStatementsOrFn,
  ServiceStatementsOrFn,
  StateStatements,
} from "../../statements";
import { createStyles } from "../../styleUtils";
import * as yom from "../../yom";
import { ident, parenWrap } from "../../utils/sqlHelpers";
import { Node } from "../../nodeTypes";

export interface ColumnEventHandlers {
  keydownCellHandler?: DomStatementsOrFn;
  keydownHeaderHandler?: DomStatementsOrFn;
  headerClickHandler?: DomStatementsOrFn;
  cellClickHandler?: DomStatementsOrFn;
}

export type RowHeight = "short" | "medium" | "tall" | "extraTall";

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
      "select 0 as column, 0 as row, false as should_focus",
    )
    .record(
      "editing_state",
      "select 0 as column, 0 as row, false as is_editing",
    )
    .scalar(`start_edit_empty`, `false`)
    .scalar("saving_edit", "false")
    .scalar(`display_error_message`, { type: "String", maxLength: 2000 });
}

interface UpdateCellFieldOpts extends FieldEditProcConfig {
  tableName: string;
  fieldName: string;
  dbValue: yom.SqlExpression;
  resetValue: DomStatementsOrFn;
  recordId: yom.SqlExpression;
}

export class DgStateHelpers {
  focusState = {
    column: "focus_state.column" as yom.SqlExpression,
    row: "focus_state.row" as yom.SqlExpression,
    shouldFocus: "focus_state.should_focus" as yom.SqlExpression,
  };
  editingState = {
    column: "editing_state.column" as yom.SqlExpression,
    row: "editing_state.row" as yom.SqlExpression,
    isEditing: "editing_state.is_editing" as yom.SqlExpression,
  };
  startEditEmpty = "start_edit_empty" as yom.SqlExpression;
  savingEdit = "saving_edit" as yom.SqlExpression;
  displayErrorMessage = "display_error_message" as yom.SqlExpression;
  refreshKey = "ui.dg_refresh_key" as yom.SqlExpression;

  get triggerRefresh() {
    return new BasicStatements().setScalar(
      this.refreshKey,
      `${this.refreshKey} + 1`,
    );
  }

  setErrorMessage(message: yom.SqlExpression) {
    return new BasicStatements().setScalar(this.displayErrorMessage, message);
  }

  setSavingEdit(saving: yom.SqlExpression) {
    return new BasicStatements().setScalar(this.savingEdit, saving);
  }

  setStartEditEmpty(char: yom.SqlExpression) {
    return new BasicStatements().setScalar(this.startEditEmpty, char);
  }

  displayEditErrorAndRemoveAfter(
    message: yom.SqlExpression,
    delay: yom.SqlExpression = "4000",
  ) {
    return new DomStatements().statements(this.setErrorMessage(message)).spawn({
      detached: true,
      procedure: (s) =>
        s
          .delay(delay)
          .statements(this.setErrorMessage(`null`))
          .commitUiTreeChanges(),
    });
  }

  doEditTransaction(opts: {
    beforeTransaction?: ServiceStatementsOrFn;
    transactionBody: ServiceStatementsOrFn;
    afterTransaction?: ServiceStatementsOrFn;
    onError: (errRecord: string) => DomStatementsOrFn;
  }) {
    return new DomStatements()
      .statements(this.setSavingEdit(`true`), this.setErrorMessage(`null`))
      .commitUiTreeChanges()
      .try({
        body: (s) =>
          s.serviceProc((s) =>
            s
              .statements(opts.beforeTransaction)
              .startTransaction()
              .statements(opts.transactionBody)
              .commitTransaction()
              .statements(opts.afterTransaction, this.triggerRefresh),
          ),
        errorName: `edit_err`,
        catch: opts.onError(`edit_err`),
        finally: this.setSavingEdit(`false`),
      });
  }

  updateFieldValueInDb(opts: UpdateCellFieldOpts) {
    return this.doEditTransaction({
      beforeTransaction: opts.beforeEditTransaction?.(
        opts.dbValue,
        opts.recordId,
      ),
      afterTransaction: opts.afterEditTransaction?.(
        opts.dbValue,
        opts.recordId,
      ),
      transactionBody: (s) =>
        s
          .statements(opts.beforeEdit?.(opts.dbValue, opts.recordId))
          .modify(
            `update db.${ident(opts.tableName)} set ${ident(
              opts.fieldName,
            )} = ${opts.dbValue} where id = ${opts.recordId}`,
          )
          .statements(opts.afterEdit?.(opts.dbValue, opts.recordId)),
      onError: () => (s) =>
        s.statements(
          opts.resetValue,
          this.displayEditErrorAndRemoveAfter(`'Error saving edit'`),
        ),
    });
  }
}

export const dgState = new DgStateHelpers();

export type FieldEditStatements = (
  newValue: string,
  recordId: string,
) => ServiceStatementsOrFn;

export interface FieldEditProcConfig {
  beforeEditTransaction?: FieldEditStatements;
  beforeEdit?: FieldEditStatements;
  afterEdit?: FieldEditStatements;
  afterEditTransaction?: FieldEditStatements;
}

export interface FieldEditorHelpersOpts extends FieldEditProcConfig {
  tableName: string;
  fieldName: string;
  dbValue: yom.SqlExpression;
  newUiValue?: yom.SqlExpression;
  validUiValue: yom.SqlExpression;
  changedUiValue: yom.SqlExpression;
  recordId?: yom.SqlExpression;
}

export class CellHelpers {
  record = `dg_record`;
  row: yom.SqlExpression = `${this.record}.iteration_index + 1`;

  constructor(
    private opts: {
      column: number;
      field?: string;
      idField: string;
    },
    public nextCol: yom.SqlExpression,
    public recordId: yom.SqlExpression,
  ) {}

  get value(): yom.SqlExpression {
    return this.opts.field ? this.record + `.` + this.opts.field : `null`;
  }
  get editing(): yom.SqlExpression {
    return `editing_state.is_editing and editing_state.column = ${this.opts.column} and editing_state.row = ${this.row}`;
  }
  setValue(v: yom.SqlExpression) {
    return this.opts.field
      ? new BasicStatements().modify(
          `update ui.dg_table set ${this.opts.field} = ${v} where dg_table.${this.opts.idField} = ${this.record}.${this.opts.idField}`,
        )
      : new BasicStatements();
  }

  get stopEditingAndFocus() {
    return new BasicStatements()
      .modify(`update ui.editing_state set is_editing = false`)
      .modify(`update ui.focus_state set should_focus = true`);
  }

  get column(): yom.SqlExpression {
    return this.opts.column.toString();
  }

  updateFieldValueInDb(
    opts: Omit<UpdateCellFieldOpts, "recordId"> & {
      recordId?: yom.SqlExpression;
    },
  ) {
    return dgState.updateFieldValueInDb({
      ...opts,
      recordId: opts.recordId ?? this.recordId,
    });
  }

  fieldEditorEventHandlers(opts: FieldEditorHelpersOpts): HelperEventHandlers {
    const editStatements = new DomStatements()
      .scalar(`prev_value`, this.value)
      .statements(
        this.setValue(opts.newUiValue ?? `ui.value`),
        this.updateFieldValueInDb({
          ...opts,
          resetValue: this.setValue(`prev_value`),
        }),
      );
    const displayErrAndExit = new DomStatements()
      .statements(dgState.displayEditErrorAndRemoveAfter(`'Invalid value'`))
      .return();
    return {
      click: (s) => s.stopPropagation(),
      keydown: {
        detachedFromNode: true,
        procedure: (s) =>
          s
            .stopPropagation()
            .if(`event.key = 'Enter'`, (s) =>
              s
                .statements(this.stopEditingAndFocus)
                .if(`not ${parenWrap(opts.validUiValue)}`, displayErrAndExit)
                .if(opts.changedUiValue, editStatements),
            )
            .if(`event.key = 'Escape'`, this.stopEditingAndFocus)
            .if(`event.key = 'Tab'`, (s) =>
              s
                .preventDefault()
                .scalar(`next_col`, { type: "SmallInt" }, this.nextCol)
                .modify(`update ui.editing_state set is_editing = false`)
                .modify(
                  `update ui.focus_state set should_focus = true, column = next_col`,
                )
                .if(`next_col is null`, (s) => s.return())
                .if(`not ${parenWrap(opts.validUiValue)}`, displayErrAndExit)
                .if(opts.changedUiValue, editStatements),
            ),
      },
      blur: {
        detachedFromNode: true,
        procedure: (s) =>
          s
            .modify(`update ui.editing_state set is_editing = false`)
            .if(`not ${parenWrap(opts.validUiValue)}`, displayErrAndExit)
            .if(opts.changedUiValue, editStatements),
      },
    };
  }
}

export type CellNode = (cell: CellHelpers, state: DgStateHelpers) => Node;

export function colKeydownHandlers(columns: ColumnEventHandlers[]) {
  const statements = new DomStatements();
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (column.keydownHeaderHandler) {
      statements.if(
        `cell.row = 0 and cell.column = ${i}`,
        column.keydownHeaderHandler,
      );
    }
    if (column.keydownCellHandler) {
      statements.if(
        `cell.row != 0 and cell.column = ${i}`,
        column.keydownCellHandler,
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
                s
                  .setScalar(`pending_width`, newValue)
                  .setScalar("pending_width", "pending_width")
                  .if(`not waiting`, (s) =>
                    s.spawn({
                      detached: true,
                      procedure: (s) =>
                        s
                          .setScalar(`waiting`, `true`)
                          .delay(`16`)
                          .statements(setWidth(`pending_width`))
                          .setScalar(`waiting`, `false`)
                          .commitUiTreeChanges(),
                    }),
                  ),
              mouseUp: (s) => s.setScalar(`start_width`, `null`),
            },
          }),
        ),
      ],
    }),
  });
}
