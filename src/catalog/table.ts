import { ImageSetVariant } from "../system";
import { TableBuilder } from "../publicTypes";

export class TableCatalog {
  #table: TableBuilder;

  constructor(builder: TableBuilder) {
    this.#table = builder;
  }

  /**
   * Adds the fields that are required on the `user` table for our integrated authentication
   * system.
   */
  requiredUserFields() {
    this.#table.uuid(`global_id`).notNull().unique();
    this.#table.string("email", 320).unique();
  }

  /**
   * Adds fields which represents an address.
   *
   * Integrates with addressCard and addressesCards.
   */
  addressFields(opts: AddressFieldGroupOpts = {}) {
    function createFieldName(
      option: boolean | string | undefined,
      defaultName: string,
      createByDefault: boolean,
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
      true,
    );
    const street2Field = createFieldName(
      opts.createFields?.streetTwo,
      "street_two",
      false,
    );
    const cityField = createFieldName(opts.createFields?.city, "city", true);
    const stateField = createFieldName(opts.createFields?.state, "state", true);
    const countryField = createFieldName(
      opts.createFields?.country,
      "country",
      true,
    );
    const zipField = createFieldName(opts.createFields?.zip, "zip", true);
    this.#table.fieldGroup(groupName, {
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
      this.#table.string(nameField, 100).group(groupName);
    }
    if (street1Field) {
      this.#table.string(street1Field, 80).group(groupName);
    }
    if (street2Field) {
      this.#table.string(street2Field, 80).group(groupName);
    }
    if (cityField) {
      this.#table.string(cityField, 85).group(groupName);
    }
    if (stateField) {
      this.#table.string(stateField, 50).group(groupName);
    }
    if (countryField) {
      this.#table.string(countryField, 60).group(groupName);
    }
    if (zipField) {
      this.#table.string(zipField, 20).group(groupName);
    }
  }

  imageSet(opts: ImageSetOpts) {
    const groupName = opts.groupName ?? "image";
    this.#table.fieldGroup(groupName, {
      type: "Image",
      name: groupName,
      variants: opts.variants,
    });
    for (const fieldName of Object.keys(opts.variants)) {
      this.#table.uuid(fieldName).group(groupName);
    }
  }

  /**
   * Adds a field group of two fields that integrates with the datagrid and record grid page header.
   *
   * Creates a field group with the following fields:
   * image_full: uuid
   * image_thumb: uuid
   */
  simpleImageSet(groupName = "image") {
    this.#table.fieldGroup(groupName, {
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
    this.#table.uuid("image_full").group(groupName);
    this.#table.uuid("image_thumb").group(groupName);
  }
}

export interface AddressFieldGroupOpts {
  /**
   * Name of the field group. Defaults to `address`.
   */
  name?: string;
  /**
   * Add a prefix to all the fields in the group.
   * Useful if you want to add multiple address field groups to a table.
   * For example: billing_, shipping_, etc.
   */
  prefix?: string;
  /**
   * Control which fields are created
   */
  createFields?: {
    /**
     * Address name field, not the street, but the name of the company or person at the address.
     * @default false
     */
    name?: boolean | string;
    /**
     * Street address line 1 (often all that is neede), name is street by default
     * @default true
     */
    street?: boolean | string;
    /**
     * Street address line 2, name is street_two by default
     * @default false
     */
    streetTwo?: boolean | string;
    /**
     * City, name is city by default
     * @default true
     */
    city?: boolean | string;
    /**
     * State, name is state by default
     * @default true
     */
    state?: boolean | string;
    /**
     * Country, name is country by default
     * @default true
     */
    country?: boolean | string;
    /**
     * Zip code/Postal code, name is zip by default
     * @default true
     */
    zip?: boolean | string;
  };
}

export interface ImageSetOpts {
  groupName?: string;
  variants: Record<string, ImageSetVariant>;
}
