import { addEnum, addTable } from "@yolm/boost/modelHelpers";
import { navbarShell } from "@yolm/boost/shells/navbar";
import {
  addUsers,
  commitUiChanges,
  debugExpr,
  if_,
  modify,
  navigate,
  record,
  removeUsers,
  scalar,
  serviceProc,
  setScalar,
  spawn,
  table,
} from "@yolm/boost/procHelpers";
import { datagridPage } from "@yolm/boost/pages/datagrid";
import { dbManagementPage } from "@yolm/boost/pages/dbManagement";
import { recordGridPage } from "@yolm/boost/pages/recordGrid";
import { simpleDatagridPage } from "@yolm/boost/pages/simpleDatagrid";
import { insertFormPage } from "@yolm/boost/pages/insertForm";
import { dashboardGridPage } from "@yolm/boost/pages/dashboardGrid";
import { model } from "@yolm/boost/singleton";
import { button } from "@yolm/boost/components/button";
import {
  ReportParameter,
  SimpleReportsPageBuilder,
} from "@yolm/boost/pages/simpleReportPage";
import { ServiceProcStatement } from "@yolm/boost/yom";

model.name = "chinook";
model.title = "Chinook";
model.displayName = "Chinook";

//
// DATABASE
//

addTable("user", (table) => {
  table.fieldGroupFromCatalog({ type: "requiredUserFields" });
  table.bool("is_sys_admin").notNull().default("false");
  table.bool("is_admin").notNull().default("false");
  table.fk("employee");
});

addTable("album", (table) => {
  table.string("title", 160).notNull();
  table.fk("artist").notNull();
});

addTable("artist", (table) => {
  table.string("name", 120).notNull();
});

addTable("customer", (table) => {
  table.string("first_name", 40).notNull();
  table.string("last_name", 20).notNull();
  table.string("company", 80);
  table.fieldGroupFromCatalog({ type: "address" });
  table.phoneNumber("phone").maxLength(24);
  table.string("fax", 24);
  table.email("email").maxLength(60).notNull();
  table.fk("support_rep", "employee");
});

addTable("employee", (table) => {
  table.string("last_name", 20).notNull();
  table.string("first_name", 20).notNull();
  table.string("title", 30);
  table.fk("reports_to", "employee");
  table.date("birth_date");
  table.date("hire_date");
  table.fieldGroupFromCatalog({ type: "address" });
  table.string("phone", 24);
  table.string("fax", 24);
  table.string("email", 60);
});

addTable("genre", (table) => {
  table.string("name", 120).notNull();
});

addTable("invoice", (table) => {
  table.fk("customer").notNull();
  table.date("invoice_date").notNull();
  table.fieldGroupFromCatalog({
    type: "address",
    prefix: "billing_",
  });
  table.money("total").notNull();
});

addTable("invoice_line", (table) => {
  table.fk("invoice").notNull();
  table.fk("track").notNull();
  table.money("unit_price").notNull();
  table.smallUint("quantity").notNull();
});

addTable("media_type", (table) => {
  table.string("name", 120).notNull();
});

addTable("playlist", (table) => {
  table.string("name", 120).notNull();
});

addTable("playlist_track", (table) => {
  table.fk("playlist").notNull();
  table.fk("track").notNull();
});

addTable("track", (table) => {
  table.string("name", 200).notNull();
  table.fk("album");
  table.fk("media_type").notNull();
  table.fk("genre");
  table.string("composer", 220);
  table.uint("milliseconds").notNull();
  table.uint("bytes");
  table.money("unit_price").notNull();
});

//
// UI
//

const isSysAdmin = `(select is_sys_admin from db.user from where id = current_user())`;
const isAdmin = `(select is_admin from db.user from where id = current_user())`;

navbarShell({
  color: "primary",
  variant: "solid",
  links: [
    "/customers",
    { showIf: isAdmin, url: "/employees" },
    { showIf: isAdmin, url: "/users" },
    { showIf: isSysAdmin, url: "/db-management" },
  ],
  // multiTableSearchDialog: {
  //   tables: [
  //     {
  //       name: "employee",
  //       displayValues: ["title"],
  //       icon: "Badge",
  //     },
  //     {
  //       name: "customer",
  //       displayValues: ["contact_name", "contact_title"],
  //       icon: "Person",
  //     },
  //     {
  //       name: "supplier",
  //       icon: "LocalShipping",
  //       displayValues: ["contact_name", "contact_title"],
  //     },
  //     {
  //       name: "product",
  //       icon: "LocalPizza",
  //       displayValues: [
  //         {
  //           expr: (record) =>
  //             `(select name from db.category where id = ${record}.category)`,
  //           name: "category",
  //           type: { type: "String", maxLength: 2000 },
  //         },
  //       ],
  //     },
  //   ],
  // },
});

