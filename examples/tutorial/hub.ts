import { hub } from "@yolm/boost";
const { db } = hub;

hub.name = "tutorial";
hub.region = "us-miami"

db.addTable("contact", (table) => {
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").notNull();
  table.catalog.addAddressFields();
  table.linkable();
});

db.catalog.addNotesTable("contact");
db.catalog.addAttachmentsTable("contact");

const app = hub.addApp("tutorial", "Tutorial");

app.title = "Tutorial";

app.useNavbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts", { label: "DB", url: "/db-management" }],
  searchDialog: {
    table: "contact",
    displayValues: ["email", "country"],
  },
});

app.pages.push({
  path: "/",
  content: "'hello world!'",
});

app.addDatagridPage("contact", (page) => {
  page
    .viewButton()
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete());
});

app.addRecordGridPage("contact", (page) => {
  page.namedPageHeader().addressCard({}).attachmentsCard({}).notesListCard({});
});

app.addDbManagementPage();
