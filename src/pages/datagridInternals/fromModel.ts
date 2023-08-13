import { Field, VirtualField, VirtualType } from "../../app";
import { nodes } from "../../nodeHelpers";
import { app } from "../../app";
import { ident, stringLiteral } from "../../utils/sqlHelpers";
import * as yom from "../../yom";
import { fieldCell } from "./cells";
import { FieldEditProcConfig, doEdit } from "./editHelper";
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
import { triggerQueryRefresh, resizeableSeperator } from "./shared";
import { Cell } from "./types";
import { BasicStatements, DomStatements } from "../../statements";

function filterTypeFromField(type: Field): FilterType {
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
    case "Tx":
      if ("usage" in type && type.usage) {
        if (type.usage.type === "Duration") {
          if (type.usage.size === "minutes") {
            return { type: "duration", size: "minutes" };
          }
          throw new Error("Only minute durations supported right now");
        }
      }
      return { type: "number" };
    case "String":
    case "Uuid":
      return { type: "string" };
    case "Enum":
      return { type: "enum", enum: type.enum };
    case "ForeignKey":
      return { type: "table", table: type.table };
    case "Timestamp":
      return { type: "timestamp" };
    case "Date":
      return { type: "date" };
    case "Bool":
      return type.enumLike
        ? { type: "enum_like_bool", config: type.enumLike }
        : { type: "bool" };
    case "Time":
    case "Ordering":
      throw new Error("Filter not supported for type: " + type.type);
  }
}

function filterTypeFromVirtual(type: VirtualType): FilterType {
  switch (type.type) {
    case "BigInt":
    case "Int":
    case "SmallInt":
    case "Double":
    case "Real":
    case "Decimal":
      return { type: "number" };
    case "String":
    case "Uuid":
      return { type: "string" };
    case "Enum":
      return { type: "enum", enum: type.enum };
    case "ForeignKey":
      return { type: "table", table: type.table };
    case "Timestamp":
      return { type: "timestamp" };
    case "Date":
      return { type: "date" };
    case "Bool":
      return { type: "bool" };
    case "Time":
    case "Ordering":
      throw new Error("Ordering fields should not be used in filters");
  }
}

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