// // In an application that has data not from 1998, you should replace this with `today()`
// const today = `DATE '1998-05-06'`;

// const ordersNotShipped = `
// select
//   order.id as order_id,
//   order_date,
//   required_date,
//   customer.company_name as customer_name,
//   customer.id as customer_id,
//   employee.first_name || ' ' || employee.last_name as employee_name,
//   employee.id as employee_id
// from db.order
//   join db.customer on customer = customer.id
//   join db.employee on employee = employee.id
// where shipped_date is null
// order by order_date
// limit 5`;

// const newOrders = `
// select
//   order.id as order_id,
//   order_date,
//   required_date,
//   customer.company_name as customer_name,
//   customer.id as customer_id,
//   employee.first_name || ' ' || employee.last_name as employee_name,
//   employee.id as employee_id
// from db.order
//   join db.customer on customer = customer.id
//   join db.employee on employee = employee.id
// order by order_date desc
// limit 5`;

// const orderTableColumns = [
//   {
//     cell: (row) =>
//       button({
//         href: `'/orders/' || ${row}.order_id`,
//         color: "primary",
//         size: "sm",
//         variant: "soft",
//         children: `'View'`,
//       }),
//     header: "",
//   },
//   {
//     cell: (row) => `${row}.customer_name`,
//     href: (row) => `'/customers/' || ${row}.customer_id`,
//     header: "Customer",
//   },
//   {
//     cell: (row) => `${row}.employee_name`,
//     href: (row) => `'/employees/' || ${row}.employee_id`,
//     header: "Employee",
//   },
//   {
//     cell: (row) => `format.date(${row}.order_date, '%-d %b')`,
//     header: "Order Date",
//   },
//   {
//     cell: (row) => `format.date(${row}.required_date, '%-d %b')`,
//     header: "Required Date",
//   },
// ];

// // If you want to do weekly, make sure to get rid of the reverseData, change the lineChartQuery to weeklyCountQuery, and change the labels to what you want
// const weeklyCountQuery = `
// select
//   date.add(day, 6, daily.value) as date,
//   count(order.id) as count
// from series.daily(${today}, 7, -7) as daily
//   left join db.order
//     on order_date between daily.value and date.add(day, 6, daily.value)
// group by daily.value
// order by daily.value`;

// const monthlyCountQuery = `
// select date.trunc(month, order_date) as date, count(*) as count
// from db.order
// group by date.trunc(month, order_date)
// order by date desc
// limit 7`;

// const pieChartQuery = `
// with employee_order_count as (
//   select employee, count(*) as count
//   from db.order
//   where shipped_date is null
//   group by employee
// )
// select first_name || ' ' || last_name as employee, count
// from employee_order_count
// join db.employee on employee = employee.id`;

