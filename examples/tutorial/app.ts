import { app } from "@yolm/boost";
const { db, ui } = app;

app.name = "tutorial";
app.title = "Tutorial";
app.displayName = "Tutorial";

db.addTable("contact", (table) => {
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").notNull();
  table.catalog.addAddressFields();
  table.linkable();
});

db.catalog.addNotesTable("contact");
db.catalog.addAttachmentsTable("contact");

ui.useNavbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts", { label: "DB", url: "/db-management" }],
  searchDialog: {
    table: "contact",
    displayValues: ["email", "country"],
  },
});

ui.pages.push({
  path: "/",
  content: "'hello world!'",
});

ui.addDatagridPage("contact", (page) => {
  page
    .viewButton()
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete());
});

ui.addRecordGridPage("contact", (page) => {
  page.namedPageHeader().addressCard({}).attachmentsCard({}).notesListCard({});
});

ui.addDbManagementPage();