function getVirtualProcFieldType(virtual: VirtualField): yom.FieldType {
  switch (virtual.type.type) {
    case "SmallInt":
    case "Int":
    case "BigInt":
    case "Bool":
    case "Date":
    case "Double":
    case "Real":
    case "Time":
    case "Timestamp":
    case "Ordering":
    case "Uuid":
      return { type: virtual.type.type };
    case "ForeignKey":
      return { type: "BigUint" };
    case "Enum":
      return { type: "Enum", enum: virtual.type.enum };
    case "String":
      return { type: "String", maxLength: 65_000 };
    case "Decimal":
      return {
        type: "Decimal",
        precision: virtual.type.precision,
        scale: virtual.type.scale,
        signed: true,
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
        doEdit({
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

const stringSortConfig: SortConfig = {
  ascNode: `'A → Z'`,
  descNode: `'Z → A'`,
  ascText: `A → Z`,
  descText: `Z → A`,
};
const numberSortConfig: SortConfig = {
  ascNode: `'1 → 9'`,
  descNode: `'9 → 1'`,
  ascText: `1 → 9`,
  descText: `9 → 1`,
};
const checkboxSortConfig = lazy((): SortConfig => {
  const styles: Style = { ml: 1, display: "inline-flex" };
  return {
    ascNode: nodes.element("span", {
      styles,
      children: [
        materialIcon("CheckBoxOutlined"),
        `' → '`,
        materialIcon("CheckBoxOutlineBlank"),
      ],
    }),
    descNode: nodes.element("span", {
      styles,
      children: [
        materialIcon("CheckBoxOutlineBlank"),
        `' → '`,
        materialIcon("CheckBoxOutlined"),
      ],
    }),
    ascText: `☐ → ✓`,
    descText: `✓ → ☐`,
  };
});

export interface SuperColumnFieldOpts extends FieldEditProcConfig {
  table: string;
  field: Field;
  dynIndex: number;
  columnIndex: number;
  startFixedColumns: number;
  immutable?: boolean;
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
        sort = numberSortConfig;
        break;
      case "String":
        sort = stringSortConfig;
        break;
      case "Bool":
        if (field.enumLike) {
          const high = field.enumLike.true;
          const low = field.enumLike.false;
          const ascText = `${low} → ${high}`;
          const descText = `${high} → ${low}`;
          sort = {
            ascText,
            descText,
            ascNode: stringLiteral(ascText),
            descNode: stringLiteral(descText),
          };
        } else {
          sort = checkboxSortConfig();
        }
        break;
    }
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
    sort,
    cell: fieldCell({
      ...restOpts,
      immutable,
      tableName: table,
      field,
      stringified: true,
    }),
    initiallyDisplaying: true,
    initialWidth: getFieldCellWidth(field, table, 46),
    header: [
      nodes.element("span", {
        styles: sharedStyles.headerText,
        children: stringLiteral(displayName),
      }),
      columnPopover(columnIndex, startFixedColumns, sort),
      resizeableSeperator({
        minWidth: 50,
        setWidth: (width) =>
          new BasicStatements().modify(
            `update ui.column set width = ${width} where id = ${columnIndex}`
          ),
        width: `(select width from ui.column where id = ${columnIndex})`,
      }),
    ],
    queryGeneration: {
      expr: `record.${ident(field.name)}`,
      sqlName: field.name,
      alwaysGenerate: true,
    },
    viewStorageName: field.name,
  };
}

export function columnFromVirtual(
  table: string,
  virtual: VirtualField,
  columnIndex: number,
  startFixedColumns: number
): SuperGridColumn {
  let sort: SortConfig | undefined;
  let cell: Cell | undefined;
  switch (virtual.type.type) {
    case "BigInt":
    case "Int":
    case "SmallInt":
      if (virtual.type.usage && virtual.type.usage.type === "Duration") {
        cell = ({ value }) =>
          `sfn.display_minutes_duration(try_cast(${value} as bigint))`;
      }
      sort = numberSortConfig;
      break;
    case "Date":
    case "Double":
    case "Real":
    case "Decimal":
      sort = numberSortConfig;
      break;
    case "String":
      sort = stringSortConfig;
      break;
    case "Bool":
      sort = checkboxSortConfig();
      break;
  }
  return {
    displayName: virtual.displayName,
    filter: {
      type: filterTypeFromVirtual(virtual.type),
      notNull: false,
    },
    sort,
    cell: cell ?? (({ value }) => value),
    initiallyDisplaying: true,
    initialWidth: 250,
    header: [
      nodes.element("span", {
        styles: sharedStyles.headerText,
        children: stringLiteral(virtual.displayName),
      }),
      columnPopover(columnIndex, startFixedColumns, sort),
      resizeableSeperator({
        minWidth: 50,
        setWidth: (width) =>
          new BasicStatements().modify(
            `update ui.column set width = ${width} where id = ${columnIndex}`
          ),
        width: `(select width from ui.column where id = ${columnIndex})`,
      }),
    ],
    queryGeneration: {
      expr: virtual.expr(...virtual.fields.map((f) => `record.${ident(f)}`)),
      sqlName: virtual.name,
      alwaysGenerate: false,
    },
    viewStorageName: virtual.name,
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
        doEdit({
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
  immutable?: boolean;
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
  const toggleColumnSort = new DomStatements().if({
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
        s.statements(toggleColumnSort, triggerQueryRefresh())
      ),
    headerClickHandler: (s) =>
      s.statements(toggleColumnSort, triggerQueryRefresh()),
    queryGeneration: {
      expr: `record.${ident(field.name)}`,
      sqlName: field.name,
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
  const toggleColumnSort = new DomStatements().if({
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
  return {
    cell: ({ value }) => value,
    width: 250,
    keydownHeaderHandler: (s) =>
      s.if(
        `event.key = 'Enter'`,
        s.statements(toggleColumnSort, triggerQueryRefresh())
      ),
    headerClickHandler: (s) =>
      s.statements(toggleColumnSort, triggerQueryRefresh()),
    header: [
      nodes.element("span", {
        styles: sharedStyles.headerText,
        children: stringLiteral(virtual.displayName),
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
    queryGeneration: {
      expr: virtual.expr(...virtual.fields.map((f) => `record.${ident(f)}`)),
      sqlName: virtual.name,
      alwaysGenerate: false,
      procFieldType: getVirtualProcFieldType(virtual),
    },
  };
}