// dashboardGridPage({
//   children: [
//     {
//       type: "header",
//       header: `'Northwind Traders Dashboard'`,
//       subHeader: "'Welcome back. Here''s whats going on'",
//     },
//     {
//       type: "threeStats",
//       header: `'Last 30 Days'`,
//       left: {
//         title: "'Orders'",
//         value: `(select count(*) from db.order where order_date > date.add(day, -30, ${today}))`,
//         previous: `(select count(*) from db.order where order_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today}))`,
//         trend: `cast((value - previous) as decimal(10, 2)) / cast(previous as decimal(10, 2))`,
//       },
//       middle: {
//         title: "'Income'",
//         procedure: [
//           scalar(
//             `value_num`,
//             `(select sum(cast((unit_price * quantity) * (1 - discount) as decimal(10, 2)))
//               from db.order
//                 join db.order_detail
//                   on order = order.id
//               where order_date > date.add(day, -30, ${today}))`
//           ),
//           scalar(
//             `previous_num`,
//             `(select sum(cast((unit_price * quantity) * (1 - discount) as decimal(10, 2)))
//               from db.order
//                 join db.order_detail
//                   on order = order.id
//               where order_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today}))`
//           ),
//         ],
//         value: `format.currency(value_num, 'USD')`,
//         previous: `format.currency(previous_num, 'USD')`,
//         trend: `(value_num - previous_num) / previous_num`,
//       },
//       right: {
//         title: "'Shipped Orders'",
//         value: `(select count(*) from db.order where shipped_date > date.add(day, -30, ${today}))`,
//         previous: `(select count(*) from db.order where shipped_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today})))`,
//         trend: `cast((value - previous) as decimal(10, 2)) / cast(previous as decimal(10, 2))`,
//       },
//     },
//     {
//       type: "lineChart",
//       stateQuery: monthlyCountQuery,
//       reverseData: "true",
//       lineChartQuery: "select count as y, date as x from result",
//       labels: "select format.date(date, '%b') from result",
//       header: "Order Count",
//     },
//     {
//       type: "pieChart",
//       styles: { lg: { gridRowSpan: 2 } },
//       cardStyles: { minHeight: "300px", lg: { minHeight: "450px" } },
//       header: "Unshipped Orders by Employee",
//       stateQuery: pieChartQuery,
//       pieChartOpts: {
//         labels: "select employee from result",
//         series: "select count from result",
//         donut: "true",
//       },
//     },
//     {
//       type: "barChart",
//       header: "Sales By Category",
//       state: [
//         table(
//           "last_60",
//           `select
//             product.category as category,
//             sum(cast((order_detail.unit_price * quantity) * (1 - discount) as decimal(10, 2))) as sales
//           from db.order
//             join db.order_detail on order = order.id
//             join db.product on product = product.id
//           where order_date > date.add(day, -60, ${today})
//           group by product.category
//           order by sales desc
//           limit 5`
//         ),
//         table(
//           "last_30",
//           `select
//             category,
//             (select
//               sum((order_detail.unit_price * quantity) * (1 - discount))
//             from db.order
//               join db.order_detail on order = order.id
//               join db.product on product = product.id
//             where order_date > date.add(day, -30, ${today}) and product.category = last_60.category
//             ) as sales
//           from last_60`
//         ),
//         table(
//           "label",
//           "select name from last_60 join db.category on category = category.id"
//         ),
//       ],
//       series: [
//         {
//           query: "select sales as y, category as x from last_30",
//           name: "Last 30 Days",
//         },
//         {
//           query: "select sales as y, category as x from last_60",
//           name: "Last 60 Days",
//         },
//       ],
//       labels: "select name from label",
//       axisY: {
//         labelInterpolation:
//           "'$' || format.decimal((cast(label as decimal(28, 10)) / 1000)) || 'K'",
//       },
//     },
//     {
//       type: "table",
//       query: ordersNotShipped,
//       header: "Orders Not Shipped",
//       columns: orderTableColumns,
//     },
//     {
//       type: "table",
//       query: newOrders,
//       header: "New Orders",
//       columns: orderTableColumns,
//     },
//   ],
// });

// simpleDatagridPage({
//   table: "employee",
//   selectable: true,
//   toolbar: {
//     export: true,
//     delete: true,
//     add: {
//       type: "dialog",
//       opts: {
//         withValues: { image_thumb: "null", image_full: "null" },
//         beforeTransactionCommit: (state) => [
//           addUsers(
//             `select ${state.fields.get(
//               "email"
//             )} as email, next_record_id(db.user) as db_id, 'none' as notification_type`,
//             "added_user"
//           ),
//           modify(
//             `insert into db.user (global_id, is_sys_admin, is_admin, disabled, email, employee) values ((select global_id from added_user), false, false, false, ${state.fields.get(
//               "email"
//             )}, last_record_id(db.employee))`
//           ),
//         ],
//       },
//     },
//   },
//   fields: {
//     email: {
//       beforeEdit: (newValue, recordId) => [
//         scalar(
//           `user_id`,
//           `(select id from db.user where employee = ${recordId})`
//         ),
//         modify(`update db.user set email = ${newValue} where id = user_id`),
//         if_(`not (select disabled from db.user where id = user_id)`, [
//           removeUsers(`select global_id from db.user where id = user_id`),
//           addUsers(
//             `select ${newValue} as email, user_id as db_id, 'none' as notification_type`,
//             `added_user`
//           ),
//           modify(
//             `update db.user set global_id = (select global_id from added_user) where id = user_id`
//           ),
//         ]),
//       ],
//     },
//   },
//   viewButton: true,
//   rowHeight: "tall",
//   fieldOrder: ["image_thumb", "first_name", "last_name", "title"],
// });

