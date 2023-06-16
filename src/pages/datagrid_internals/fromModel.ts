import { Field, VirtualField, VirtualType } from "../../modelTypes.js";
import { element } from "../../nodeHelpers.js";
import {
  commitUiChanges,
  if_,
  modify,
  scalar,
  setScalar,
} from "../../procHelpers.js";
import { model } from "../../singleton.js";
import { ident, stringLiteral } from "../../utils/sqlHelpers.js";
import {
  ClientProcStatement,
  FieldType,
  ServiceProcStatement,
} from "../../yom.js";
import { fieldCell } from "./cells.js";
import { BeforeEditTransaction, doEdit } from "./editHelper.js";
import {
  columnPopover,
  FilterType,
  seperator,
  SuperGridColumn,
} from "./superGrid.js";
import { styles as sharedStyles } from "./styles.js";
import { SimpleColumn } from "./simpleDatagrid.js";
import { normalizeCase, upcaseFirst } from "../../utils/inflectors.js";

export function filterTypeFromField(type: Field): FilterType {
  switch (type.type) {
    case "BigInt":
    case "BigUint":
    case "Int":
    case "Uint":
    case "SmallInt":
    case "SmallUint":
    case "TinyInt":
    case "TinyUint":
    case "Double":
    case "Real":
    case "Decimal":
      return { type: "number" };
    case "Duration":
      if (type.size !== "minutes") {
        throw new Error("Only minute durations supported right now");
      }
      return { type: "duration", size: "minutes" };
    case "String":
      return { type: "string" };
    case "Enum":
      return { type: "enum", enum: type.enum };
    case "ForeignKey":
      return { type: "table", table: type.table };
    case "Date":
      // case "Timestamp":
      return { type: "date" };
    case "Bool":
      return type.enumLike
        ? { type: "enum_like_bool", config: type.enumLike }
        : { type: "bool" };
    default:
      throw new Error("Todo filter type for " + type.type);
  }
}

export function filterTypeFromVirtual(type: VirtualType): FilterType {
  switch (type.type) {
    case "BigInt":
    case "Int":
    case "SmallInt":
    case "Double":
    case "Real":
    case "Decimal":
      return { type: "number" };
    case "String":
      return { type: "string" };
    case "Enum":
      return { type: "enum", enum: type.enum };
    case "ForeignKey":
      return { type: "table", table: type.table };
    case "Date":
      // case "Timestamp":
      return { type: "date" };
    case "Bool":
      return { type: "bool" };

    default:
      throw new Error("Todo");
  }
}

export function getFieldProcFieldType(field: Field): FieldType {
  switch (field.type) {
    case "TinyInt":
    case "SmallInt":
    case "Int":
    case "BigInt":
    case "TinyUint":
    case "SmallUint":
    case "Uint":
    case "BigUint":
    case "Bool":
    case "Date":
    case "Date":
      return { type: field.type };
    case "ForeignKey":
      return { type: "BigUint" };
    case "Enum":
      return { type: "Enum", enum: field.enum };
    case "Duration":
      return { type: field.backing };
    case "String":
      return { type: "String", maxLength: field.maxLength };
    default:
      throw new Error("todo");
  }
}

export function getVirtualProcFieldType(virtual: VirtualField): FieldType {
  switch (virtual.type.type) {
    case "SmallInt":
    case "Int":
    case "BigInt":
    case "Bool":
    case "Date":
    case "Date":
      return { type: virtual.type.type };
    case "ForeignKey":
      return { type: "BigUint" };
    case "Enum":
      return { type: "Enum", enum: virtual.type.enum };
    case "String":
      return { type: "String", maxLength: 65_000 };
    default:
      throw new Error("todo");
  }
}

export function getFieldCellWidth(field: Field): number {
  const charSize = 9;
  const headerBuffer = 46;
  const cellBuffer = 20;
  const headerLength = field.name.displayName.length * charSize + headerBuffer;
  if (field.type === "Bool") {
    if (field.enumLike) {
      const maxValue = Math.max(
        field.enumLike.true.length,
        field.enumLike.false.length,
        (field.enumLike.null ?? "Unspecified").length
      );
      const maxValueLength = maxValue * charSize + cellBuffer;
      return Math.max(maxValueLength, headerLength);
    }
    return headerLength;
  }
  if (field.type === "Duration") {
    if (field.size === "minutes") {
      return Math.max(150, headerLength);
    }
  }
  if (field.type === "Enum") {
    const enum_ = model.enums[field.enum];
    const maxVariant = Math.max(
      ...enum_.values.map((v) => v.name.displayName.length)
    );
    const maxVariantTotal = maxVariant * charSize + headerBuffer;
    return Math.max(maxVariantTotal, headerLength);
  }
  if (field.type === "Date") {
    return Math.max(120, headerLength);
  }
  if (field.type === "String") {
    return Math.min(250, Math.max(field.maxLength * charSize, headerLength));
  }
  return 250;
}

