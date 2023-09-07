import { Field } from "../../app";
import { nodes } from "../../nodeHelpers";
import { app } from "../../app";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import * as yom from "../../yom";
import { fieldCell } from "./cells";
import {
  columnPopover,
  FilterType,
  SortConfig,
  SuperGridColumn,
} from "./styledDatagrid";
import { styles as sharedStyles } from "./styles";
import { SimpleColumn } from "./styledSimpleDatagrid";
import { normalizeCase, upcaseFirst } from "../../utils/inflectors";
import { lazy } from "../../utils/memoize";
import { materialIcon } from "../../components/materialIcon";
import { Style } from "../../styleTypes";
import {
  CellNode,
  FieldEditProcConfig,
  resizeableSeperator,
  dgState,
} from "./shared";
import { BasicStatements, DomStatements } from "../../statements";

function filterTypeFromField(field: Field): FilterType {
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
    case "Tx":
      if ("usage" in field && field.usage) {
        if (field.usage.type === "Duration") {
          if (field.usage.size === "minutes") {
            return { type: "minutes_duration", notNull: field.notNull };
          }
          throw new Error("Only minute durations supported right now");
        }
      }
      return { type: "number", notNull: field.notNull };
    case "String":
    case "Uuid":
      return { type: "string", notNull: field.notNull };
    case "Enum":
      return { type: "enum", enum: field.enum, notNull: field.notNull };
    case "ForeignKey":
      return { type: "table", table: field.table, notNull: field.notNull };
    case "Timestamp":
      return { type: "timestamp", notNull: field.notNull };
    case "Date":
      return { type: "date", notNull: field.notNull };
    case "Bool":
      return field.enumLike
        ? {
            type: "enum_like_bool",
            config: field.enumLike,
            notNull: field.notNull,
          }
        : { type: "bool", notNull: field.notNull };
    case "Time":
    case "Ordering":
      throw new Error("Filter not supported for type: " + field.type);
  }
}

// function filterTypeFromVirtual(type: VirtualType): FilterType {
//   switch (type.type) {
//     case "BigInt":
//     case "Int":
//     case "SmallInt":
//     case "Double":
//     case "Real":
//     case "Decimal":
//       return { type: "number" };
//     case "String":
//     case "Uuid":
//       return { type: "string" };
//     case "Enum":
//       return { type: "enum", enum: type.enum };
//     case "ForeignKey":
//       return { type: "table", table: type.table };
//     case "Timestamp":
//       return { type: "timestamp" };
//     case "Date":
//       return { type: "date" };
//     case "Bool":
//       return { type: "bool" };
//     case "Time":
//     case "Ordering":
//       throw new Error("Ordering fields should not be used in filters");
//   }
// }

function getFieldProcFieldType(field: Field): yom.FieldType {
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
    case "Double":
    case "Ordering":
    case "Real":
    case "Time":
    case "Timestamp":
    case "Uuid":
      return { type: field.type };
    case "Tx":
    case "ForeignKey":
      return { type: "BigUint" };
    case "Enum":
      return { type: "Enum", enum: field.enum };
    case "String":
      return { type: "String", maxLength: field.maxLength };
    case "Decimal":
      return {
        type: "Decimal",
        precision: field.precision,
        scale: field.scale,
        signed: field.signed,
      };
  }
}

