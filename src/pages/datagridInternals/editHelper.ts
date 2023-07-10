import { Authorization } from "../../modelTypes.js";
import { element, state } from "../../nodeHelpers.js";
import {
  commitTransaction,
  commitUiChanges,
  delay,
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
import { expectCurrentUserAuthorized } from "../../utils/auth.js";
import { ident } from "../../utils/sqlHelpers.js";
import {
  BaseStatement,
  ClientProcStatement,
  ElementEventHandlers,
  ServiceProcStatement,
} from "../../yom.js";
import { triggerQueryRefresh } from "./shared.js";
import { styles } from "./styles.js";
import { CellProps } from "./types.js";

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

interface FieldEditorOpts extends FieldEditProcConfig {
  tableName: string;
  fieldName: string;
  inputType?: string;
  transformValue?: (s: string) => string;
  isValid?: (s: string) => string;
  cellProps: CellProps;
  auth?: Authorization;
}

interface DoEditOpts extends FieldEditProcConfig {
  tableName: string;
  fieldName: string;
  dbValue: string;
  recordId: string;
  resetValue: ClientProcStatement[];
  auth?: Authorization;
}

export function doEdit(opts: DoEditOpts) {
  const beforeTx: ServiceProcStatement[] = [];
  if (opts.beforeEditTransaction) {
    beforeTx.push(...opts.beforeEditTransaction(opts.dbValue, opts.recordId));
  }
  return [
    setScalar(`ui.saving_edit_count`, `ui.saving_edit_count + 1`),
    setScalar(`ui.display_edit_failure`, `false`),
    commitUiChanges(),
    try_<ClientProcStatement>({
      body: [
        serviceProc([
          expectCurrentUserAuthorized(opts.auth),
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
      catch: [
        ...opts.resetValue,
        setScalar(`ui.display_edit_failure`, `true`),
        spawn([
          delay(`4000`),
          setScalar(`ui.display_edit_failure`, `false`),
          commitUiChanges(),
        ]),
      ],
      finally: [setScalar(`ui.saving_edit_count`, `ui.saving_edit_count - 1`)],
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
  auth?: Authorization;
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
          if_(
            `${opts.changedUiValue} and ${opts.validUiValue}`,
            editStatements
          ),
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
          if_(
            `next_col is not null and ${opts.changedUiValue} and ${opts.validUiValue}`,
            editStatements
          ),
        ]),
      ],
    },
    blur: {
      detachedFromNode: true,
      procedure: [
        if_(`${opts.changedUiValue} and ${opts.validUiValue}`, editStatements),
      ],
    },
  };
}
