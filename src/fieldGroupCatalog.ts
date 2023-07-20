import { TableBuilder } from "./modelHelpers.js";
import { ImageSetVariant } from "./modelTypes.js";

export interface AddressFieldGroupCatalog {
  type: "address";
  name?: string;
  prefix?: string;
  createFields?: {
    name?: boolean | string;
    street?: boolean | string;
    streetTwo?: boolean | string;
    city?: boolean | string;
    state?: boolean | string;
    country?: boolean | string;
    zip?: boolean | string;
  };
}

function address(opts: AddressFieldGroupCatalog, table: TableBuilder) {
  function createFieldName(
    option: boolean | string | undefined,
    defaultName: string,
    createByDefault: boolean
  ) {
    if (typeof option === "string") {
      return option;
    }
    if (option || createByDefault) {
      return opts.prefix ? opts.prefix + defaultName : defaultName;
    }
  }
  const groupName = opts.name ?? "address";
  const nameField = createFieldName(opts.createFields?.name, "name", false);
  const street1Field = createFieldName(
    opts.createFields?.street,
    "street",
    true
  );
  const street2Field = createFieldName(
    opts.createFields?.streetTwo,
    "street_two",
    false
  );
  const cityField = createFieldName(opts.createFields?.city, "city", true);
  const stateField = createFieldName(opts.createFields?.state, "state", true);
  const countryField = createFieldName(
    opts.createFields?.country,
    "country",
    true
  );
  const zipField = createFieldName(opts.createFields?.zip, "zip", true);
  table.fieldGroup(groupName, {
    type: "Address",
    name: groupName,
    fields: {
      name: nameField,
      city: cityField,
      street1: street1Field!,
      street2: street2Field,
      country: countryField,
      region: stateField,
      zip: zipField,
    },
  });
  if (nameField) {
    table.string(nameField, 100).group(groupName);
  }
  if (street1Field) {
    table.string(street1Field, 80).group(groupName);
  }
  if (street2Field) {
    table.string(street2Field, 80).group(groupName);
  }
  if (cityField) {
    table.string(cityField, 85).group(groupName);
  }
  if (stateField) {
    table.string(stateField, 50).group(groupName);
  }
  if (countryField) {
    table.string(countryField, 60).group(groupName);
  }
  if (zipField) {
    table.string(zipField, 20).group(groupName);
  }
}

export interface RequiredUserTableFields {
  type: "requiredUserFields";
}

function requiredUserFields(_: RequiredUserTableFields, table: TableBuilder) {
  table.uuid(`global_id`).notNull().unique();
  table.bool("disabled").notNull().default("false");
  table.string("email", 320).unique();
}

export interface ImageSet {
  type: "imageSet";
  groupName?: string;
  variants: Record<string, ImageSetVariant>;
}

function imageSet(opts: ImageSet, table: TableBuilder) {
  const groupName = opts.groupName ?? "image";
  table.fieldGroup(groupName, {
    type: "Image",
    name: groupName,
    variants: opts.variants,
  });
  for (const fieldName of Object.keys(opts.variants)) {
    table.uuid(fieldName).group(groupName);
  }
}

export interface SimpleImageSet {
  type: "simpleImageSet";
  groupName?: string;
}

function simpleImageSet(opts: SimpleImageSet, table: TableBuilder) {
  const groupName = opts.groupName ?? "image";
  table.fieldGroup(groupName, {
    type: "Image",
    name: groupName,
    variants: {
      image_full: { quality: 95, usage: "general_full" },
      image_thumb: {
        quality: 80,
        resize: { height: "180", width: "180", type: "'cover'" },
        usage: "square_thumbnail",
      },
    },
  });
  table.uuid("image_full").group(groupName);
  table.uuid("image_thumb").group(groupName);
}

export type FieldGroupCatalog =
  | AddressFieldGroupCatalog
  | RequiredUserTableFields
  | ImageSet
  | SimpleImageSet;

export function applyFieldGroupCatalog(
  catalog: FieldGroupCatalog,
  table: TableBuilder
) {
  switch (catalog.type) {
    case "requiredUserFields": {
      requiredUserFields(catalog, table);
      break;
    }
    case "address": {
      address(catalog, table);
      break;
    }
    case "imageSet": {
      imageSet(catalog, table);
      break;
    }
    case "simpleImageSet": {
      simpleImageSet(catalog, table);
      break;
    }
  }
}
