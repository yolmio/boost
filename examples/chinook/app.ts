import { addEnum, addTable } from "@yolm/boost/appHelpers";
import { navbarShell } from "@yolm/boost/shells/navbar";
import { datagridPage } from "@yolm/boost/pages/datagrid";
import { dbManagementPage } from "@yolm/boost/pages/dbManagement";
import { recordGridPage } from "@yolm/boost/pages/recordGrid";
import { simpleDatagridPage } from "@yolm/boost/pages/simpleDatagrid";
import { app } from "@yolm/boost/singleton";
import { button } from "@yolm/boost/components/button";
import { dashboardGridPage } from "@yolm/boost/pages/dashboardGrid";
import { scalar, table } from "@yolm/boost/procHelpers";

/*

Boost/platform todos

immutable datagrid based off current user
filter/virtual fields
Different pages/views for different users

*/

app.name = "chinook";
app.title = "Chinook";
app.displayName = "Chinook";

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
  table.linkable();
  table.virtualField({
    expr: (id) => `(select count(*) from db.track where album = ${id})`,
    fields: ["id"],
    name: "track_count",
    type: { type: "BigInt" },
  });
});

addTable("artist", (table) => {
  table.string("name", 120).notNull();
  table.linkable();
  table.virtualField({
    expr: (id) => `(select count(*) from db.album where artist = ${id})`,
    fields: ["id"],
    name: "album_count",
    type: { type: "BigInt" },
  });
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
  table.linkable();
  table.virtualField({
    expr: (id) => `(select count(*) from db.invoice where customer = ${id})`,
    fields: ["id"],
    name: "invoice_count",
    type: { type: "BigInt" },
  });
  table.virtualField({
    expr: (id) => `(select sum(total) from db.invoice where customer = ${id})`,
    fields: ["id"],
    name: "total_purchased",
    type: { type: "BigInt" },
  });
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
  table.linkable();
});

addTable("genre", (table) => {
  table.string("name", 120).notNull();
  table.virtualField({
    expr: (id) => `(select count(*) from db.track where genre = ${id})`,
    fields: ["id"],
    name: "track_count",
    type: { type: "BigInt" },
  });
});

addTable("invoice", (table) => {
  table.fk("customer").notNull();
  table.date("invoice_date").notNull();
  table.fieldGroupFromCatalog({
    type: "address",
    prefix: "billing_",
    name: "billing_address",
  });
  table.money("total").notNull();
  table.linkable();
});

addTable("invoice_line", (table) => {
  table.fk("invoice").notNull();
  table.fk("track").notNull();
  table.money("unit_price").notNull();
  table.smallUint("quantity").notNull();
});

addEnum({
  values: [
    { name: "mpeg", displayName: "MPEG audio file" },
    { name: "protected_aac", displayName: "Protected AAC audio file" },
    { name: "protected_mpeg4", displayName: "Protected MPEG-4 video file" },
    { name: "purchased_aac", displayName: "Purchased AAC audio file" },
    { name: "aac", displayName: "AAC audio file" },
  ],
  name: "media_type",
  withDisplayDt: true,
});

addTable("playlist", (table) => {
  table.string("name", 120).notNull();
  table.linkable();
  table.virtualField({
    expr: (id) =>
      `(select count(*) from db.playlist_track where playlist = ${id})`,
    fields: ["id"],
    name: "track_count",
    type: { type: "BigInt" },
  });
});

addTable("playlist_track", (table) => {
  table.fk("playlist").notNull();
  table.fk("track").notNull();
});

addTable("track", (table) => {
  table.string("name", 200).notNull();
  table.fk("album").notNull();
  table.enum("media_type").notNull();
  table.fk("genre").notNull();
  table.string("composer", 220);
  table.uint("milliseconds").notNull();
  table.uint("bytes");
  table.money("unit_price").notNull();
  table.linkable();
  table.virtualField({
    expr: (id) => `(select count(*) from db.invoice_line where track = ${id})`,
    fields: ["id"],
    name: "purchase_count",
    type: { type: "BigInt" },
  });
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
    "/albums",
    "/artists",
    "/genres",
    "/playlists",
    "/invoices",
    "/tracks",
    { showIf: isAdmin, url: "/employees" },
    { showIf: isAdmin, url: "/users" },
    { showIf: isSysAdmin, url: "/db-management", label: "DB" },
  ],
  multiTableSearchDialog: {
    tables: [
      {
        name: "employee",
        displayValues: ["title"],
        icon: "Badge",
      },
      {
        name: "customer",
        displayValues: ["company", "email"],
        icon: "Person",
      },
      {
        name: "album",
        displayValues: ["artist"],
        icon: "Album",
      },
      {
        name: "track",
        displayValues: ["album", "genre", "composer"],
        icon: "Audiotrack",
      },
      {
        name: "playlist",
        icon: "PlaylistPlay",
      },
    ],
  },
});

