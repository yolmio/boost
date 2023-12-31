// generated by yolm csv-analyze
import { system } from "@yolm/boost";

system.addScriptDbDefinition("csv", (db) => {
  db.addTable("media_type", (table) => {
    table.tinyUint("MediaTypeId").notNull();
    table.string("Name", 27).notNull();
  });
  db.addTable("employee", (table) => {
    table.tinyUint("EmployeeId").notNull();
    table.string("LastName", 8).notNull();
    table.string("FirstName", 8).notNull();
    table.string("Title", 19).notNull();
    table.tinyUint("ReportsTo");
    table.string("BirthDate", 19).notNull();
    table.string("HireDate", 19).notNull();
    table.string("Address", 27).notNull();
    table.string("City", 10).notNull();
    table.string("State", 2).notNull();
    table.string("Country", 6).notNull();
    table.string("PostalCode", 7).notNull();
    table.string("Phone", 17).notNull();
    table.string("Fax", 17).notNull();
    table.string("Email", 24).notNull();
  });
  db.addTable("genre", (table) => {
    table.tinyUint("GenreId").notNull();
    table.string("Name", 18).notNull();
  });
  db.addTable("customer", (table) => {
    table.tinyUint("CustomerId").notNull();
    table.string("FirstName", 10).notNull();
    table.string("LastName", 13).notNull();
    table.string("Company", 49);
    table.string("Address", 41).notNull();
    table.string("City", 21).notNull();
    table.string("State", 6);
    table.string("Country", 14).notNull();
    table.string("PostalCode", 10);
    table.string("Phone", 19);
    table.string("Fax", 18);
    table.string("Email", 29).notNull();
    table.tinyUint("SupportRepId").notNull();
  });
  db.addTable("album", (table) => {
    table.smallUint("AlbumId").notNull();
    table.string("Title", 95).notNull();
    table.smallUint("ArtistId").notNull();
  });
  db.addTable("artist", (table) => {
    table.smallUint("ArtistId").notNull();
    table.string("Name", 85).notNull();
  });
  db.addTable("playlist", (table) => {
    table.tinyUint("PlaylistId").notNull();
    table.string("Name", 26).notNull();
  });
  db.addTable("invoice", (table) => {
    table.smallUint("InvoiceId").notNull();
    table.tinyUint("CustomerId").notNull();
    table.string("InvoiceDate", 19).notNull();
    table.string("BillingAddress", 41).notNull();
    table.string("BillingCity", 21).notNull();
    table.string("BillingState", 6);
    table.string("BillingCountry", 14).notNull();
    table.string("BillingPostalCode", 10);
    table.decimal("Total", { precision: 4, scale: 2, signed: false }).notNull();
  });
  db.addTable("invoice_item", (table) => {
    table.smallUint("InvoiceLineId").notNull();
    table.smallUint("InvoiceId").notNull();
    table.smallUint("TrackId").notNull();
    table
      .decimal("UnitPrice", { precision: 3, scale: 2, signed: false })
      .notNull();
    table.tinyUint("Quantity").notNull();
  });
  db.addTable("playlist_track", (table) => {
    table.tinyUint("PlaylistId").notNull();
    table.smallUint("TrackId").notNull();
  });
  db.addTable("track", (table) => {
    table.smallUint("TrackId").notNull();
    table.string("Name", 123).notNull();
    table.smallUint("AlbumId").notNull();
    table.tinyUint("MediaTypeId").notNull();
    table.tinyUint("GenreId").notNull();
    table.string("Composer", 188);
    table.uint("Milliseconds").notNull();
    table.uint("Bytes").notNull();
    table
      .decimal("UnitPrice", { precision: 3, scale: 2, signed: false })
      .notNull();
  });
});
