import "./system.ts";
import "./csvScriptDb.ts";
import { system } from "@yolm/boost";

system.addScript("init-dev-db", (s) =>
  s
    .importCsv(`csv`, `data/csv`)
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, is_sys_admin, is_admin, disabled, email) values (random.uuid(), true, true, false, 'coolguy@coolemail.com')`,
    )
    .modify(
      `insert into db.shipper select companyName as name, phone from csv.Shipper`,
    )
    .modify(
      `insert into db.category select categoryName as name, description from csv.Category`,
    )
    .modify(
      `insert into db.supplier select companyName as company_name, contactName as contact_name, contactTitle as contact_title, address, city, region as state, postalCode as zip, country, phone, fax from csv.Supplier`,
    )
    .modify(
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
      from csv.Customer`,
    )
    .modify(
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
        from csv.Product`,
    )
    .modify(
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
          firstName || ' ' || lastName || '@yolmail.com' as email
          from csv.Employee`,
    )
    .modify(
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
        from csv.Order`,
    )
    .modify(
      `insert into db.order_detail
        select
          (select id from csv.Order where Order.orderID = OrderDetails.orderID) as order,
          (select id from csv.Product where Product.productID = OrderDetails.productID) as product,
          unitPrice as unit_price,
          quantity,
          discount
        from csv.OrderDetails`,
    )
    .commitTransaction("db")
    .saveDbToDir(`data/dev`),
);