export const editWithCharCellKeydownHandler = [
  if_(`event.key = 'Enter'`, [
    modify(
      `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`
    ),
    modify(
      `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`
    ),
    setScalar(`ui.start_edit_with_char`, `null`),
  ]),
  if_(`char_length(event.key) = 1`, [
    modify(
      `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`
    ),
    modify(
      `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`
    ),
    setScalar(`ui.start_edit_with_char`, `event.key`),
  ]),
];

export const opaqueCellKeydownHandler = [
  if_(`event.key = 'Enter'`, [
    modify(
      `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`
    ),
    modify(
      `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`
    ),
    setScalar(`ui.start_edit_with_char`, `null`),
  ]),
];

export const dynamicBooleanCellKeydownHandler = (
  col: number,
  sqlName: string,
  tableName: string
) => [
  if_(`event.key = 'Enter'`, [
    scalar(
      `row_id`,
      `(select field_0 from ui.dg_table limit 1 offset cell.row - 1)`
    ),
    commitUiChanges(),
    scalar(
      `prev_value`,
      `(select field_${col} from ui.dg_table where field_0 = row_id)`
    ),
    modify(
      `update ui.dg_table set field_${col} = not (field_${col} = 'true') where field_0 = row_id`
    ),
    ...doEdit({
      dbValue: `(select field_${col} from ui.dg_table where field_0 = row_id) = 'true'`,
      fieldName: sqlName,
      recordId: `cast(row_id as bigint)`,
      tableName,
      resetValue: [
        modify(
          `update ui.dg_table set field_${col} = prev_value where field_0 = row_id`
        ),
      ],
    }),
  ]),
];

export function columnFromField(
  table: string,
  field: Field,
  dynIndex: number,
  columnIndex: number,
  startFixedColumns: number
): SuperGridColumn | undefined {
  let keydownHandler: ClientProcStatement[] = [];
  let noFilter = false;
  let noSort = false;
  let displayName = field.name.displayName;
  switch (field.type) {
    case "BigInt":
    case "BigUint":
    case "Int":
    case "Uint":
    case "SmallInt":
    case "SmallUint":
    case "TinyInt":
    case "TinyUint":
    case "Double":
    case "Real":
    case "Decimal":
    case "String":
    case "Duration":
    case "ForeignKey":
    case "Date":
      keydownHandler = editWithCharCellKeydownHandler;
      break;
    case "Enum":
      keydownHandler = opaqueCellKeydownHandler;
      break;
    case "Uuid":
      if (field.group) {
        const tableModel = model.database.tables[table];
        const group = tableModel.fieldGroups[field.group];
        if (group.type === "Image") {
          if (group.variants[field.name.name].usage !== "square_thumbnail") {
            return;
          }
          noFilter = true;
          noSort = true;
          displayName = upcaseFirst(normalizeCase(field.group).join(" "));
        }
      }
      keydownHandler = opaqueCellKeydownHandler;
      break;
    case "Bool":
      keydownHandler = field.enumLike
        ? opaqueCellKeydownHandler
        : dynamicBooleanCellKeydownHandler(dynIndex, field.name.name, table);
      break;
    default:
      throw new Error(
        "Haven't implemented field type " +
          field.type +
          " on " +
          field.name.name +
          " yet"
      );
  }
  return {
    displayName,
    keydownCellHandler: keydownHandler,
    filter: !noFilter
      ? {
          type: filterTypeFromField(field),
          notNull: field.notNull ?? false,
        }
      : undefined,
    sort: !noSort ? { ascNode: `'A → Z'`, descNode: `'Z → A'` } : undefined,
    cell: fieldCell({ tableName: table, field, stringified: true }),
    initiallyDisplaying: true,
    initialWidth: getFieldCellWidth(field),
    header: [
      element("span", {
        styles: sharedStyles.headerText,
        children: stringLiteral(displayName),
      }),
      columnPopover(columnIndex, startFixedColumns),
      seperator(columnIndex, 50),
    ],
    queryGeneration: {
      expr: `record.${ident(field.name.name)}`,
      sqlName: field.name.name,
      alwaysGenerate: true,
    },
    viewStorageName: field.name.name,
  };
}

