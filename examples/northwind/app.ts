import { addEnum, addTable } from "@yolm/boost/modelHelpers";
import { navbar } from "@yolm/boost/shells/navbar";
import {
  commitUiChanges,
  if_,
  modify,
  navigate,
  record,
  scalar,
  serviceProc,
  setScalar,
  spawn,
} from "@yolm/boost/procHelpers";
import { tableSuperGrid } from "@yolm/boost/pages/tableSuperGrid";
import { adminPage } from "@yolm/boost/pages/admin";
import { recordGridPage } from "@yolm/boost/pages/recordGrid";
import { tableSimpleGrid } from "@yolm/boost/pages/tableSimpleDatagrid";
import { insertFormPage } from "@yolm/boost/pages/insertForm";
import { model } from "@yolm/boost/singleton";

model.name = "northwind";

//
// DATABASE
//

addTable("employee", (table) => {
  table.fieldGroupFromCatalog({ type: "requiredUserFields" });
  table.string("first_name", 10).notNull();
  table.string("last_name", 20).notNull();
  table.string("title", 30);
  table.string("title_of_courtesy", 30);
  table.fk("reports_to", "employee");
  table.date("birth_date");
  table.date("hire_date");
  table.fieldGroupFromCatalog({
    type: "address",
    createFields: { street1: "address" },
  });
  table.string("home_phone", 24);
  table.string("Extension", 4);
  table.fieldGroupFromCatalog({ type: "simpleImageSet" });
  table.string("notes", 2000);

  table.check({
    fields: ["birth_date"],
    check: ([birthDate]) => `${birthDate} < today()`,
    errorMessage: () => "'birth_date must be less than today'",
  });
  table.linkable();
});

addEnum({
  name: "role",
  values: ["sys_admin"],
  withDisplayDt: true,
});

addTable("employee_role", (table) => {
  table.fk("employee").notNull();
  table.enum("role").notNull();
  table.unique(["employee", "role"]);
});

model.database.userTableName = "employee";
model.database.userRoleTableName = "employee_role";

addTable("category", (table) => {
  table.string("name", 15).notNull();
  table.string("description", 2000);
  table.uuid("picture");
  table.setFormControl("Select");
});

addTable("customer", (table) => {
  table.string("company_name", 40).notNull();
  table.string("contact_name", 30);
  table.string("contact_title", 30);
  table.fieldGroupFromCatalog({
    type: "address",
    createFields: { street1: "address" },
  });
  table.string("phone", 24);
  table.string("fax", 24);

  table.recordDisplayName(["company_name"], (name) => name);
  table.linkable();

  table.searchConfig({
    fields: [
      { field: `company_name`, priority: 1 },
      {
        field: `contact_name`,
        priority: 1,
      },
    ],
  });
});

addTable("shipper", (table) => {
  table.string("name", 40).notNull();
  table.string("phone", 24);
  table.setFormControl("Select");
});

addTable("supplier", (table) => {
  table.string("company_name", 40).notNull();
  table.string("contact_name", 30);
  table.string("contact_title", 30);
  table.fieldGroupFromCatalog({
    type: "address",
    createFields: { street1: "address" },
  });
  table.string("phone", 24);
  table.string("fax", 24);
  table.string("home_page", 2000);

  table.recordDisplayName(["company_name"], (name) => name);
  table.linkable();

  table.searchConfig({
    fields: [
      { field: `company_name`, priority: 1 },
      {
        field: `contact_name`,
        priority: 1,
      },
    ],
  });
});

addTable("order", (table) => {
  table.fk("customer");
  table.fk("employee");
  table.date("order_date");
  table.date("required_date");
  table.date("shipped_date");
  table.fk("ship_via", "shipper");
  table
    .decimal("freight", { precision: 10, scale: 2, signed: false })
    .default("0");
  table.fieldGroupFromCatalog({
    type: "address",
    name: "ship_address",
    prefix: "ship_",
    createFields: { street1: "ship_address", name: "ship_name" },
  });
});

addTable("product", (table) => {
  table.string("name", 40).notNull();
  table.fk("supplier");
  table.fk("category");
  table.string("quantity_per_unit", 20);
  table.money("unit_price", { precision: 10, scale: 2 }).default("0");
  table.smallUint("units_in_stock").default("0");
  table.smallUint("units_on_order").default("0");
  table.smallUint("reorder_level").default("0");
  table.bool("discontinued").notNull().default("false");
  table.linkable();
});

addTable("order_detail", (table) => {
  table.fk("order").notNull();
  table.fk("product").notNull();
  table.money("unit_price", { precision: 10, scale: 2 }).notNull().default("0");
  table.smallUint("quantity").notNull().default("1");
  table
    .percentage("discount", { precision: 2, scale: 2 })
    .notNull()
    .default("0");
});

//
// UI
//