// recordGridPage({
//   table: "employee",
//   children: [
//     {
//       type: "namedHeader",
//       prefix: "title_of_courtesy",
//       subHeader: "title",
//     },
//     {
//       type: "staticTableCard",
//       rows: ["birth_date", "hire_date", "home_phone"],
//       styles: { gridColumnSpan: 12, md: { gridColumnSpan: 6 } },
//     },
//     {
//       type: "addressCard",
//       styles: {
//         alignSelf: "start",
//         gridColumnSpan: 12,
//         md: { gridColumnSpan: 6 },
//       },
//     },
//     {
//       type: "notesCard",
//       styles: {
//         alignSelf: "start",
//         gridColumnSpan: 12,
//         md: { gridColumnSpan: 6 },
//       },
//     },
//   ],
// });

// simpleDatagridPage({
//   table: "user",
//   toolbar: {
//     add: {
//       type: "dialog",
//       opts: {
//         withValues: { global_id: "new_global_id", disabled: "false" },
//         beforeTransactionStart: (state) => [
//           addUsers(
//             `select next_record_id(db.user) as db_id, 'none' as notification_type, ${state.fields.get(
//               "email"
//             )} as email`
//           ),
//           scalar(`new_global_id`, `(select global_id from added_user)`),
//         ],
//       },
//     },
//   },
//   fields: {
//     disabled: {
//       beforeEdit: (newValue, recordId) => [
//         if_<ServiceProcStatement>(
//           newValue,
//           [removeUsers(`select global_id from db.user where id = ${recordId}`)],
//           [
//             addUsers(
//               `select email, id as db_id, 'none' as notification_type from db.user where id = ${recordId}`,
//               `added_user`
//             ),
//             modify(
//               `update db.user set global_id = (select global_id from added_user) where id = ${recordId}`
//             ),
//           ]
//         ),
//       ],
//     },
//     email: {
//       beforeEdit: (newValue, recordId) => [
//         scalar(
//           `employee`,
//           `(select employee from db.user where id = ${recordId})`
//         ),
//         modify(
//           `update db.employee set email = ${newValue} where id = employee`
//         ),
//         removeUsers(`select global_id from db.user where id = ${recordId}`),
//         addUsers(
//           `select ${newValue} as email, ${recordId} as db_id, 'none' as notification_type`,
//           `added_user`
//         ),
//         modify(
//           `update db.user set global_id = (select global_id from added_user) where id = ${recordId}`
//         ),
//       ],
//     },
//   },
// });

// datagridPage({
//   table: "order",
//   selectable: true,
//   toolbar: {
//     export: true,
//     delete: true,
//     add: { type: "href", href: `/orders/add` },
//   },
//   viewButton: true,
// });

// const orderFormPartStyles = { gridColumnSpan: 12, lg: { gridColumnSpan: 3 } };