export function columnFromVirtual(
  table: string,
  virtual: VirtualField,
  columnIndex: number,
  startFixedColumns: number
): SuperGridColumn {
  return {
    displayName: virtual.name.displayName,
    filter: {
      type: filterTypeFromVirtual(virtual.type),
      notNull: false,
    },
    sort: { ascNode: `'A → Z'`, descNode: `'Z → A'` },
    cell: ({ value }) => value,
    initiallyDisplaying: true,
    initialWidth: 250,
    header: [
      element("span", {
        styles: sharedStyles.headerText,
        children: stringLiteral(virtual.name.displayName),
      }),
      columnPopover(columnIndex, startFixedColumns),
      seperator(columnIndex, 50),
    ],
    queryGeneration: {
      expr: virtual.expr(...virtual.fields.map((f) => `record.${ident(f)}`)),
      sqlName: virtual.name.name,
      alwaysGenerate: false,
    },
    viewStorageName: virtual.name.name,
  };
}

export const simpleBooleanCellKeydownHandler = (
  fieldName: string,
  idField: string,
  tableName: string
) => [
  if_(`event.key = 'Enter'`, [
    scalar(
      `row_id`,
      `(select ${idField} from ui.dg_table limit 1 offset cell.row - 1)`
    ),
    commitUiChanges(),
    scalar(
      `prev_value`,
      `(select ${fieldName} from ui.dg_table where ${idField} = row_id)`
    ),
    modify(
      `update ui.dg_table set ${fieldName} = not ${fieldName} where ${idField} = row_id`
    ),
    ...doEdit({
      dbValue: `(select ${fieldName} from ui.dg_table where ${idField} = row_id)`,
      fieldName: fieldName,
      recordId: `row_id`,
      tableName,
      resetValue: [
        modify(
          `update ui.dg_table set ${fieldName} = prev_value where ${idField} = row_id`
        ),
      ],
    }),
  ]),
];

export interface SimpleColumnFieldOpts {
  table: string;
  field: Field;
  idField: string;
  beforeEditTransaction?: BeforeEditTransaction;
}

export function simpleColumnFromField({
  field,
  table,
  idField,
  beforeEditTransaction,
}: SimpleColumnFieldOpts): SimpleColumn {
  let keydownHandler: ClientProcStatement[] = [];
  switch (field.type) {
    case "BigInt":
    case "BigUint":
    case "Int":
    case "Uint":
    case "SmallInt":
    case "SmallUint":
    case "TinyInt":
    case "TinyUint":
    case "Double":
    case "Real":
    case "Decimal":
    case "String":
    case "Duration":
    case "ForeignKey":
    case "Date":
      keydownHandler = editWithCharCellKeydownHandler;
      break;
    case "Enum":
      keydownHandler = opaqueCellKeydownHandler;
      break;
    case "Bool":
      keydownHandler = field.enumLike
        ? opaqueCellKeydownHandler
        : simpleBooleanCellKeydownHandler(field.name.name, idField, table);
      break;
    default:
      throw new Error("Todo");
  }
  return {
    displayName: field.name.displayName,
    keydownCellHandler: keydownHandler,
    cell: fieldCell({
      tableName: table,
      field,
      stringified: false,
      beforeEditTransaction,
    }),
    width: getFieldCellWidth(field),
    header: element("span", {
      styles: sharedStyles.headerText,
      children: stringLiteral(field.name.displayName),
    }),
    queryGeneration: {
      expr: `record.${ident(field.name.name)}`,
      sqlName: field.name.name,
      alwaysGenerate: true,
      procFieldType: getFieldProcFieldType(field),
    },
  };
}

export function simpleColumnFromVirtual(
  table: string,
  virtual: VirtualField,
  columnIndex: number,
  startFixedColumns: number
): SimpleColumn {
  return {
    displayName: virtual.name.displayName,
    cell: ({ value }) => value,
    width: 250,
    header: [
      element("span", {
        styles: sharedStyles.headerText,
        children: stringLiteral(virtual.name.displayName),
      }),
      columnPopover(columnIndex, startFixedColumns),
      seperator(columnIndex, 50),
    ],
    queryGeneration: {
      expr: virtual.expr(...virtual.fields.map((f) => `record.${ident(f)}`)),
      sqlName: virtual.name.name,
      alwaysGenerate: false,
      procFieldType: getVirtualProcFieldType(virtual),
    },
  };
}
