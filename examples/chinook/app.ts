import { addEnum, addTable } from "@yolm/boost/appHelpers";
import { navbarShell } from "@yolm/boost/shells/navbar";
import { datagridPage } from "@yolm/boost/pages/datagrid";
import { dbManagementPage } from "@yolm/boost/pages/dbManagement";
import { recordGridPage } from "@yolm/boost/pages/recordGrid";
import { simpleDatagridPage } from "@yolm/boost/pages/simpleDatagrid";
import { app } from "@yolm/boost/singleton";

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
});

addTable("artist", (table) => {
  table.string("name", 120).notNull();
  table.linkable();
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
    { showIf: isSysAdmin, url: "/db-management" },
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

datagridPage({ table: "customer", viewButton: true });

recordGridPage({
  table: "customer",
  children: [
    { type: "namedHeader" },
    {
      type: "staticTableCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      rows: ["company", "email", "phone", "fax", "support_rep"],
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
      displayValues: ["invoice_date", "total", "billing_country"],
      styles: {
        alignSelf: "start",
        gridColumnSpan: 12,
        lg: { gridColumnSpan: 6 },
      },
    },
  ],
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
  children: [{ type: "namedHeader" }],
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
  children: [{ type: "namedHeader" }],
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
  children: [{ type: "namedHeader" }],
});

datagridPage({ table: "track", viewButton: true });

recordGridPage({
  table: "track",
  children: [{ type: "namedHeader" }],
});

datagridPage({ table: "invoice", viewButton: true });

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
      rows: ["invoice_date", "total"],
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
});

dbManagementPage();
