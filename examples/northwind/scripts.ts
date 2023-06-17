import "./app.ts";
import { importCsv, modify, saveDb } from "@yolm/boost/procHelpers";
import {
  addScript,
  addScriptDbDefinition,
  addTable,
} from "@yolm/boost/modelHelpers";

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
  name: "init-dev-db",
  procedure: [
    importCsv(`csv`, `data/csv`),
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
          rng.uuid() as global_id,
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
    saveDb(`data/dev`),
  ],
});
