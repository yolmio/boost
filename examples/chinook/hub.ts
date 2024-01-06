import { system, components } from "@yolm/boost";
const { db } = system;

system.name = "chinook";

//
// DATABASE
//

db.addTable("user", (table) => {
  table.catalog.addRequiredUserFields();
  table.bool("is_sys_admin").notNull().default("false");
  table.bool("is_admin").notNull().default("false");
  table.fk("employee");
});

db.addTable("album", (table) => {
  table.string("title", 160).notNull();
  table.fk("artist").notNull();
  table.linkable();
});

db.addTable("artist", (table) => {
  table.string("name", 120).notNull();
  table.linkable();
});

db.addTable("customer", (table) => {
  table.string("first_name", 40).notNull();
  table.string("last_name", 20).notNull();
  table.string("company", 80);
  table.catalog.addAddressFields();
  table.phoneNumber("phone").maxLength(24);
  table.string("fax", 24);
  table.email("email").maxLength(60).notNull();
  table.fk("support_rep", "employee");
  table.linkable();
});

db.addTable("employee", (table) => {
  table.string("last_name", 20).notNull();
  table.string("first_name", 20).notNull();
  table.string("title", 30);
  table.fk("reports_to", "employee");
  table.date("birth_date");
  table.date("hire_date");
  table.catalog.addAddressFields();
  table.string("phone", 24);
  table.string("fax", 24);
  table.string("email", 60);
  table.linkable();
});

db.addTable("genre", (table) => {
  table.string("name", 120).notNull();
});

db.addTable("invoice", (table) => {
  table.fk("customer").notNull();
  table.date("invoice_date").notNull();
  table.catalog.addAddressFields({
    prefix: "billing_",
    name: "billing_address",
  });
  table.money("total").notNull();
  table.linkable();
});

db.addTable("invoice_line", (table) => {
  table.fk("invoice").notNull();
  table.fk("track").notNull();
  table.money("unit_price").notNull();
  table.smallUint("quantity").notNull();
});

system.addEnum({
  name: "media_type",
  values: [
    { name: "mpeg", displayName: "MPEG audio file" },
    { name: "protected_aac", displayName: "Protected AAC audio file" },
    { name: "protected_mpeg4", displayName: "Protected MPEG-4 video file" },
    { name: "purchased_aac", displayName: "Purchased AAC audio file" },
    { name: "aac", displayName: "AAC audio file" },
  ],
});

db.addTable("playlist", (table) => {
  table.string("name", 120).notNull();
  table.linkable();
});

db.addTable("playlist_track", (table) => {
  table.fk("playlist").notNull();
  table.fk("track").notNull();
});

db.addTable("track", (table) => {
  table.string("name", 200).notNull();
  table.fk("album").notNull();
  table.enum("media_type").notNull();
  table.fk("genre").notNull();
  table.string("composer", 220);
  table.uint("milliseconds").notNull();
  table.uint("bytes");
  table.money("unit_price").notNull();
  table.linkable();
});

//
// UI
//

const app = system.addApp("chinook", "Chinook");

const isSysAdmin = `(select is_sys_admin from db.user from where id = current_user())`;
const isAdmin = `(select is_admin from db.user from where id = current_user())`;