// insertFormPage({
//   table: "order",
//   withValues: { employee: "current_user()" },
//   content: {
//     type: "TwoColumnSectioned",
//     sections: [
//       {
//         header: "General Information",
//         parts: [
//           {
//             field: "customer",
//             styles: orderFormPartStyles,
//             onChange: (state) => [
//               spawn({
//                 detached: true,
//                 statements: [
//                   record(`customer`, [
//                     { name: "name", type: { type: "String", maxLength: 2000 } },
//                     {
//                       name: "address",
//                       type: { type: "String", maxLength: 2000 },
//                     },
//                     { name: "city", type: { type: "String", maxLength: 2000 } },
//                     {
//                       name: "zip",
//                       type: { type: "String", maxLength: 2000 },
//                     },
//                     {
//                       name: "state",
//                       type: { type: "String", maxLength: 2000 },
//                     },
//                     {
//                       name: "country",
//                       type: { type: "String", maxLength: 2000 },
//                     },
//                   ]),
//                   serviceProc([
//                     modify(
//                       `insert into customer select company_name as name, * from db.customer where id = ${state.fields.get(
//                         "customer"
//                       )}`
//                     ),
//                   ]),
//                   if_(`not ` + state.fields.touched("ship_address"), [
//                     state.fields.set("ship_address", "customer.address"),
//                   ]),
//                   if_(`not ` + state.fields.touched("ship_name"), [
//                     state.fields.set("ship_name", "customer.name"),
//                   ]),
//                   if_(`not ` + state.fields.touched("ship_city"), [
//                     state.fields.set("ship_city", "customer.city"),
//                   ]),
//                   if_(`not ` + state.fields.touched("ship_zip"), [
//                     state.fields.set("ship_zip", "customer.zip"),
//                   ]),
//                   if_(`not ` + state.fields.touched("ship_state"), [
//                     state.fields.set("ship_state", "customer.state"),
//                   ]),
//                   if_(`not ` + state.fields.touched("ship_country"), [
//                     state.fields.set("ship_country", "customer.country"),
//                   ]),
//                   commitUiChanges(),
//                 ],
//               }),
//             ],
//           },
//           {
//             field: "order_date",
//             initialValue: `current_date()`,
//             styles: orderFormPartStyles,
//           },
//           { field: "required_date", styles: orderFormPartStyles },
//           { field: "ship_via", styles: orderFormPartStyles },
//           { field: "freight", styles: orderFormPartStyles },
//         ],
//       },
//       {
//         header: "Shipping Information",
//         description:
//           "Auto-populated when you choose a customer, make changes if needed.",
//         parts: [
//           { field: "ship_name", styles: orderFormPartStyles },
//           { field: "ship_address", styles: orderFormPartStyles },
//           { field: "ship_city", styles: orderFormPartStyles },
//           { field: "ship_zip", styles: orderFormPartStyles },
//           { field: "ship_state", styles: orderFormPartStyles },
//           { field: "ship_country", styles: orderFormPartStyles },
//         ],
//       },
//       {
//         header: "Order Details",
//         description: "Add products to the order.",
//         relation: {
//           type: "Card",
//           table: "order_detail",
//           fields: [
//             {
//               field: "product",
//               onChange: (_, cursor) => [
//                 spawn({
//                   detached: true,
//                   statements: [
//                     if_(`not ` + cursor.field("unit_price").touched, [
//                       scalar(`product_unit_price`, {
//                         type: "Decimal",
//                         precision: 10,
//                         scale: 2,
//                         signed: true,
//                       }),
//                       serviceProc([
//                         setScalar(
//                           "product_unit_price",
//                           `(select unit_price from db.product where id = ${
//                             cursor.field("product").value
//                           })`
//                         ),
//                       ]),
//                       if_(
//                         `product_unit_price is not null and not ` +
//                           cursor.field("unit_price").touched,
//                         [
//                           cursor
//                             .field("unit_price")
//                             .setValue("cast(product_unit_price as string)"),
//                           commitUiChanges(),
//                         ]
//                       ),
//                     ]),
//                   ],
//                 }),
//               ],
//             },
//             "unit_price",
//             "quantity",
//             "discount",
//           ],
//         },
//       },
//     ],
//   },
//   afterTransactionCommit: () => [
//     navigate(`'/orders/' || last_record_id(db.order)`),
//   ],
// });

