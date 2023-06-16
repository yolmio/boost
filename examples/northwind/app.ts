import {
  addEnum,
  addRunProfile,
  addScript,
  addScriptDbDefinition,
  addTable,
  setAppName,
  setUserRoleTable,
  setUserTable,
} from "@yolm/boost/modelHelpers";
import { navbar } from "@yolm/boost/shells/navbar";
import {
  commitUiChanges,
  if_,
  importCsv,
  modify,
  navigate,
  record,
  saveDb,
  scalar,
  serviceProc,
  setScalar,
  spawn,
} from "@yolm/boost/procHelpers";
import { tableSuperGrid } from "@yolm/boost/pages/tableSuperGrid";
import { adminPage } from "@yolm/boost/pages/admin";
import { cardGridRecordPage } from "@yolm/boost/pages/cardGridRecord";
import { tableSimpleGrid } from "@yolm/boost/pages/tableSimpleDatagrid";
import { insertFormPage } from "@yolm/boost/pages/insertForm";

setAppName("northwind");

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

setUserTable("employee");
setUserRoleTable("employee_role");

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

cardGridRecordPage({
  table: "employee",
  header: {
    type: "namedHeader",
    prefix: "title_of_courtesy",
    subHeader: "title",
  },
  cards: [
    {
      colSpan: 12,
      md: { colSpan: 6 },
      content: {
        type: "staticTable",
        rows: ["birth_date", "hire_date", "home_phone"],
      },
    },
    {
      colSpan: 12,
      md: { colSpan: 4 },
      alignSelf: "flex-start",
      content: { type: "address" },
    },
    {
      colSpan: 12,
      md: { colSpan: 4 },
      alignSelf: "flex-start",
      content: { type: "notes" },
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

cardGridRecordPage({
  table: "order",
  header: { type: "superSimpleHeader", header: "Order Details" },
  createUpdatePage: true,
  cards: [
    {
      colSpan: 12,
      lg: { colSpan: 8, rowSpan: 2 },
      rowSpan: 1,
      content: {
        type: "staticTable",
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
    },
    {
      colSpan: 12,
      lg: { colSpan: 4 },
      alignSelf: "flex-start",
      content: {
        type: "address",
        header: `'Ship Address'`,
        group: "ship_address",
      },
    },
  ],
  footer: {
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

cardGridRecordPage({
  table: "customer",
  header: { type: "namedHeader" },
  createUpdatePage: true,
  cards: [
    {
      colSpan: 12,
      md: { colSpan: 8 },
      content: {
        type: "staticTable",
        rows: ["contact_name", "contact_title", "phone", "fax"],
      },
    },
    {
      colSpan: 12,
      md: { colSpan: 4 },
      alignSelf: "flex-start",
      content: { type: "address" },
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

cardGridRecordPage({
  table: "supplier",
  header: {
    type: "namedHeader",
  },
  cards: [
    {
      colSpan: 12,
      md: { colSpan: 8 },
      content: {
        type: "staticTable",
        rows: ["contact_name", "contact_title", "phone", "fax", "home_page"],
      },
    },
    {
      colSpan: 12,
      md: { colSpan: 4 },
      alignSelf: "flex-start",
      content: { type: "address" },
    },
  ],
});

tableSimpleGrid({
  table: "product",
  toolbar: {
    add: { type: "dialog" },
  },
});

cardGridRecordPage({
  table: "product",
  header: {
    type: "namedHeader",
    chips: ["discontinued"],
  },
  cards: [
    {
      colSpan: 12,
      md: { colSpan: 6 },
      content: {
        type: "staticTable",
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
    },
  ],
});

tableSimpleGrid({ table: "category" });

const devUserUuid = `bbab7507-ed34-46d4-82c4-c28fe2a4dc8f`;

addRunProfile({
  asUser: devUserUuid,
  name: "default",
  dir: "test-data",
  time: `2021-11-11T16:37:49.715Z`,
});

// csv db mapping like
addScriptDbDefinition("csv", (db) => {
  addTable("Shipper", (table) => {
    table.tinyUint("shipperID").notNull();
    table.string("companyName", 16).notNull();
    table.string("phone", 14).notNull();
  });
  addTable("Category", (table) => {
    table.tinyUint("categoryID").notNull();
    table.string("categoryName", 14).notNull();
    table.string("description", 55).notNull();
    table.string("picture", 256).notNull();
  });
  addTable("Supplier", (table) => {
    table.tinyUint("supplierID").notNull();
    table.string("companyName", 38).notNull();
    table.string("contactName", 26).notNull();
    table.string("contactTitle", 28).notNull();
    table.string("address", 45).notNull();
    table.string("city", 13).notNull();
    table.string("region", 8);
    table.string("postalCode", 8).notNull();
    table.string("country", 11).notNull();
    table.string("phone", 20).notNull();
    table.string("fax", 20);
    table.string("homePage", 94);
  });
  addTable("Customer", (table) => {
    table.string("customerID", 5).notNull();
    table.string("companyName", 36).notNull();
    table.string("contactName", 23).notNull();
    table.string("contactTitle", 30).notNull();
    table.string("address", 47).notNull();
    table.string("city", 17).notNull();
    table.string("region", 13);
    table.string("postalCode", 9);
    table.string("country", 11).notNull();
    table.string("phone", 17).notNull();
    table.string("fax", 17);
  });
  addTable("Product", (table) => {
    table.tinyUint("productID").notNull();
    table.string("productName", 33).notNull();
    table.tinyUint("supplierID").notNull();
    table.tinyUint("categoryID").notNull();
    table.string("quantityPerUnit", 20).notNull();
    table
      .decimal("unitPrice", { precision: 6, scale: 2, signed: false })
      .notNull();
    table.tinyUint("unitsInStock").notNull();
    table.tinyUint("unitsOnOrder").notNull();
    table.tinyUint("reorderLevel").notNull();
    table.tinyUint("discontinued").notNull();
  });
  addTable("Employee", (table) => {
    table.tinyUint("employeeID").notNull();
    table.string("lastName", 9).notNull();
    table.string("firstName", 8).notNull();
    table.string("title", 24).notNull();
    table.string("titleOfCourtesy", 4).notNull();
    table.string("birthDate", 23).notNull();
    table.string("hireDate", 23).notNull();
    table.string("address", 29).notNull();
    table.string("city", 8).notNull();
    table.string("region", 2);
    table.string("postalCode", 7).notNull();
    table.string("country", 3).notNull();
    table.string("homePhone", 14).notNull();
    table.smallUint("extension").notNull();
    table.string("photo", 256).notNull();
    table.string("notes", 253).notNull();
    table.tinyUint("reportsTo");
    table.string("photoPath", 38).notNull();
  });
  addTable("Order", (table) => {
    table.smallUint("orderID").notNull();
    table.string("customerID", 5).notNull();
    table.tinyUint("employeeID").notNull();
    table.string("orderDate", 23).notNull();
    table.string("requiredDate", 23).notNull();
    table.string("shippedDate", 23);
    table.tinyUint("shipVia").notNull();
    table
      .decimal("freight", { precision: 6, scale: 2, signed: false })
      .notNull();
    table.string("shipName", 34).notNull();
    table.string("shipAddress", 47).notNull();
    table.string("shipCity", 20).notNull();
    table.string("shipRegion", 13);
    table.string("shipPostalCode", 9);
    table.string("shipCountry", 11).notNull();
  });
  addTable("OrderDetails", (table) => {
    table.smallUint("orderID").notNull();
    table.tinyUint("productID").notNull();
    table
      .decimal("unitPrice", { precision: 6, scale: 2, signed: false })
      .notNull();
    table.tinyUint("quantity").notNull();
    table
      .decimal("discount", { precision: 6, scale: 2, signed: false })
      .notNull();
  });
});

addScript({
  name: "create-dev-data",
  procedure: [
    importCsv(`csv`, `csv`),
    modify(
      `insert into db.shipper select companyName as name, phone from csv.Shipper`
    ),
    modify(
      `insert into db.category select categoryName as name, description from csv.Category`
    ),
    modify(
      `insert into db.supplier select companyName as company_name, contactName as contact_name, contactTitle as contact_title, address, city, region as state, postalCode as zip, country, phone, fax from csv.Supplier`
    ),
    modify(
      `insert into db.customer
      select companyName as company_name,
            contactName as contact_name,
            contactTitle as contact_title,
            address,
            city,
            region as state,
            postalCode as zip,
            country,
            phone,
            fax
      from csv.Customer`
    ),
    modify(
      `insert into db.product
        select productName as name,
          (select id from csv.Supplier where Supplier.supplierID = Product.supplierID) as supplier,
          (select id from csv.Category where Category.categoryID = Product.categoryID) as category,
          quantityPerUnit as quantity_per_unit,
          unitPrice as unit_price,
          unitsInStock as units_in_stock,
          unitsOnOrder as units_on_order,
          reorderLevel as reorder_level,
          discontinued = 1 as discontinued
        from csv.Product`
    ),
    modify(
      `insert into db.employee
        select lastName as last_name,
          firstName as first_name,
          title,
          titleOfCourtesy as title_of_courtesy,
          cast(substring(birthDate from 1 for 10) as date) as birth_date,
          cast(substring(hireDate from 1 for 10) as date) as hire_date,
          address,
          city,
          region as state,
          postalCode as zip,
          country,
          homePhone as home_phone,
          cast(extension as string),
          reportsTo - 1 as reports_to,
          case when employeeID = 1 then cast('${devUserUuid}' as uuid) else rng.uuid() end as global_id,
          firstName || lastName || '@gmail.com' as email,
          false as disabled 
          from csv.Employee`
    ),
    modify(
      `insert into db.order
        select 
          (select id from csv.Customer where Customer.customerID = Order.customerID) as customer,
          (select id from csv.Employee where Employee.employeeID = Order.employeeID) as employee,
          cast(substring(orderDate from 1 for 10) as date) as order_date,
          cast(substring(requiredDate from 1 for 10) as date) as required_date,
          cast(substring(shippedDate from 1 for 10) as date) as shipped_date,
          (select id from csv.Shipper where Shipper.shipperID = Order.shipVia) as ship_via,
          shipName as ship_name,
          shipAddress as ship_address,
          shipCity as ship_city,
          shipRegion as ship_state,
          shipPostalCode as ship_zip,
          shipCountry as ship_country
        from csv.Order`
    ),
    modify(
      `insert into db.order_detail
        select 
          (select id from csv.Order where Order.orderID = OrderDetails.orderID) as order,
          (select id from csv.Product where Product.productID = OrderDetails.productID) as product,
          unitPrice as unit_price,
          quantity,
          discount
        from csv.OrderDetails`
    ),
    modify(
      `insert into db.employee_role (employee, role) values (0, 'sys_admin')`
    ),
    saveDb(`test-data`),
  ],
});
