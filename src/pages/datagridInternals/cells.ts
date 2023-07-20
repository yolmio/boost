import { checkbox } from "../../components/checkbox.js";
import { recordSelectDialog } from "../../components/searchDialog.js";
import { selectIcon } from "../../components/select.js";
import { mergeElEventHandlers } from "../../components/utils.js";
import {
  Authorization,
  BigIntField,
  BigUintField,
  BoolField,
  DateField,
  DecimalField,
  DoubleField,
  DurationUsage,
  EnumField,
  Field,
  FieldBase,
  ForeignKeyField,
  ImageSetFieldGroup,
  IntField,
  IntegerField,
  RealField,
  SmallIntField,
  SmallUintField,
  StringField,
  TimeField,
  TimestampField,
  TinyIntField,
  TinyUintField,
  UintField,
  UuidField,
} from "../../modelTypes.js";
import { element, ifNode, state } from "../../nodeHelpers.js";
import {
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
  try_,
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { createStyles, visuallyHiddenStyles } from "../../styleUtils.js";
import { enumLikeDisplayName } from "../../utils/enumLike.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { FieldEditProcConfig, displayEditError, doEdit } from "./editHelper.js";
import { triggerQueryRefresh } from "./shared.js";
import { fieldEditorEventHandlers } from "./editHelper.js";
import { ClientProcStatement, ServiceProcStatement } from "../../yom.js";
import { button } from "../../components/button.js";
import { materialIcon } from "../../components/materialIcon.js";
import { imageDalog } from "../../components/imageDialog.js";
import { getUploadStatements } from "../../utils/image.js";
import { Cell, CellProps } from "./types.js";
import { styles as sharedStyles } from "./styles.js";
import { iconButton } from "../../components/iconButton.js";

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
  nullableForeignKeyWrapper: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

function foreignKeyCell(opts: BaseFieldCellOpts, field: ForeignKeyField): Cell {
  const toTable = model.database.tables[field.table];
  const nameExpr = toTable.recordDisplayName!.expr(
    ...toTable.recordDisplayName!.fields.map((f) => `r.${f}`)
  );
  return (props) => {
    if (opts.immutable) {
      return state({
        watch: [`${props.value}`],
        procedure: [
          scalar(
            `text`,
            `(select ${nameExpr} from db.${toTable.name} as r where id = try_cast(${props.value} as bigint))`
          ),
        ],
        children: element("span", {
          styles: sharedStyles.ellipsisSpan,
          children: `text`,
        }),
      });
    }
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
    const shouldUseEditedText = `did_edit and ((edited_id is null and ${props.value} is null) or edited_id = try_cast(${props.value} as bigint))`;
    const text = element("span", {
      styles: sharedStyles.ellipsisSpan,
      children: `case when ${shouldUseEditedText} then edited_text else text end`,
    });
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
          field.notNull
            ? text
            : element("div", {
                styles: styles.nullableForeignKeyWrapper,
                children: [
                  text,
                  ifNode(
                    `text is not null`,
                    iconButton({
                      size: "sm",
                      variant: "plain",
                      color: "neutral",
                      children: materialIcon("Close"),
                      on: {
                        click: {
                          detachedFromNode: true,
                          procedure: [
                            scalar(`prev_id`, props.value),
                            ...props.setValue(`null`),
                            ...doEdit({
                              ...opts,
                              dbValue: `null`,
                              fieldName: field.name,
                              recordId: props.recordId,
                              resetValue: props.setValue(`prev_id`),
                            }),
                          ],
                        },
                      },
                    })
                  ),
                ],
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
                      ...opts,
                      dbValue: id,
                      fieldName: field.name,
                      recordId: props.recordId,
                      resetValue: [],
                    }),
                  ],
                  [
                    modify(`update ui.editing_state set is_editing = false`),
                    modify(`update ui.focus_state set should_focus = true`),
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

function enumCell(opts: BaseFieldCellOpts, field: EnumField): Cell {
  return (props) => {
    const enumModel = model.enums[field.enum];
    const display = element("span", {
      styles: sharedStyles.ellipsisSpan,
      children: enumModel.getDisplayName!(
        `try_cast(${props.value} as enums.${enumModel.name})`
      ),
    });
    if (opts.immutable) {
      return display;
    }
    const options = Object.values(enumModel.values).map((v) =>
      element("option", {
        children: stringLiteral(v.displayName),
        props: { value: stringLiteral(v.name) },
      })
    );
    if (!field.notNull) {
      options.unshift(
        element("option", {
          children: stringLiteral("No value"),
          props: { value: stringLiteral("''") },
        })
      );
    }
    const handlers = fieldEditorEventHandlers({
      ...opts,
      fieldName: field.name,
      dbValue: `ui.value`,
      recordId: props.recordId,
      value: props.value,
      setValue: props.setValue,
      validUiValue: `true`,
      changedUiValue: opts.stringified
        ? `case when ${props.value} is null then value is not null else value is null or try_cast(${props.value} as enums.${enumModel.name}) != value end`
        : `case when ${props.value} is null then value is not null else value is null or ${props.value} != value end`,
      newUiValue: opts.stringified ? `cast(value as string)` : `value`,
      nextCol: props.nextCol,
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
              children: options,
              on: {
                ...handlers,
                input: [
                  setScalar(
                    `ui.value`,
                    `try_cast(target_value as enums.${enumModel.name}))`
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
      display
    );
  };
}

function dateCell(opts: BaseFieldCellOpts, field: DateField): Cell {
  return (props) => {
    const formatString = field.formatString ?? "%-d %b %Y";
    const dateValue = opts.stringified
      ? `try_cast(${props.value} as date)`
      : props.value;
    const display = element("span", {
      styles: sharedStyles.ellipsisSpan,
      children: `format.date(${dateValue}, ${stringLiteral(formatString)})`,
    });
    if (opts.immutable) {
      return display;
    }
    const { value, recordId, setValue, nextCol } = props;
    const handlers = fieldEditorEventHandlers({
      fieldName: field.name,
      tableName: opts.tableName,
      dbValue: `value`,
      recordId,
      value,
      setValue,
      validUiValue: field.notNull ? `value is not null` : `true`,
      changedUiValue: `case when ${dateValue} is null then value is not null else value is null or ${dateValue} != value end`,
      nextCol,
    });
    const editor = state({
      procedure: [scalar(`value`, dateValue)],
      children: element("input", {
        styles: sharedStyles.cellInput,
        props: { value: `value`, yolmFocusKey: `true`, type: "'date'" },
        on: {
          ...handlers,
          input: [
            setScalar(`ui.value`, `try_cast(target_value as date)`),
            debugExpr(`ui.value`),
          ],
        },
      }),
    });
    return ifNode(props.editing, editor, display);
  };
}

function timestampCell(opts: BaseFieldCellOpts, field: TimestampField): Cell {
  return (props) => {
    const formatString = field.formatString ?? "%-d %b %Y %l:%M%p";
    const timestampValue = opts.stringified
      ? `try_cast(${props.value} as timestamp)`
      : props.value;
    const display = element("span", {
      styles: sharedStyles.ellipsisSpan,
      children: `format.date(${timestampValue}, ${stringLiteral(
        formatString
      )})`,
    });
    if (opts.immutable) {
      return display;
    }
    const { value, recordId, setValue, nextCol } = props;
    const handlers = fieldEditorEventHandlers({
      fieldName: field.name,
      tableName: opts.tableName,
      dbValue: `value`,
      recordId,
      value,
      setValue,
      validUiValue: field.notNull ? `value is not null` : `true`,
      changedUiValue: `case when ${timestampValue} is null then value is not null else value is null or ${timestampValue} != value end`,
      nextCol,
    });
    const editor = state({
      procedure: [scalar(`value`, timestampValue)],
      children: element("input", {
        styles: sharedStyles.cellInput,
        props: {
          value: `case when value is not null then format.date(value, '%Y-%m-%dT%H:%M') else '' end`,
          yolmFocusKey: `true`,
          type: "'datetime-local'",
        },
        on: {
          ...handlers,
          input: [setScalar(`ui.value`, `try_cast(target_value as timestamp)`)],
        },
      }),
    });
    return ifNode(props.editing, editor, display);
  };
}

function numericField(
  opts: BaseFieldCellOpts,
  field: IntegerField | DecimalField | RealField | DoubleField
): Cell {
  let typeName: string;
  switch (field.type) {
    case "TinyInt":
    case "TinyUint":
    case "SmallInt":
      typeName = "smallint";
      break;
    case "SmallUint":
    case "Int":
      typeName = "int";
      break;
    case "BigInt":
    case "BigUint":
    case "Uint":
      typeName = "bigint";
      break;
    case "Decimal":
      typeName = `decimal(${field.precision}, ${field.scale})`;
      break;
    case "Real":
      typeName = "real";
      break;
    case "Double":
      typeName = "double";
      break;
  }
  return (props) => {
    const numberValue = opts.stringified
      ? `try_cast(${props.value} as ${typeName})`
      : props.value;
    let formatted = `format.decimal(${numberValue})`;
    if (field.type === "Decimal" && field.usage) {
      if (field.usage.type === "Money") {
        formatted = `format.currency(${numberValue}, ${stringLiteral(
          field.usage.currency
        )})`;
      } else if (field.usage.type === "Percentage") {
        formatted = `format.percent(${numberValue})`;
      }
    }
    const display = element("span", {
      styles: sharedStyles.ellipsisSpan,
      children: formatted,
    });
    if (opts.immutable) {
      return display;
    }
    const handlers = castEventHandlers(opts, field, props, typeName);
    const editor = state({
      procedure: [
        scalar(
          `value`,
          `coalesce(start_edit_with_char, cast(${props.value} as string))`
        ),
      ],
      children: element("input", {
        styles: sharedStyles.cellInput,
        props: {
          value: `value`,
          yolmFocusKey: `true`,
          type: "'number'",
        },
        on: {
          ...handlers,
          input: [setScalar(`ui.value`, `target_value`)],
        },
      }),
    });
    return ifNode(props.editing, editor, display);
  };
}

function stringCell(opts: BaseFieldCellOpts, field: StringField): Cell {
  return (props) => {
    const display = element("span", {
      styles: sharedStyles.ellipsisSpan,
      children: props.value,
    });
    if (opts.immutable) {
      return display;
    }
    const { value, recordId, setValue, nextCol } = props;
    const handlers = fieldEditorEventHandlers({
      fieldName: field.name,
      tableName: opts.tableName,
      dbValue: `case when value = '' then null else value end`,
      recordId,
      value,
      setValue,
      validUiValue: field.notNull ? `value != ''` : `true`,
      changedUiValue: `(${value} is null and ui.value != '') or ui.value != ${value}`,
      nextCol,
    });
    const editor = state({
      procedure: [scalar(`value`, `coalesce(start_edit_with_char, ${value})`)],
      children: element("input", {
        styles: sharedStyles.cellInput,
        props: { value: `value`, yolmFocusKey: `true`, type: "'text'" },
        on: {
          ...handlers,
          input: [setScalar(`ui.value`, `target_value`)],
        },
      }),
    });
    return ifNode(props.editing, editor, display);
  };
}

function castEventHandlers(
  opts: BaseFieldCellOpts,
  field: FieldBase,
  props: CellProps,
  typeName: string
) {
  const { value, recordId, setValue, nextCol } = props;
  return fieldEditorEventHandlers({
    fieldName: field.name,
    tableName: opts.tableName,
    dbValue: field.notNull
      ? `cast(value as ${typeName})`
      : `try_cast(value as ${typeName})`,
    recordId,
    value,
    setValue,
    validUiValue: field.notNull
      ? `try_cast(value as ${typeName}) is not null`
      : `value = '' or try_cast(value as ${typeName}) is not null`,
    changedUiValue: opts.stringified
      ? `case when ${value} is null then value != '' else ${value} != value end`
      : `case when ${value} is null then value != '' else cast(${value} as string) != value end`,
    nextCol,
    newUiValue: opts.stringified
      ? `case when value = '' then null else value end`
      : `try_cast(value as ${typeName})`,
  });
}

function uuidCell(opts: BaseFieldCellOpts, field: UuidField): Cell {
  return (props) => {
    const display = element("span", {
      styles: sharedStyles.ellipsisSpan,
      children: props.value,
    });
    if (opts.immutable) {
      return display;
    }
    const handlers = castEventHandlers(opts, field, props, "uuid");
    const editor = state({
      procedure: [
        scalar(
          `value`,
          `coalesce(start_edit_with_char, cast(${props.value} as string))`
        ),
      ],
      children: element("input", {
        styles: sharedStyles.cellInput,
        props: { value: `value`, yolmFocusKey: `true`, type: "'text'" },
        on: {
          ...handlers,
          input: [setScalar(`ui.value`, `target_value`)],
        },
      }),
    });
    return ifNode(props.editing, editor, display);
  };
}

function boolCell(opts: BaseFieldCellOpts, field: BoolField): Cell {
  const { enumLike } = field;
  if (enumLike) {
    return (props) => {
      const display = element("span", {
        styles: sharedStyles.ellipsisSpan,
        children: enumLikeDisplayName(
          `try_cast(${props.value} as bool)`,
          enumLike
        ),
      });
      if (opts.immutable) {
        return display;
      }
      const handlers = fieldEditorEventHandlers({
        ...opts,
        fieldName: field.name,
        dbValue: `try_cast(ui.value as bool)`,
        recordId: props.recordId,
        value: props.value,
        setValue: props.setValue,
        validUiValue: `true`,
        changedUiValue: opts.stringified
          ? `case when ${props.value} is null then value is not null else ${props.value} != value end`
          : `case when ${props.value} is null then value is not null else cast(${props.value} as string) != value end`,
        nextCol: props.nextCol,
        newUiValue: opts.stringified
          ? `ui.value`
          : `try_cast(ui.value as bool)`,
      });
      return ifNode(
        props.editing,
        state({
          procedure: [
            scalar(
              `value`,
              opts.stringified
                ? props.value
                : `coalesce(cast(${props.value} as string), '')`
            ),
          ],
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
        display
      );
    };
  }
  return (props) =>
    checkbox({
      styles: styles.checkbox,
      checked: opts.stringified ? props.value + " = 'true'" : props.value,
      variant: "outlined",
      color: "neutral",
      slots: {
        input: {
          props: {
            tabIndex: "-1",
            readOnly: opts.immutable ? "true" : undefined,
          },
        },
      },
      on: {
        checkboxChange: opts.immutable
          ? [preventDefault()]
          : {
              detachedFromNode: true,
              procedure: [
                scalar(`prev_value`, props.value),
                ...props.setValue(
                  opts.stringified
                    ? `cast(target_checked as string)`
                    : `target_checked`
                ),
                ...doEdit({
                  ...opts,
                  fieldName: field.name,
                  dbValue: opts.stringified
                    ? `cast(${props.value} as bool)`
                    : props.value,
                  recordId: props.recordId,
                  resetValue: props.setValue(`prev_value`),
                }),
              ],
            },
      },
    });
}

function durationCell(
  opts: BaseFieldCellOpts,
  field: IntegerField,
  usage: DurationUsage
): Cell {
  if (usage.size === "minutes") {
    return (props) => {
      const bigintValue = opts.stringified
        ? `try_cast(${props.value} as bigint)`
        : props.value;
      const handlers = fieldEditorEventHandlers({
        ...opts,
        fieldName: field.name,
        dbValue: `sfn.parse_minutes_duration(ui.input_value)`,
        recordId: props.recordId,
        value: props.value,
        setValue: props.setValue,
        validUiValue: field.notNull
          ? `sfn.parse_minutes_duration(input_value) is not null`
          : `input_value = '' or sfn.parse_minutes_duration(input_value) is not null`,
        changedUiValue: field.notNull
          ? `${bigintValue} != sfn.parse_minutes_duration(input_value)`
          : `(input_value = '' and ${props.value} is not null) or (input_value != '' and ${props.value} is null) or ${bigintValue} != sfn.parse_minutes_duration(input_value)`,
        nextCol: props.nextCol,
        newUiValue: opts.stringified
          ? `cast(sfn.parse_minutes_duration(input_value) as string)`
          : `sfn.parse_minutes_duration(input_value)`,
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
  throw new Error("Unsupported duration size: " + usage.size);
}

function imageCell(opts: BaseFieldCellOpts, group: ImageSetFieldGroup): Cell {
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
                      catch: displayEditError(`Upload failed`),
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

export interface BaseFieldCellOpts extends FieldEditProcConfig {
  tableName: string;
  stringified: boolean;
  auth?: Authorization;
  immutable?: boolean;
}

export function fieldCell(opts: FieldCellOpts): Cell {
  switch (opts.field.type) {
    case "ForeignKey":
      return foreignKeyCell(opts, opts.field);
    case "Enum":
      return enumCell(opts, opts.field);
    case "Date":
      return dateCell(opts, opts.field);
    case "String":
      return stringCell(opts, opts.field);
    case "Bool":
      return boolCell(opts, opts.field);
    case "TinyInt":
    case "SmallInt":
    case "Int":
    case "BigInt":
    case "TinyUint":
    case "SmallUint":
    case "Uint":
    case "BigUint":
      if ("usage" in opts.field && opts.field.usage?.type === "Duration") {
        return durationCell(opts, opts.field, opts.field.usage);
      }
      return numericField(opts, opts.field);
    case "Decimal":
    case "Double":
    case "Real":
      return numericField(opts, opts.field);
    case "Uuid":
      if (opts.field.group) {
        const table = model.database.tables[opts.tableName];
        const group = table.fieldGroups[opts.field.group];
        if (group.type === "Image") {
          return imageCell(opts, group);
        }
      }
      return uuidCell(opts, opts.field);
    case "Ordering":
    case "Time":
      throw new Error(`${opts.field.name} fields are not supported`);
    case "Timestamp":
      return timestampCell(opts, opts.field);
    case "Tx":
      // not ideal validation, but it's fine for now
      return numericField(opts, {
        type: "BigUint",
        name: opts.field.name,
        displayName: opts.field.displayName,
        checks: [],
        ext: {},
      });
  }
}