function getFieldCellWidth(
  field: Field,
  table: string,
  headerBuffer: number
): number {
  const charSize = 10;
  const cellBuffer = 20;
  const headerLength = field.displayName.length * charSize + headerBuffer;
  if (field.type === "Uuid" && field.group) {
    const tableModel = app.db.tables[table];
    const group = tableModel.fieldGroups[field.group];
    if (group.type === "Image") {
      return 138;
    }
  }
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
  if (field.type === "Enum") {
    const enum_ = app.enums[field.enum];
    const maxVariant = Math.max(
      ...Object.values(enum_.values).map((v) => v.displayName.length)
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

export const editWithCharCellKeydownHandler = new DomStatements()
  .if(`event.key = 'Enter'`, (s) =>
    s
      .modify(
        `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`
      )
      .modify(
        `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`
      )
      .setScalar(`ui.start_edit_with_char`, `null`)
  )
  .if(`char_length(event.key) = 1`, (s) =>
    s
      .modify(
        `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`
      )
      .modify(
        `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`
      )
      .setScalar(`ui.start_edit_with_char`, `event.key`)
  );

export const opaqueCellKeydownHandler = new DomStatements().if(
  `event.key = 'Enter'`,
  (s) =>
    s
      .modify(
        `update ui.focus_state set column = cell.column, row = cell.row, should_focus = false`
      )
      .modify(
        `update ui.editing_state set column = cell.column, row = cell.row, is_editing = true`
      )
      .setScalar(`ui.start_edit_with_char`, `null`)
);

export const dynamicBooleanCellKeydownHandler = (
  col: number,
  sqlName: string,
  tableName: string
) =>
  new DomStatements().if(`event.key = 'Enter'`, (s) =>
    s
      .scalar(
        `row_id`,
        `(select field_0 from ui.dg_table limit 1 offset cell.row - 1)`
      )
      .commitUiChanges()
      .scalar(
        `prev_value`,
        `(select field_${col} from ui.dg_table where field_0 = row_id)`
      )
      .modify(
        `update ui.dg_table set field_${col} = not (field_${col} = 'true') where field_0 = row_id`
      )
      .statements(
        dgState.updateFieldValueInDb({
          dbValue: `(select field_${col} from ui.dg_table where field_0 = row_id) = 'true'`,
          fieldName: sqlName,
          recordId: `cast(row_id as bigint)`,
          tableName,
          resetValue: (s) =>
            s.modify(
              `update ui.dg_table set field_${col} = prev_value where field_0 = row_id`
            ),
        })
      )
  );

export interface SuperColumnFieldOpts extends FieldEditProcConfig {
  table: string;
  field: Field;
  dynIndex: number;
  columnIndex: number;
  startFixedColumns: number;
  immutable?: boolean | yom.SqlExpression;
}

export function columnFromField({
  table,
  field,
  dynIndex,
  columnIndex,
  startFixedColumns,
  immutable,
  ...restOpts
}: SuperColumnFieldOpts): SuperGridColumn | undefined {
  let keydownHandler = new DomStatements();
  let noFilter = false;
  let noSort = false;
  let displayName = field.displayName;
  if (field.type === "Ordering" || field.type === "Time") {
    return;
  }
  if (!immutable) {
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
      case "ForeignKey":
      case "Tx":
        keydownHandler = editWithCharCellKeydownHandler;
        break;
      case "Timestamp":
      case "Date":
      case "Enum":
        keydownHandler = opaqueCellKeydownHandler;
        break;
      case "Uuid":
        if (field.group) {
          const tableModel = app.db.tables[table];
          const group = tableModel.fieldGroups[field.group];
          if (group.type === "Image") {
            if (group.variants[field.name].usage !== "square_thumbnail") {
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
          : dynamicBooleanCellKeydownHandler(dynIndex, field.name, table);
        break;
    }
  }
  let sort: SortConfig | undefined;
  if (!noSort) {
    switch (field.type) {
      case "Date":
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
      case "Timestamp":
        sort = { type: "numeric", displayName };
        break;
      case "String":
        sort = { type: "string", displayName };
        break;
      case "Bool":
        if (field.enumLike) {
          const high = field.enumLike.true;
          const low = field.enumLike.false;
          const ascText = `${low} → ${high}`;
          const descText = `${high} → ${low}`;
          sort = {
            type: "custom",
            displayName,
            ascText,
            descText,
            ascNode: stringLiteral(ascText),
            descNode: stringLiteral(descText),
          };
        } else {
          sort = { type: "checkbox", displayName };
        }
        break;
    }
  }
  return {
    columnsDisplayName: displayName,
    filterDisplayName: !noFilter ? displayName : undefined,
    filterOptGroup: "Field",
    keydownCellHandler: keydownHandler,
    filter: !noFilter ? filterTypeFromField(field) : undefined,
    sort,
    displayInfo: {
      cell: fieldCell({
        ...restOpts,
        immutable,
        tableName: table,
        field,
        stringified: true,
      }),
      initiallyDisplaying: true,
      initialWidth: getFieldCellWidth(field, table, 46),
      header: (state) => [
        nodes.element("span", {
          styles: sharedStyles.headerText,
          children: stringLiteral(displayName),
        }),
        columnPopover(state, columnIndex, startFixedColumns, sort),
        resizeableSeperator({
          minWidth: 50,
          setWidth: (width) =>
            new BasicStatements().modify(
              `update ui.column set width = ${width} where id = ${columnIndex}`
            ),
          width: `(select width from ui.column where id = ${columnIndex})`,
        }),
      ],
    },
    queryGeneration: {
      expr: `record.${ident(field.name)}`,
      alwaysGenerate: true,
    },
    viewStorageName: field.name,
  };
}

export const simpleBooleanCellKeydownHandler = (
  fieldName: string,
  idField: string,
  tableName: string
) =>
  new DomStatements().if(`event.key = 'Enter'`, (s) =>
    s
      .scalar(
        `row_id`,
        `(select ${idField} from ui.dg_table limit 1 offset cell.row - 1)`
      )
      .commitUiChanges()
      .scalar(
        `prev_value`,
        `(select ${fieldName} from ui.dg_table where ${idField} = row_id)`
      )
      .modify(
        `update ui.dg_table set ${fieldName} = not ${fieldName} where ${idField} = row_id`
      )
      .statements(
        dgState.updateFieldValueInDb({
          dbValue: `(select ${fieldName} from ui.dg_table where ${idField} = row_id)`,
          fieldName: fieldName,
          recordId: `row_id`,
          tableName,
          resetValue: (s) =>
            s.modify(
              `update ui.dg_table set ${fieldName} = prev_value where ${idField} = row_id`
            ),
        })
      )
  );

export interface SimpleColumnFieldOpts extends FieldEditProcConfig {
  table: string;
  field: Field;
  idField: string;
  columnIndex: number;
  immutable?: boolean | yom.SqlExpression;
}

export function simpleToggleColumnSort(columnIndex: number) {
  return new DomStatements().if({
    condition: `sort_info.col = ${columnIndex}`,
    then: (s) =>
      s.if({
        condition: `sort_info.ascending`,
        then: (s) => s.modify(`update sort_info set ascending = false`),
        else: (s) => s.modify(`update sort_info set col = null`),
      }),
    else: (s) =>
      s.modify(`update sort_info set col = ${columnIndex}, ascending = true`),
  });
}

export function simpleColumnFromField({
  field,
  table,
  idField,
  columnIndex,
  immutable,
  ...restOpts
}: SimpleColumnFieldOpts): SimpleColumn | undefined {
  let keydownHandler = new DomStatements();
  let displayName = field.displayName;
  if (field.type === "Ordering" || field.type === "Time") {
    return;
  }
  if (!immutable) {
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
      case "ForeignKey":
      case "Tx":
        keydownHandler = editWithCharCellKeydownHandler;
        break;
      case "Date":
      case "Timestamp":
      case "Enum":
        keydownHandler = opaqueCellKeydownHandler;
        break;
      case "Bool":
        keydownHandler = field.enumLike
          ? opaqueCellKeydownHandler
          : simpleBooleanCellKeydownHandler(field.name, idField, table);
        break;
      case "Uuid":
        if (field.group) {
          const tableModel = app.db.tables[table];
          const group = tableModel.fieldGroups[field.group];
          if (group.type === "Image") {
            if (group.variants[field.name].usage !== "square_thumbnail") {
              return;
            }
            displayName = upcaseFirst(normalizeCase(field.group).join(" "));
          }
        }
        keydownHandler = opaqueCellKeydownHandler;
        break;
    }
  }
  const toggleColumnSort = simpleToggleColumnSort(columnIndex);
  return {
    keydownCellHandler: keydownHandler,
    cell: fieldCell({
      ...restOpts,
      tableName: table,
      field,
      stringified: false,
      immutable,
    }),
    width: getFieldCellWidth(field, table, 10),
    header: [
      nodes.element("span", {
        styles: sharedStyles.headerText,
        children: stringLiteral(displayName),
      }),
      nodes.switch(
        {
          condition: `sort_info.col = ${columnIndex} and sort_info.ascending`,
          node: materialIcon("ArrowUpward"),
        },
        {
          condition: `sort_info.col = ${columnIndex} and not sort_info.ascending`,
          node: materialIcon("ArrowDownward"),
        }
      ),
      resizeableSeperator({
        minWidth: 50,
        setWidth: (width) =>
          new BasicStatements().modify(
            `update ui.column_width set width = ${width} where col = ${columnIndex}`
          ),
        width: `(select width from ui.column_width where col = ${columnIndex})`,
      }),
    ],
    keydownHeaderHandler: (s) =>
      s.if(`event.key = 'Enter'`, (s) =>
        s.statements(toggleColumnSort, dgState.triggerRefresh)
      ),
    headerClickHandler: (s) =>
      s.statements(toggleColumnSort, dgState.triggerRefresh),
    queryGeneration: {
      expr: `record.${ident(field.name)}`,
      sqlName: field.name,
      alwaysGenerate: true,
      procFieldType: getFieldProcFieldType(field),
    },
  };
}
