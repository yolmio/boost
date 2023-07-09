import { checkbox } from "../../components/checkbox.js";
import { recordSelectDialog } from "../../components/searchDialog.js";
import { selectIcon } from "../../components/select.js";
import { mergeElEventHandlers } from "../../components/utils.js";
import {
  Authorization,
  BoolField,
  DateField,
  DurationField,
  EnumField,
  Field,
  ForeignKeyField,
  ImageSetFieldGroup,
  StringField,
} from "../../modelTypes.js";
import { element, ifNode, state } from "../../nodeHelpers.js";
import {
  commitUiChanges,
  delay,
  exit,
  if_,
  modify,
  preventDefault,
  scalar,
  serviceProc,
  setScalar,
  spawn,
  try_,
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { createStyles, visuallyHiddenStyles } from "../../styleUtils.js";
import { enumLikeDisplayName } from "../../utils/enumLike.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { doEdit } from "./editHelper.js";
import { triggerQueryRefresh } from "./shared.js";
import { fieldEditor, fieldEditorEventHandlers } from "./editHelper.js";
import { styles as sharedStyles } from "./styles.js";
import { ClientProcStatement, ServiceProcStatement } from "../../yom.js";
import { button } from "../../components/button.js";
import { materialIcon } from "../../components/materialIcon.js";
import { imageDalog } from "../../components/imageDialog.js";
import { getUploadStatements } from "../../utils/image.js";
import { Cell } from "./types.js";

const styles = createStyles({
  select: {
    border: 0,
    outline: "none",
    background: "none",
    fontSize: "inherit",
    color: "inherit",
    alignSelf: "stretch",
    // make children horizontally aligned
    display: "flex",
    alignItems: "center",
    flex: 1,
    fontFamily: "inherit",
    cursor: "pointer",
    appearance: "none",
  },
  selectIcon: {
    "--icon-font-size": "1.125rem",
    color: "inherit",
    position: "absolute",
    userSelect: "none",
    pointerEvents: "none",
    right: "0.25rem",
    display: "flex",
    alignItems: "center",
    height: "100%",
  },
  selectWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  imgInput: {
    display: "flex",
  },
  uploadButton: () => {
    return { mx: "auto", "&:focus-within": model.theme.focus.default };
  },
  checkbox: {
    mx: "auto",
  },
  imgWrapper: {
    width: "100%",
    height: "100%",
    py: 0.5,
  },
  img: {
    objectFit: "contain",
    width: "100%",
    height: "100%",
    cursor: "pointer",
  },
});

export function foreignKeyCell(
  opts: BaseFieldCellOpts,
  field: ForeignKeyField
): Cell {
  const toTable = model.database.tables[field.table];
  const nameExpr = toTable.recordDisplayName!.expr(
    ...toTable.recordDisplayName!.fields.map((f) => `r.${f}`)
  );
  if (!toTable.searchConfig) {
    throw new Error(
      "No search config for table " +
        toTable.name +
        " in trying to make datagrid cell for foreign key field " +
        opts.tableName +
        "." +
        field.name +
        "."
    );
  }
  return (props) => {
    const shouldUseEditedText = `did_edit and ((edited_id is null and ${props.value} is null) or edited_id = try_cast(${props.value} as bigint))`;
    return state({
      procedure: [
        scalar(`edited_text`, { type: "String", maxLength: 1000 }),
        scalar(`edited_id`, { type: "BigInt" }),
        scalar(`did_edit`, `false`),
      ],
      children: state({
        watch: [`${props.value}`],
        procedure: [
          scalar(
            `text`,
            `(select ${nameExpr} from db.${toTable.name} as r where id = try_cast(${props.value} as bigint))`
          ),
        ],
        children: [
          element("span", {
            styles: sharedStyles.ellipsisSpan,
            children: `case when ${shouldUseEditedText} then edited_text else text end`,
          }),
          ifNode(
            props.editing,
            recordSelectDialog({
              onSelect: (id, label) => [
                if_(
                  `${props.value} is null or ${id} != try_cast(${props.value} as bigint)`,
                  [
                    setScalar(`edited_id`, id),
                    setScalar(`edited_text`, label),
                    modify(`update ui.editing_state set is_editing = false`),
                    modify(`update ui.focus_state set should_focus = true`),
                    ...doEdit({
                      tableName: opts.tableName,
                      dbValue: id,
                      fieldName: field.name,
                      recordId: props.recordId,
                      resetValue: [],
                      beforeTransaction: opts.beforeEditTransaction,
                      auth: opts.auth,
                    }),
                  ]
                ),
              ],
              open: `true`,
              onClose: [
                modify(`update ui.editing_state set is_editing = false`),
                modify(`update ui.focus_state set should_focus = true`),
              ],
              table: toTable.name,
            })
          ),
        ],
      }),
    });
  };
}

export function enumCell(opts: BaseFieldCellOpts, field: EnumField): Cell {
  return (props) => {
    const enumModel = model.enums[field.enum];
    const handlers = fieldEditorEventHandlers({
      tableName: opts.tableName,
      fieldName: field.name,
      dbValue: `ui.value`,
      recordId: props.recordId,
      value: props.value,
      setValue: props.setValue,
      validUiValue: `true`,
      changedUiValue: `cast(ui.value as string) != ${props.value}`,
      nextCol: props.nextCol,
      beforeEditTransaction: opts.beforeEditTransaction,
      auth: opts.auth,
    });
    return ifNode(
      props.editing,
      state({
        procedure: [
          scalar(
            `value`,
            `try_cast(${props.value} as enums.${enumModel.name})`
          ),
        ],
        children: element("div", {
          styles: styles.selectWrapper,
          children: [
            element("select", {
              styles: styles.select,
              props: { value: `value`, yolmFocusKey: `true` },
              children: Object.values(enumModel.values).map((v) =>
                element("option", {
                  children: stringLiteral(v.displayName),
                  props: { value: stringLiteral(v.name) },
                })
              ),
              on: {
                ...handlers,
                input: [
                  setScalar(
                    `ui.value`,
                    `cast(target_value as enums.${enumModel.name}))`
                  ),
                ],
              },
            }),
            element("span", {
              styles: styles.selectIcon,
              children: selectIcon(),
            }),
          ],
        }),
      }),
      element("span", {
        styles: sharedStyles.ellipsisSpan,
        children: enumModel.getDisplayName!(
          `try_cast(${props.value} as enums.${enumModel.name})`
        ),
      })
    );
  };
}

export function dateCell(opts: BaseFieldCellOpts, field: DateField): Cell {
  return (props) => {
    return props.value;
    const formatString = field.formatString ?? "%-d %b %Y";
    return ifNode(
      props.editing,
      fieldEditor({
        cellProps: props,
        fieldName: field.name,
        tableName: opts.tableName,
        inputType: "'date'",
        beforeEditTransaction: opts.beforeEditTransaction,
        auth: opts.auth,
        transformValue: (value) => `try_cast(${value} as date)`,
        isValid: (value) => `try_cast(${value} as date) is not null`,
      }),
      element("span", {
        styles: sharedStyles.ellipsisSpan,
        children: `format.date(try_cast(${
          props.value
        } as date), ${stringLiteral(formatString)})`,
      })
    );
  };
}

export function stringCell(opts: BaseFieldCellOpts, field: StringField): Cell {
  return (props) =>
    ifNode(
      props.editing,
      fieldEditor({
        cellProps: props,
        fieldName: field.name,
        tableName: opts.tableName,
        beforeEditTransaction: opts.beforeEditTransaction,
      }),
      element("span", {
        styles: sharedStyles.ellipsisSpan,
        children: props.value,
      })
    );
}

export function boolCell(opts: BaseFieldCellOpts, field: BoolField): Cell {
  const { enumLike } = field;
  if (enumLike) {
    return (props) => {
      const handlers = fieldEditorEventHandlers({
        tableName: opts.tableName,
        fieldName: field.name,
        dbValue: `try_cast(ui.value as bool)`,
        recordId: props.recordId,
        value: props.value,
        setValue: props.setValue,
        validUiValue: `true`,
        changedUiValue: `coalesce(${props.value}, '') != ui.value`,
        nextCol: props.nextCol,
        beforeEditTransaction: opts.beforeEditTransaction,
        auth: opts.auth,
      });
      return ifNode(
        props.editing,
        state({
          procedure: [scalar(`value`, props.value)],
          children: element("div", {
            styles: styles.selectWrapper,
            children: [
              element("select", {
                styles: styles.select,
                props: { value: `value`, yolmFocusKey: `true` },
                children: [
                  element("option", {
                    children: stringLiteral(enumLike.true),
                    props: { value: "'true'" },
                  }),
                  element("option", {
                    children: stringLiteral(enumLike.false),
                    props: { value: "'false'" },
                  }),
                  !field.notNull
                    ? element("option", {
                        children: stringLiteral(enumLike.null ?? "Unspecified"),
                        props: {
                          value: "''",
                        },
                      })
                    : null,
                ],
                on: {
                  ...handlers,
                  input: [setScalar(`ui.value`, `target_value`)],
                },
              }),
              element("span", {
                styles: styles.selectIcon,
                children: selectIcon(),
              }),
            ],
          }),
        }),
        element("span", {
          styles: sharedStyles.ellipsisSpan,
          children: enumLikeDisplayName(
            `try_cast(${props.value} as bool)`,
            enumLike
          ),
        })
      );
    };
  }
  return (props) =>
    checkbox({
      styles: styles.checkbox,
      checked: opts.stringified ? props.value + " = 'true'" : props.value,
      variant: "outlined",
      color: "neutral",
      slots: { input: { props: { tabIndex: "-1" } } },
      on: {
        checkboxChange: {
          detachedFromNode: true,
          procedure: [
            scalar(`prev_value`, props.value),
            ...props.setValue(
              opts.stringified
                ? `cast(target_checked as string)`
                : `target_checked`
            ),
            ...doEdit({
              tableName: opts.tableName,
              fieldName: field.name,
              dbValue: opts.stringified
                ? `cast(${props.value} as bool)`
                : props.value,
              recordId: props.recordId,
              resetValue: props.setValue(`prev_value`),
              beforeTransaction: opts.beforeEditTransaction,
              auth: opts.auth,
            }),
          ],
        },
      },
    });
}

export function durationCell(
  opts: BaseFieldCellOpts,
  field: DurationField
): Cell {
  if (field.size === "minutes") {
    return (props) => {
      const handlers = fieldEditorEventHandlers({
        tableName: opts.tableName,
        fieldName: field.name,
        dbValue: `sfn.parse_minutes_duration(ui.input_value)`,
        recordId: props.recordId,
        value: props.value,
        setValue: props.setValue,
        validUiValue: `sfn.parse_minutes_duration(ui.input_value) is not null`,
        changedUiValue: `coalesce(try_cast(${props.value} as bigint), 0) != coalesce(sfn.parse_minutes_duration(ui.input_value), 0)`,
        nextCol: props.nextCol,
        newUiValue: `cast(sfn.parse_minutes_duration(ui.input_value) as string)`,
        auth: opts.auth,
        beforeEditTransaction: opts.beforeEditTransaction,
      });
      return ifNode(
        props.editing,
        state({
          procedure: [
            scalar(
              `value`,
              `case when
                  start_edit_with_char is not null and start_edit_with_char in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
                    then start_edit_with_char
                  else sfn.display_minutes_duration(try_cast(${props.value} as bigint))
                end`
            ),
            scalar(`input_value`, `value`),
          ],
          children: element("input", {
            styles: sharedStyles.cellInput,
            props: {
              value: `value`,
              yolmFocusKey: `true`,
              inputMode: "'numeric'",
            },
            on: mergeElEventHandlers(handlers, {
              keydown: [
                if_(
                  `not event.ctrl_key and not event.meta_key and char_length(event.key) = 1 and event.key not in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ':')`,
                  [preventDefault()]
                ),
              ],
              input: [setScalar(`input_value`, `target_value`)],
              change: [
                setScalar(
                  `value`,
                  `sfn.display_minutes_duration(sfn.parse_minutes_duration(target_value))`
                ),
              ],
            }),
          }),
        }),
        element("span", {
          styles: sharedStyles.ellipsisSpan,
          children: `sfn.display_minutes_duration(try_cast(${props.value} as bigint))`,
        })
      );
    };
  }
  throw new Error("Unsupported duration size: " + field.size);
}

export function imageCell(
  opts: BaseFieldCellOpts,
  group: ImageSetFieldGroup
): Cell {
  return ({ value, recordId, editing, stopEditing, row, column }) => {
    const { spawnUploadTasks, joinUploadTasks, updateImagesInDb } =
      getUploadStatements(opts.tableName, recordId, group);
    return ifNode(
      value + " is null",
      state({
        procedure: [scalar(`uploading`, `false`)],
        children: [
          button({
            tag: "label",
            startDecorator: materialIcon("Upload"),
            styles: styles.uploadButton(),
            size: "sm",
            children: [
              element("input", {
                styles: visuallyHiddenStyles,
                props: {
                  accept: "'image/*'",
                  type: `'file'`,
                  tabIndex: "-1",
                },
                on: {
                  fileChange: [
                    if_(`uploading`, exit()),
                    setScalar(`uploading`, `true`),
                    commitUiChanges(),
                    ...spawnUploadTasks,
                    try_<ClientProcStatement>({
                      body: [
                        ...joinUploadTasks,
                        serviceProc([
                          ...updateImagesInDb,
                          triggerQueryRefresh(),
                        ]),
                      ],
                      catch: [
                        setScalar(`ui.display_edit_failure`, `true`),
                        spawn([
                          delay(`4000`),
                          setScalar(`ui.display_edit_failure`, `false`),
                          commitUiChanges(),
                        ]),
                      ],
                    }),
                    setScalar(`uploading`, `false`),
                  ],
                },
              }),
              `'Upload'`,
            ],
            variant: "outlined",
            color: "neutral",
            loading: `uploading`,
            loadingPosition: "start",
          }),
        ],
      }),
      state({
        procedure: [scalar(`open`, `false`)],
        children: [
          element("div", {
            styles: styles.imgWrapper,
            children: element("img", {
              styles: styles.img,
              props: {
                src: `'/_a/file/' || sys.account || '/' || sys.app || '/' || ${value}`,
              },
              on: {
                click: [
                  setScalar(`ui.open`, `true`),
                  modify(`update ui.editing_state set is_editing = false`),
                  modify(
                    `update ui.focus_state set should_focus = false, row = ${row}, column = ${column}`
                  ),
                ],
              },
            }),
          }),
          imageDalog({
            open: `ui.open or ${editing}`,
            onClose: [
              setScalar(`ui.open`, `false`),
              ...stopEditing,
              delay(`10`),
              modify(`update ui.focus_state set should_focus = true`),
            ],
            group: group.name,
            tableName: opts.tableName,
            recordId,
            afterReplace: [triggerQueryRefresh()],
            afterRemove: [triggerQueryRefresh()],
          }),
        ],
      })
    );
  };
}

export interface FieldCellOpts extends BaseFieldCellOpts {
  field: Field;
}

export interface BaseFieldCellOpts {
  tableName: string;
  stringified: boolean;
  beforeEditTransaction?: (
    newValue: string,
    recordId: string
  ) => ServiceProcStatement[];
  auth?: Authorization;
}

export function fieldCell(opts: FieldCellOpts): Cell {
  if (opts.field.type === "ForeignKey") {
    return foreignKeyCell(opts, opts.field);
  }
  if (opts.field.type === "Enum") {
    return enumCell(opts, opts.field);
  }
  if (opts.field.type === "Date") {
    return dateCell(opts, opts.field);
  }
  if (opts.field.type === "String") {
    return stringCell(opts, opts.field);
  }
  if (opts.field.type === "Bool") {
    return boolCell(opts, opts.field);
  }
  if (opts.field.type === "Duration") {
    return durationCell(opts, opts.field);
  }
  if (opts.field.type === "Uuid" && opts.field.group) {
    const table = model.database.tables[opts.tableName];
    const group = table.fieldGroups[opts.field.group];
    if (group.type === "Image") {
      return imageCell(opts, group);
    }
  }
  return ({ value }) =>
    element("span", {
      styles: sharedStyles.ellipsisSpan,
      children: value,
    });
}