// In an application that has data not from 2013, you should replace this with `today()`
const today = `DATE '2013-12-22'`;

const newInvoices = `
select
  invoice.id as invoice_id,
  invoice_date,
  customer.first_name || ' ' || customer.last_name as customer_name,
  customer.id as customer_id,
  employee.first_name || ' ' || employee.last_name as employee_name,
  employee.id as employee_id
from db.invoice
  join db.customer on customer = customer.id
  join db.employee on support_rep = employee.id
order by invoice_date desc
limit 5`;

dashboardGridPage({
  children: [
    {
      type: "header",
      header: `'Chinhook Dashboard'`,
      subHeader: "'Welcome back. Here''s whats going on'",
    },
    {
      type: "threeStats",
      header: `'Last 30 Days'`,
      left: {
        title: "'Invoices'",
        value: `(select count(*) from db.invoice where invoice_date > date.add(day, -30, ${today}))`,
        previous: `(select count(*) from db.invoice where invoice_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today}))`,
        trend: `cast((value - previous) as decimal(10, 2)) / cast(previous as decimal(10, 2))`,
      },
      middle: {
        title: "'Income'",
        procedure: [
          scalar(
            `value_num`,
            `(select sum(total) from db.invoice where invoice_date > date.add(day, -30, ${today}))`
          ),
          scalar(
            `previous_num`,
            `(select sum(total) from db.invoice where invoice_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today}))`
          ),
        ],
        value: `format.currency(value_num, 'USD')`,
        previous: `format.currency(previous_num, 'USD')`,
        trend: `(value_num - previous_num) / previous_num`,
      },
      right: {
        title: "'Unique Tracks Sold'",
        value: `(select count(distinct track) from db.invoice join db.invoice_line on invoice.id = invoice_line.id where invoice_date > date.add(day, -30, ${today}))`,
        previous: `(select count(distinct track) from db.invoice join db.invoice_line on invoice.id = invoice_line.id where invoice_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today})))`,
        trend: `cast((value - previous) as decimal(10, 2)) / cast(previous as decimal(10, 2))`,
      },
    },
    {
      type: "table",
      query: newInvoices,
      header: "New Invoices",
      columns: [
        {
          cell: (row) =>
            button({
              href: `'/invoices/' || ${row}.invoice_id`,
              color: "primary",
              size: "sm",
              variant: "soft",
              children: `'View'`,
            }),
          header: "",
        },
        {
          cell: (row) => `${row}.customer_name`,
          href: (row) => `'/customers/' || ${row}.customer_id`,
          header: "Customer",
        },
        {
          cell: (row) => `${row}.employee_name`,
          href: (row) => `'/employees/' || ${row}.employee_id`,
          header: "Support Rep",
        },
        {
          cell: (row) => `format.date(${row}.invoice_date, '%-d %b')`,
          header: "Invoice Date",
        },
      ],
    },
    {
      type: "barChart",
      header: "Sales By Genre",
      state: [
        table(
          "last_60",
          `select
            genre,
            sum(quantity * invoice_line.unit_price) as sales
          from db.invoice
            join db.invoice_line on invoice = invoice.id
            join db.track on track = track.id
          where invoice_date > date.add(day, -60, ${today})
          group by genre
          order by sales desc
          limit 5`
        ),
        table(
          "last_30",
          `select
            genre,
            (select
              sum(quantity * invoice_line.unit_price)
            from db.invoice
              join db.invoice_line on invoice = invoice.id
              join db.track on track = track.id
            where invoice_date > date.add(day, -30, ${today}) and track.genre = last_60.genre
            ) as sales
          from last_60`
        ),
        table(
          "label",
          "select name from last_60 join db.genre on genre = genre.id"
        ),
      ],
      series: [
        {
          query: "select sales as y, genre as x from last_30",
          name: "Last 30 Days",
        },
        {
          query: "select sales as y, genre as x from last_60",
          name: "Last 60 Days",
        },
      ],
      labels: "select name from label",
      axisY: {
        labelInterpolation:
          "'$' || format.decimal(cast(label as decimal(28, 10)))",
      },
    },
  ],
});

