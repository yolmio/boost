import { app } from "@yolm/boost";
const { db, ui } = app;

app.name = "tutorial";
app.title = "Tutorial";
app.displayName = "Tutorial";

// db

db.addTable("contact", (table) => {
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").notNull();
  table.catalog.addAddressFields();
});

// ui

ui.useNavbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts", "/reports", { label: "DB", url: "/db-management" }],
});

ui.pages.push({
  path: "/",
  content: "'hello world!'",
});

ui.addDatagridPage("contact", (page) => {
  page.toolbar((toolbar) => toolbar.insertDialog());
});

ui.addDbManagementPage();
