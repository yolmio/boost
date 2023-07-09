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

export type BeforeEditTransaction = (
  newValue: string,
  recordId: string
) => ServiceProcStatement[];

interface FieldEditorOpts {
  tableName: string;
  fieldName: string;
  inputType?: string;
  transformValue?: (s: string) => string;
  isValid?: (s: string) => string;
  cellProps: CellProps;
  beforeEditTransaction?: BeforeEditTransaction;
  auth?: Authorization;
}

interface DoEditOpts {
  tableName: string;
  fieldName: string;
  dbValue: string;
  recordId: string;
  resetValue: ClientProcStatement[];
  beforeTransaction?: BeforeEditTransaction;
  auth?: Authorization;
}

export function doEdit(opts: DoEditOpts) {
  const beforeTx: ServiceProcStatement[] = [];
  if (opts.beforeTransaction) {
    beforeTx.push(...opts.beforeTransaction(opts.dbValue, opts.recordId));
  }
  return [
    setScalar(`ui.saving_edit_count`, `ui.saving_edit_count + 1`),
    setScalar(`ui.display_edit_failure`, `false`),
    commitUiChanges(),
    try_<ClientProcStatement>({
      body: [
        serviceProc([
          expectCurrentUserAuthorized(opts.auth),
          ...beforeTx,
          startTransaction(),
          modify(
            `update db.${ident(opts.tableName)} set ${ident(
              opts.fieldName
            )} = ${opts.dbValue} where id = ${opts.recordId}`
          ),
          commitTransaction(),
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

export interface FieldEditorHelpersOpts {
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
  beforeEditTransaction?: (
    newValue: string,
    recordId: string
  ) => ServiceProcStatement[];
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
      beforeTransaction: opts.beforeEditTransaction,
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

export function fieldEditor(opts: FieldEditorOpts) {
  const { value, recordId, setValue, nextCol } = opts.cellProps;
  const dbValue = opts.transformValue?.(value) ?? value;
  const handlers = fieldEditorEventHandlers({
    tableName: opts.tableName,
    fieldName: opts.fieldName,
    dbValue,
    recordId,
    value,
    setValue,
    validUiValue: opts.isValid?.(`ui.value`) ?? `true`,
    changedUiValue: `(${value} is null and trim(ui.value) != '') or ui.value != ${value}`,
    nextCol,
    beforeEditTransaction: opts.beforeEditTransaction,
    auth: opts.auth,
  });
  return state({
    procedure: [scalar(`value`, `coalesce(start_edit_with_char, ${value})`)],
    children: element("input", {
      styles: styles.cellInput,
      props: { value: `value`, yolmFocusKey: `true`, type: opts.inputType },
      on: {
        ...handlers,
        input: [setScalar(`ui.value`, `target_value`)],
      },
    }),
  });
}
