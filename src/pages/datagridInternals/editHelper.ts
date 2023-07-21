import {
  commitTransaction,
  commitUiChanges,
  debugExpr,
  delay,
  exit,
  if_,
  modify,
  preventDefault,
  scalar,
  serviceProc,
  setScalar,
  spawn,
  startTransaction,
  stopPropagation,
  try_,
} from "../../procHelpers.js";
import { ident, parenWrap, stringLiteral } from "../../utils/sqlHelpers.js";
import {
  BaseStatement,
  ClientProcStatement,
  ElementEventHandlers,
  ServiceProcStatement,
} from "../../yom.js";
import { triggerQueryRefresh } from "./shared.js";

export type FieldEditStatements = (
  newValue: string,
  recordId: string
) => ServiceProcStatement[];

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
  resetValue: ClientProcStatement[];
}

export function displayEditError(message: string) {
  return [
    setScalar(`ui.display_error_message`, stringLiteral(message)),
    spawn({
      detached: true,
      statements: [
        delay(`4000`),
        setScalar(`ui.display_error_message`, `null`),
        commitUiChanges(),
      ],
    }),
  ];
}

export function doEdit(opts: DoEditOpts) {
  return [
    setScalar(`ui.saving_edit`, `true`),
    setScalar(`ui.display_error_message`, `null`),
    commitUiChanges(),
    try_<ClientProcStatement>({
      body: [
        serviceProc([
          ...(opts.beforeEditTransaction?.(opts.dbValue, opts.recordId) ?? []),
          startTransaction(),
          ...(opts.beforeEdit?.(opts.dbValue, opts.recordId) ?? []),
          modify(
            `update db.${ident(opts.tableName)} set ${ident(
              opts.fieldName
            )} = ${opts.dbValue} where id = ${opts.recordId}`
          ),
          ...(opts.afterEdit?.(opts.dbValue, opts.recordId) ?? []),
          commitTransaction(),
          ...(opts.afterEditTransaction?.(opts.dbValue, opts.recordId) ?? []),
          triggerQueryRefresh(),
        ]),
      ],
      errorName: `err`,
      catch: [...opts.resetValue, ...displayEditError(`Error saving edit`)],
      finally: [setScalar(`ui.saving_edit`, `false`)],
    }),
  ];
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
  setValue: (s: string) => BaseStatement[];
  validUiValue: string;
  changedUiValue: string;
  nextCol: string;
}

export function fieldEditorEventHandlers(
  opts: FieldEditorHelpersOpts
): ElementEventHandlers {
  const editStatements = [
    scalar(`prev_value`, opts.value),
    ...opts.setValue(opts.newUiValue ?? `ui.value`),
    ...doEdit({
      ...opts,
      resetValue: opts.setValue(`prev_value`),
    }),
  ];
  return {
    click: [stopPropagation()],
    keydown: {
      detachedFromNode: true,
      procedure: [
        stopPropagation(),
        if_(`event.key = 'Enter'`, [
          modify(`update ui.editing_state set is_editing = false`),
          modify(`update ui.focus_state set should_focus = true`),
          if_(`not ${parenWrap(opts.validUiValue)}`, [
            ...displayEditError(`Invalid value`),
            exit(),
          ]),
          if_(opts.changedUiValue, editStatements),
        ]),
        if_(`event.key = 'Escape'`, [
          modify(`update ui.editing_state set is_editing = false`),
          modify(`update ui.focus_state set should_focus = true`),
        ]),
        if_(`event.key = 'Tab'`, [
          preventDefault(),
          scalar(`next_col`, { type: "SmallInt" }, opts.nextCol),
          modify(`update ui.editing_state set is_editing = false`),
          modify(
            `update ui.focus_state set should_focus = true, column = next_col`
          ),
          if_(`next_col is null`, [exit()]),
          if_(`not ${parenWrap(opts.validUiValue)}`, [
            ...displayEditError(`Invalid value`),
            exit(),
          ]),
          if_(opts.changedUiValue, editStatements),
        ]),
      ],
    },
    blur: {
      detachedFromNode: true,
      procedure: [
        modify(`update ui.editing_state set is_editing = false`),
        if_(`not ${parenWrap(opts.validUiValue)}`, [
          ...displayEditError(`Invalid value`),
          exit(),
        ]),
        if_(opts.changedUiValue, editStatements),
      ],
    },
  };
}