navbar({
  color: "primary",
  variant: "solid",
  links: [
    "/employees",
    "/orders",
    "/customers",
    "/shippers",
    "/suppliers",
    "/products",
    "/categories",
    {
      auth: { allow: "sys_admin" },
      url: "/admin",
    },
    {
      auth: { allow: "sys_admin" },
      url: "/users",
    },
  ],
  multiSearchDialog: {
    tables: [
      {
        name: "employee",
        displayValues: [
          {
            expr: "employee.title",
            label: "Title",
            type: { type: "String", maxLength: 2000 },
          },
        ],
        icon: "Badge",
      },
      {
        name: "customer",
        displayValues: [
          {
            expr: "customer.contact_name",
            label: "Contact Name",
            type: { type: "String", maxLength: 2000 },
          },
          {
            expr: "customer.contact_title",
            label: "Contact Title",
            type: { type: "String", maxLength: 2000 },
          },
        ],
        icon: "Person",
      },
      {
        name: "supplier",
        icon: "LocalShipping",
        displayValues: [
          {
            expr: "supplier.contact_name",
            label: "Contact Name",
            type: { type: "String", maxLength: 2000 },
          },
          {
            expr: "supplier.contact_title",
            label: "Contact Title",
            type: { type: "String", maxLength: 2000 },
          },
        ],
      },
      {
        name: "product",
        icon: "LocalPizza",
        displayValues: [
          {
            expr: "(select name from db.category where id = product.category)",
            label: "Category",
            type: { type: "String", maxLength: 2000 },
          },
        ],
      },
    ],
  },
});

adminPage();

tableSuperGrid({
  table: "employee",
  selectable: true,
  toolbar: {
    export: true,
    delete: true,
  },
  viewButtonUrl: (id) => `'/employees/' || ${id}`,
  ignoreFields: ["global_id"],
});

recordGridPage({
  table: "employee",
  children: [
    {
      type: "namedHeader",
      prefix: "title_of_courtesy",
      subHeader: "title",
    },
    {
      type: "staticTableCard",
      rows: ["birth_date", "hire_date", "home_phone"],
      styles: { gridColumnSpan: 12, md: { gridColumnSpan: 6 } },
    },
    {
      type: "addressCard",
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        md: { gridColumnSpan: 6 },
      },
    },
    {
      type: "notesCard",
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        md: { gridColumnSpan: 6 },
      },
    },
  ],
});

tableSuperGrid({
  table: "order",
  selectable: true,
  toolbar: {
    export: true,
    delete: true,
    add: { type: "href", href: `/orders/add` },
  },
  viewButtonUrl: (id) => `'/orders/' || ${id}`,
});

insertFormPage({
  table: "order",
  content: {
    type: "SectionedGrid",
    sections: [
      {
        header: "Add Order",
        gridGap: 2,
        parts: [
          {
            field: "customer",
            colSpan: 12,
            xl: { colSpan: 3 },
            onChange: (state) => [
              spawn({
                detached: true,
                statements: [
                  record(`customer`, [
                    { name: "name", type: { type: "String", maxLength: 2000 } },
                    {
                      name: "address",
                      type: { type: "String", maxLength: 2000 },
                    },
                    { name: "city", type: { type: "String", maxLength: 2000 } },
                    {
                      name: "zip",
                      type: { type: "String", maxLength: 2000 },
                    },
                    {
                      name: "state",
                      type: { type: "String", maxLength: 2000 },
                    },
                    {
                      name: "country",
                      type: { type: "String", maxLength: 2000 },
                    },
                  ]),
                  serviceProc([
                    modify(
                      `insert into customer select company_name as name, * from db.customer where id = ${state.fields.get(
                        "customer"
                      )}`
                    ),
                  ]),
                  if_(`not ` + state.fields.touched("ship_address"), [
                    state.fields.set("ship_address", "customer.address"),
                  ]),
                  if_(`not ` + state.fields.touched("ship_name"), [
                    state.fields.set("ship_name", "customer.name"),
                  ]),
                  if_(`not ` + state.fields.touched("ship_city"), [
                    state.fields.set("ship_city", "customer.city"),
                  ]),
                  if_(`not ` + state.fields.touched("ship_zip"), [
                    state.fields.set("ship_zip", "customer.zip"),
                  ]),
                  if_(`not ` + state.fields.touched("ship_state"), [
                    state.fields.set("ship_state", "customer.state"),
                  ]),
                  if_(`not ` + state.fields.touched("ship_country"), [
                    state.fields.set("ship_country", "customer.country"),
                  ]),
                  commitUiChanges(),
                ],
              }),
            ],
          },
          {
            field: "order_date",
            initialValue: `current_date()`,
            colSpan: 12,
            xl: { colSpan: 3 },
          },
          { field: "required_date", colSpan: 12, xl: { colSpan: 3 } },
          { field: "ship_via", colSpan: 12, xl: { colSpan: 3 } },
          { field: "freight", colSpan: 12, xl: { colSpan: 3 } },
        ],
      },
      {
        header: "Shipping Information",
        gridGap: 2,
        parts: [
          { field: "ship_name", colSpan: 12, xl: { colSpan: 3 } },
          { field: "ship_address", colSpan: 12, xl: { colSpan: 3 } },
          { field: "ship_city", colSpan: 12, xl: { colSpan: 3 } },
          { field: "ship_zip", colSpan: 12, xl: { colSpan: 3 } },
          { field: "ship_state", colSpan: 12, xl: { colSpan: 3 } },
          { field: "ship_country", colSpan: 12, xl: { colSpan: 3 } },
        ],
      },
      {
        header: "Order Details",
        relation: {
          type: "Card",
          table: "order_detail",
          fields: [
            {
              field: "product",
              onChange: (_, cursor) => [
                spawn({
                  detached: true,
                  statements: [
                    if_(`not ` + cursor.field("unit_price").touched, [
                      scalar(`product_unit_price`, {
                        type: "Decimal",
                        precision: 10,
                        scale: 2,
                        signed: true,
                      }),
                      serviceProc([
                        setScalar(
                          "product_unit_price",
                          `(select unit_price from db.product where id = ${
                            cursor.field("product").value
                          })`
                        ),
                      ]),
                      if_(
                        `product_unit_price is not null and not ` +
                          cursor.field("unit_price").touched,
                        [
                          cursor
                            .field("unit_price")
                            .setValue("cast(product_unit_price as string)"),
                          commitUiChanges(),
                        ]
                      ),
                    ]),
                  ],
                }),
              ],
            },
            "unit_price",
            "quantity",
            "discount",
          ],
        },
      },
    ],
  },
  afterSubmitService: () => [
    navigate(`'/orders/' || last_record_id(db.order)`),
  ],
});