// recordGridPage({
//   table: "order",
//   children: [
//     { type: "superSimpleHeader", header: "Order Details" },
//     {
//       type: "staticTableCard",
//       styles: {
//         gridColumnSpan: 12,
//         lg: { gridColumnSpan: 8 },
//       },
//       rows: [
//         "order_date",
//         "required_date",
//         "shipped_date",
//         "customer",
//         "employee",
//         "ship_via",
//         // check if freight needs to be added
//         {
//           label: "'Total'",
//           expr: `(select sum(cast((unit_price * quantity) * (1 - discount) as decimal(10, 2))) from db.order_detail where order = record_id)`,
//           display: (v) => `format.currency(${v}, 'usd')`,
//         },
//       ],
//     },
//     {
//       type: "addressCard",
//       styles: {
//         alignSelf: "start",
//         gridColumnSpan: 12,
//         lg: { gridColumnSpan: 4 },
//       },
//       header: `'Ship Address'`,
//       group: "ship_address",
//     },
//     {
//       type: "relatedTable",
//       table: "order_detail",
//       fields: [
//         "product",
//         "unit_price",
//         "quantity",
//         "discount",
//         {
//           expr: (detail) =>
//             `format.currency(cast((${detail}.unit_price * ${detail}.quantity) * (1 - ${detail}.discount) as decimal(10, 2)), 'usd')`,
//           label: "Total",
//         },
//       ],
//       insertDialog: {
//         fieldOverrides: {
//           product: {
//             onChange: (state) => [
//               spawn({
//                 detached: true,
//                 statements: [
//                   if_(`not ` + state.fields.touched("unit_price"), [
//                     scalar(`product_unit_price`, {
//                       type: "Decimal",
//                       precision: 10,
//                       scale: 2,
//                       signed: true,
//                     }),
//                     serviceProc([
//                       setScalar(
//                         "product_unit_price",
//                         `(select unit_price from db.product where id = ${state.fields.get(
//                           "product"
//                         )})`
//                       ),
//                     ]),
//                     if_(
//                       `product_unit_price is not null and not ` +
//                         state.fields.touched("unit_price"),
//                       [
//                         state.fields.set(
//                           "unit_price",
//                           "cast(product_unit_price as string)"
//                         ),
//                         commitUiChanges(),
//                       ]
//                     ),
//                   ]),
//                 ],
//               }),
//             ],
//           },
//         },
//       },
//     },
//   ],
//   createUpdatePage: true,
// });

// datagridPage({
//   table: "customer",
//   selectable: true,
//   toolbar: {
//     export: true,
//     delete: true,
//     add: { type: "dialog" },
//   },
//   viewButton: true,
// });

// recordGridPage({
//   table: "customer",
//   children: [
//     { type: "namedHeader" },
//     {
//       type: "staticTableCard",
//       styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
//       rows: ["contact_name", "contact_title", "phone", "fax"],
//     },
//     {
//       type: "addressCard",
//       styles: {
//         alignSelf: "start",
//         gridColumnSpan: 12,
//         lg: { gridColumnSpan: 4 },
//       },
//     },
//   ],
// });

simpleDatagridPage({
  table: "album",
  toolbar: {
    add: { type: "dialog" },
  },
});

simpleDatagridPage({
  table: "artist",
  toolbar: {
    add: { type: "dialog" },
  },
});

simpleDatagridPage({
  table: "genre",
  toolbar: {
    add: { type: "dialog" },
  },
});

simpleDatagridPage({
  table: "media_type",
  toolbar: {
    add: { type: "dialog" },
  },
});

simpleDatagridPage({
  table: "playlist",
  toolbar: {
    add: { type: "dialog" },
  },
});

datagridPage({ table: "track" });

// recordGridPage({
//   table: "supplier",
//   children: [
//     { type: "namedHeader" },
//     {
//       type: "staticTableCard",
//       styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
//       rows: ["contact_name", "contact_title", "phone", "fax", "home_page"],
//     },
//     {
//       type: "addressCard",
//       styles: {
//         alignSelf: "start",
//         gridColumnSpan: 12,
//         lg: { gridColumnSpan: 4 },
//       },
//     },
//   ],
// });

// simpleDatagridPage({
//   table: "product",
//   toolbar: {
//     add: { type: "dialog" },
//   },
//   fields: { discontinued: { immutable: true } },
// });

// recordGridPage({
//   table: "product",
//   children: [
//     { type: "namedHeader", chips: ["discontinued"] },
//     {
//       type: "staticTableCard",
//       styles: { gridColumnSpan: 12, md: { gridColumnSpan: 6 } },
//       rows: [
//         "supplier",
//         "category",
//         "quantity_per_unit",
//         "unit_price",
//         "units_in_stock",
//         "units_on_order",
//         "reorder_level",
//       ],
//     },
//   ],
// });

// simpleDatagridPage({
//   table: "category",
//   toolbar: { add: { type: "dialog" } },
// });

// const reportsPage = new SimpleReportsPageBuilder();

// reportsPage.section("Sales");

// const dateRangeParams: ReportParameter[] = [
//   {
//     name: "start_date",
//     initialValue: `DATE '1997-05-06'`,
//     type: "Date",
//   },
//   {
//     name: "end_date",
//     initialValue: `date.add(year, 1, start_date)`,
//     type: "Date",
//   },
// ];