app.useNavbarShell({
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

app.addDashboardGridPage((page) =>
  page
    .header({
      header: "'Chinhook Dashboard'",
      subHeader: "'Welcome back. Here''s whats going on'",
    })
    .statRow({
      header: `'Last 30 Days'`,
      stats: [
        {
          title: "'Invoices'",
          value: `(select count(*) from db.invoice where invoice_date > date.add(day, -30, ${today}))`,
          previous: `(select count(*) from db.invoice where invoice_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today}))`,
          trend: `cast((value - previous) as decimal(10, 2)) / cast(previous as decimal(10, 2))`,
        },
        {
          title: "'Income'",
          procedure: (s) =>
            s
              .scalar(
                `value_num`,
                `(select sum(total) from db.invoice where invoice_date > date.add(day, -30, ${today}))`,
              )
              .scalar(
                `previous_num`,
                `(select sum(total) from db.invoice where invoice_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today}))`,
              ),
          value: `format.currency(value_num, 'USD')`,
          previous: `format.currency(previous_num, 'USD')`,
          trend: `(value_num - previous_num) / previous_num`,
        },
        {
          title: "'Unique Tracks Sold'",
          value: `(select count(distinct track) from db.invoice join db.invoice_line on invoice.id = invoice_line.id where invoice_date > date.add(day, -30, ${today}))`,
          previous: `(select count(distinct track) from db.invoice join db.invoice_line on invoice.id = invoice_line.id where invoice_date between date.add(day, -60, ${today}) and date.add(day, -30, ${today})))`,
          trend: `cast((value - previous) as decimal(10, 2)) / cast(previous as decimal(10, 2))`,
        },
      ],
    })
    .table({
      query: newInvoices,
      header: "New Invoices",
      columns: [
        {
          cell: (row) =>
            components.button({
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
    })
    .barChart({
      header: "Sales By Genre",
      state: (s) =>
        s
          .table(
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
          limit 5`,
          )
          .table(
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
          from last_60`,
          )
          .table(
            "label",
            "select name from last_60 join db.genre on genre = genre.id",
          ),
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
    }),
);

app.addDatagridPage("customer", (page) => {
  page
    .viewButton()
    .selectable()
    .customFilterColumn({
      storageName: "purchased_track",
      expr: (value1) => `coalesce(
        'exists (select 1 from db.track
            join db.invoice_line
              on track.id = invoice_line.track
            join db.invoice
              on invoice.id = invoice_line.invoice
          where name like ''%'' || ' || literal.string(${value1}) || ' || ''%''
          and customer = record.id)',
          'true'
        )`,
      node: (helper) =>
        helper.debounceState(
          components.input({
            size: "sm",
            slots: {
              input: {
                props: { value: helper.value1 },
                on: {
                  input: (s) =>
                    s.statements(
                      helper.setValue1(
                        `case when target_value = '' then null else target_value end`,
                      ),
                      helper.debounceInputTriggerRefresh,
                    ),
                  blur: helper.debounceBlurHandler,
                },
              },
            },
          }),
        ),
    })
    .customSortColumn({
      storageName: "purchased_in_last_30_days",
      expr: (record) =>
        `(select sum(total) from db.invoice where customer = ${record}.id and invoice_date > date.add(day, -30, ${today}))`,
      sort: { type: "numeric" },
    })
    .toolbar((toolbar) => toolbar.insertDialog().delete())
    .virtualColumn({
      storageName: "invoice_count",
      expr: `(select count(*) from db.invoice where customer = record.id)`,
      filter: { type: "number", notNull: true },
      sort: { type: "numeric" },
    })
    .virtualColumn({
      storageName: "total_purchased",
      expr: `(select sum(total) from db.invoice where customer = record.id)`,
      filter: { type: "number", notNull: true },
      sort: { type: "numeric" },
    });
});

app.addRecordGridPage("customer", (page) => {
  page
    .namedPageHeader()
    .staticTableCard({
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      rows: ["company", "email", "phone", "fax", "support_rep"],
    })
    .addressCard({
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 4 },
      },
    })
    .simpleLinkRelationCard({
      table: "invoice",
      displayValues: ["invoice_date", "total", "billing_country"],
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 6 },
      },
    })
    .createUpdatePage();
});

app.addSimpleDatagridPage("album", (page) => {
  page
    .viewButton()
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete())
    .virtual({
      name: "track_count",
      expr: `(select count(*) from db.track where album = record.id)`,
      type: "BigInt",
    });
});

app.addRecordGridPage("album", (page) => {
  page
    .namedPageHeader()
    .simpleLinkRelationCard({
      table: "track",
      displayValues: ["media_type", "unit_price"],
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 6 },
      },
    })
    .createUpdatePage();
});

app.addSimpleDatagridPage("artist", (page) => {
  page
    .viewButton()
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete())
    .virtual({
      name: "album_count",
      expr: `(select count(*) from db.album where artist = record.id)`,
      type: "BigInt",
    });
});

app.addRecordGridPage("artist", (page) => {
  page
    .namedPageHeader()
    .simpleLinkRelationCard({
      table: "album",
      displayValues: [
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
    })
    .createUpdatePage();
});

app.addSimpleDatagridPage("genre", (page) => {
  page
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete())
    .virtual({
      expr: `(select count(*) from db.track where genre = record.id)`,
      name: "track_count",
      type: "BigInt",
    });
});

app.addSimpleDatagridPage("playlist", (page) => {
  page
    .selectable()
    .viewButton()
    .toolbar((toolbar) => toolbar.insertDialog().delete())
    .virtual({
      expr: `(select count(*) from db.playlist_track where playlist = record.id)`,
      name: "track_count",
      type: "BigInt",
    });
});

app.addRecordGridPage("playlist", (page) => {
  page
    .namedPageHeader()
    .simpleLinkAssociationCard({
      table: "track",
      displayValues: ["album", "unit_price"],
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 6 },
      },
    })
    .createUpdatePage();
});

app.addDatagridPage("track", (page) => {
  page
    .viewButton()
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete())
    .virtualColumn({
      storageName: "purchase_count",
      expr: `(select count(*) from db.invoice_line where track = record.id)`,
      filter: { type: "number", notNull: true },
      sort: { type: "numeric" },
    });
});

app.addRecordGridPage("track", (page) => {
  page
    .namedPageHeader()
    .staticTableCard({
      rows: [
        "media_type",
        "genre",
        "album",
        "composer",
        "milliseconds",
        "bytes",
        "unit_price",
        {
          label: "'Purchase Count'",
          expr: `(select count(*) from db.invoice_line where track = ${page.recordId})`,
        },
      ],
      styles: {
        gridColumnSpan: 12,
      },
    })
    .createUpdatePage();
});

app.addDatagridPage("invoice", (page) => {
  page
    .viewButton()
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete());
});

app.addRecordGridPage("invoice", (page) => {
  page
    .superSimpleHeader({ header: "Invoice" })
    .staticTableCard({
      styles: {
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 8 },
      },
      rows: ["invoice_date", "total"],
    })
    .addressCard({
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 4 },
      },
      header: `'Billing Address'`,
      group: "billing_address",
    })
    .relatedTable({
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
    })
    .createUpdatePage();
});

app.addDbManagementPage();