datagridPage({
  table: "customer",
  viewButton: true,
  toolbar: { add: { type: "dialog" } },
});

recordGridPage({
  table: "customer",
  children: [
    { type: "namedHeader" },
    {
      type: "staticTableCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      rows: () => ["company", "email", "phone", "fax", "support_rep"],
    },
    {
      type: "addressCard",
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 4 },
      },
    },
    {
      type: "simpleLinkRelationCard",
      table: "invoice",
      displayValues: () => ["invoice_date", "total", "billing_country"],
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 6 },
      },
    },
  ],
  createUpdatePage: true,
});

simpleDatagridPage({
  table: "album",
  toolbar: {
    add: { type: "dialog" },
  },
  viewButton: true,
});

recordGridPage({
  table: "album",
  children: [
    { type: "namedHeader" },
    {
      type: "simpleLinkRelationCard",
      table: "track",
      displayValues: () => ["media_type", "unit_price"],
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 6 },
      },
    },
  ],
  createUpdatePage: true,
});

simpleDatagridPage({
  table: "artist",
  toolbar: {
    add: { type: "dialog" },
  },
  viewButton: true,
});

recordGridPage({
  table: "artist",
  children: [
    { type: "namedHeader" },
    {
      type: "simpleLinkRelationCard",
      table: "album",
      displayValues: () => [
        {
          expr: `(select count(*) from db.track where album = album.id)`,
          label: "Track Count",
          display: (e) => e,
        },
      ],
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 6 },
      },
    },
  ],
  createUpdatePage: true,
});

simpleDatagridPage({
  table: "genre",
  toolbar: {
    add: { type: "dialog" },
  },
});

simpleDatagridPage({
  table: "playlist",
  toolbar: {
    add: { type: "dialog" },
  },
  viewButton: true,
});

recordGridPage({
  table: "playlist",
  children: [
    { type: "namedHeader" },
    {
      type: "simpleLinkAssociationCard",
      table: "track",
      displayValues: () => ["album", "unit_price"],
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 6 },
      },
    },
  ],
  createUpdatePage: true,
});

datagridPage({
  table: "track",
  viewButton: true,
  toolbar: { add: { type: "dialog" } },
});

recordGridPage({
  table: "track",
  children: [
    { type: "namedHeader" },
    {
      type: "staticTableCard",
      rows: (ctx) => [
        "media_type",
        "genre",
        "album",
        "composer",
        "milliseconds",
        "bytes",
        "unit_price",
        {
          label: "'Purchase Count'",
          expr: `(select count(*) from db.invoice_line where track = ${ctx.recordId})`,
        },
      ],
      styles: {
        gridColumnSpan: 12,
      },
    },
  ],
  createUpdatePage: true,
});

datagridPage({
  table: "invoice",
  viewButton: true,
  toolbar: { add: { type: "dialog" } },
});

recordGridPage({
  table: "invoice",
  children: [
    { type: "superSimpleHeader", header: "Invoice" },
    {
      type: "staticTableCard",
      styles: {
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 8 },
      },
      rows: () => ["invoice_date", "total"],
    },
    {
      type: "addressCard",
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 4 },
      },
      header: `'Billing Address'`,
      group: "billing_address",
    },
    {
      type: "relatedTable",
      table: "invoice_line",
      addButtonText: "'Add Line'",
      fields: [
        "track",
        {
          label: "Album",
          expr: (detail) =>
            `(select album.title from db.track join db.album on track.album = album.id where track.id = ${detail}.track)`,
        },
        "unit_price",
        "quantity",
        {
          expr: (detail) =>
            `format.currency(cast((${detail}.unit_price * ${detail}.quantity) as decimal(10, 2)), 'usd')`,
          label: "Total",
        },
      ],
    },
  ],
  createUpdatePage: true,
});

dbManagementPage();