recordGridPage({
  table: "order",
  children: [
    { type: "superSimpleHeader", header: "Order Details" },
    {
      type: "staticTableCard",
      styles: {
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 8 },
      },
      rows: [
        "order_date",
        "required_date",
        "shipped_date",
        "customer",
        "employee",
        "ship_via",
        // check if freight needs to be added
        {
          label: "'Total'",
          expr: `(select sum(cast((unit_price * quantity) * (1 - discount) as decimal(10, 2))) from db.order_detail where order = record_id)`,
          display: (v) => `'$' || ${v}`,
        },
      ],
    },
    {
      type: "addressCard",
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 4 },
      },
      header: `'Ship Address'`,
      group: "ship_address",
    },
    {
      type: "relatedTable",
      table: "order_detail",
      fields: [
        "product",
        "unit_price",
        "quantity",
        "discount",
        {
          expr: (detail) =>
            `'$' || cast((${detail}.unit_price * ${detail}.quantity) * (1 - ${detail}.discount) as decimal(10, 2))`,
          label: "Total",
        },
      ],
      insertDialog: {
        fieldOverrides: {
          product: {
            onChange: (state) => [
              spawn({
                detached: true,
                statements: [
                  if_(`not ` + state.fields.touched("unit_price"), [
                    scalar(`product_unit_price`, {
                      type: "Decimal",
                      precision: 10,
                      scale: 2,
                      signed: true,
                    }),
                    serviceProc([
                      setScalar(
                        "product_unit_price",
                        `(select unit_price from db.product where id = ${state.fields.get(
                          "product"
                        )})`
                      ),
                    ]),
                    if_(
                      `product_unit_price is not null and not ` +
                        state.fields.touched("unit_price"),
                      [
                        state.fields.set(
                          "unit_price",
                          "cast(product_unit_price as string)"
                        ),
                        commitUiChanges(),
                      ]
                    ),
                  ]),
                ],
              }),
            ],
          },
        },
      },
    },
  ],
  createUpdatePage: true,
});

tableSuperGrid({
  table: "customer",
  selectable: true,
  toolbar: {
    export: true,
    delete: true,
  },
  viewButtonUrl: (id) => `'/customers/' || ${id}`,
});

recordGridPage({
  table: "customer",
  children: [
    { type: "namedHeader" },
    {
      type: "staticTableCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      rows: ["contact_name", "contact_title", "phone", "fax"],
    },
    {
      type: "addressCard",
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 4 },
      },
    },
  ],
});

tableSimpleGrid({
  table: "shipper",
  toolbar: {
    add: { type: "dialog" },
  },
});

tableSimpleGrid({ table: "supplier" });

recordGridPage({
  table: "supplier",
  children: [
    { type: "namedHeader" },
    {
      type: "staticTableCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      rows: ["contact_name", "contact_title", "phone", "fax", "home_page"],
    },
    {
      type: "addressCard",
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 4 },
      },
    },
  ],
});

tableSimpleGrid({
  table: "product",
  toolbar: {
    add: { type: "dialog" },
  },
});

recordGridPage({
  table: "product",
  children: [
    { type: "namedHeader", chips: ["discontinued"] },
    {
      type: "staticTableCard",
      styles: { gridColumnSpan: 12, md: { gridColumnSpan: 6 } },
      rows: [
        "supplier",
        "category",
        "quantity_per_unit",
        "unit_price",
        "units_in_stock",
        "units_on_order",
        "reorder_level",
      ],
    },
  ],
});

tableSimpleGrid({ table: "category" });
