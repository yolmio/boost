import { HelperEventHandlers } from "../../nodeHelpers";
import {
  BasicStatements,
  DomStatements,
  DomStatementsOrFn,
  ServiceStatementsOrFn,
} from "../../statements";
import { ident, parenWrap, stringLiteral } from "../../utils/sqlHelpers";
import { triggerQueryRefresh } from "./shared";

export type FieldEditStatements = (
  newValue: string,
  recordId: string
) => ServiceStatementsOrFn;

export interface FieldEditProcConfig {
  beforeEditTransaction?: FieldEditStatements;
  beforeEdit?: FieldEditStatements;
  afterEdit?: FieldEditStatements;
  afterEditTransaction?: FieldEditStatements;
}

interface DoEditOpts extends FieldEditProcConfig {
  tableName: string;
  fieldName: string;
  dbValue: string;
  recordId: string;
  resetValue: DomStatementsOrFn;
}

export function displayEditError(message: string) {
  return new DomStatements()
    .setScalar(`ui.display_error_message`, stringLiteral(message))
    .spawn({
      detached: true,
      procedure: (s) =>
        s
          .delay(`4000`)
          .setScalar(`ui.display_error_message`, `null`)
          .commitUiChanges(),
    });
}

export function doEdit(opts: DoEditOpts) {
  return new DomStatements()
    .setScalar(`ui.saving_edit`, `true`)
    .setScalar(`ui.display_error_message`, `null`)
    .commitUiChanges()
    .try({
      body: (s) =>
        s.serviceProc((s) =>
          s
            .statements(
              opts.beforeEditTransaction?.(opts.dbValue, opts.recordId)
            )
            .startTransaction()
            .statements(opts.beforeEdit?.(opts.dbValue, opts.recordId))
            .modify(
              `update db.${ident(opts.tableName)} set ${ident(
                opts.fieldName
              )} = ${opts.dbValue} where id = ${opts.recordId}`
            )
            .statements(opts.afterEdit?.(opts.dbValue, opts.recordId))
            .commitTransaction()
            .statements(
              opts.afterEditTransaction?.(opts.dbValue, opts.recordId),
              triggerQueryRefresh()
            )
        ),
      errorName: `err`,
      catch: (s) =>
        s.statements(opts.resetValue, displayEditError(`Error saving edit`)),
      finally: (s) => s.setScalar(`ui.saving_edit`, `false`),
    });
}

export type FieldEditType =
  | { type: "text" }
  | {
      type: "textWithTransform";
      transform: (s: string) => string;
      validate: (s: string) => string;
    }
  | { type: "opaque" };

export interface FieldEditorHelpersOpts extends FieldEditProcConfig {
  tableName: string;
  fieldName: string;
  dbValue: string;
  recordId: string;
  value: string;
  newUiValue?: string;
  setValue: (s: string) => BasicStatements;
  validUiValue: string;
  changedUiValue: string;
  nextCol: string;
}

export function fieldEditorEventHandlers(
  opts: FieldEditorHelpersOpts
): HelperEventHandlers {
  const editStatements = new DomStatements()
    .scalar(`prev_value`, opts.value)
    .statements(
      opts.setValue(opts.newUiValue ?? `ui.value`),
      doEdit({
        ...opts,
        resetValue: opts.setValue(`prev_value`),
      })
    );
  return {
    click: (s) => s.stopPropagation(),
    keydown: {
      detachedFromNode: true,
      procedure: (s) =>
        s
          .stopPropagation()
          .if(`event.key = 'Enter'`, (s) =>
            s
              .modify(`update ui.editing_state set is_editing = false`)
              .modify(`update ui.focus_state set should_focus = true`)
              .if(`not ${parenWrap(opts.validUiValue)}`, (s) =>
                s.statements(displayEditError(`Invalid value`)).return()
              )
              .if(opts.changedUiValue, editStatements)
          )
          .if(`event.key = 'Escape'`, (s) =>
            s
              .modify(`update ui.editing_state set is_editing = false`)
              .modify(`update ui.focus_state set should_focus = true`)
          )
          .if(`event.key = 'Tab'`, (s) =>
            s
              .preventDefault()
              .scalar(`next_col`, { type: "SmallInt" }, opts.nextCol)
              .modify(`update ui.editing_state set is_editing = false`)
              .modify(
                `update ui.focus_state set should_focus = true, column = next_col`
              )
              .if(`next_col is null`, (s) => s.return())
              .if(`not ${parenWrap(opts.validUiValue)}`, (s) =>
                s.statements(displayEditError(`Invalid value`)).return()
              )
              .if(opts.changedUiValue, editStatements)
          ),
    },
    blur: {
      detachedFromNode: true,
      procedure: (s) =>
        s
          .modify(`update ui.editing_state set is_editing = false`)
          .if(`not ${parenWrap(opts.validUiValue)}`, (s) =>
            s.statements(displayEditError(`Invalid value`)).return()
          )
          .if(opts.changedUiValue, editStatements),
    },
  };
}