// const productSales = `
// with sales as (select
//   product,
//   sum((order_detail.unit_price * quantity) * (1 - discount)) as total
// from db.order
//   join db.order_detail on order.id = order_detail.order
// where order.order_date between start_date and end_date
// group by product
// order by total desc)
// select
//   category.name as category_name,
//   product.id as product_id,
//   product.name as product_name,
//   total
// from sales
//   join db.product on sales.product = product.id
//   join db.category on product.category = category.id
// `;

// reportsPage.table({
//   parameters: dateRangeParams,
//   name: "Sales by Product",
//   query: productSales,
//   columns: [
//     {
//       header: "Category",
//       cell: (r) => `${r}.category_name`,
//     },
//     {
//       header: "Product",
//       cell: (r) => `${r}.product_name`,
//       href: (r) => `'/products/' || ${r}.product_id`,
//     },
//     {
//       header: "Total",
//       cell: (r) => `format.currency(${r}.total, 'usd')`,
//     },
//   ],
// });

// const categorySales = `
// with sales as (select
//   category,
//   sum((order_detail.unit_price * quantity) * (1 - discount)) as total
// from db.order
//   join db.order_detail on order.id = order_detail.order
//   join db.product on order_detail.product = product.id
// where order.order_date between start_date and end_date
// group by category
// order by total desc)
// select
//   category.name as category_name,
//   total
// from sales
//   join db.category on sales.category = category.id
// `;

// reportsPage.table({
//   parameters: dateRangeParams,
//   name: "Sales by Category",
//   query: categorySales,
//   columns: [
//     {
//       header: "Category",
//       cell: (r) => `${r}.category_name`,
//     },
//     {
//       header: "Total",
//       cell: (r) => `format.currency(${r}.total, 'usd')`,
//     },
//   ],
// });

// const mostValuableCustomers = `
// with sales as (select
//   customer,
//   sum((order_detail.unit_price * quantity) * (1 - discount)) as total
// from db.order
//   join db.order_detail on order.id = order_detail.order
// where order.order_date between start_date and end_date
// group by customer
// order by total desc
// limit 15)
// select
//   customer.id as customer_id,
//   customer.company_name as customer_name,
//   total
// from sales
//   join db.customer on sales.customer = customer.id
// `;

// reportsPage.table({
//   parameters: dateRangeParams,
//   name: "Most valuable customers",
//   query: mostValuableCustomers,
//   columns: [
//     {
//       header: "Customer",
//       cell: (r) => `${r}.customer_name`,
//       href: (r) => `'/customers/' || ${r}.customer_id`,
//     },
//     {
//       header: "Total",
//       cell: (r) => `format.currency(${r}.total, 'usd')`,
//     },
//   ],
// });

// const mostValuableCities = `
// select
//   customer.city as city,
//   sum((order_detail.unit_price * quantity) * (1 - discount)) as total
// from db.order
//   join db.order_detail on order.id = order_detail.order
//   join db.customer on order.customer = customer.id
// where order.order_date between start_date and end_date
// group by customer.city
// order by total desc
// limit 15`;

// reportsPage.table({
//   parameters: dateRangeParams,
//   name: "Most valuable cities",
//   query: mostValuableCities,
//   columns: [
//     {
//       header: "City",
//       cell: (r) => `${r}.city`,
//     },
//     {
//       header: "Total",
//       cell: (r) => `format.currency(${r}.total, 'usd')`,
//     },
//   ],
// });

// reportsPage.section("Products");

// const productsAboveAveragePrice = `
// select
//   id,
//   name,
//   unit_price
// from db.product
// where unit_price > (select avg(unit_price) from db.product)
// order by unit_price desc
// `;

// reportsPage.table({
//   name: "Products above average price",
//   query: productsAboveAveragePrice,
//   columns: [
//     {
//       header: "Product",
//       cell: (r) => `${r}.name`,
//       href: (r) => `'/products/' || ${r}.id`,
//     },
//     {
//       header: "Unit Price",
//       cell: (r) => `format.currency(${r}.unit_price, 'usd')`,
//     },
//   ],
// });

// reportsPage.finish();

// dbManagementPage();
