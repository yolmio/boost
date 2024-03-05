import { system } from "@yolm/boost";
const { db } = system;

system.name = "tutorial";
system.region = "us-miami";
system.replicas = [{ region: "us-dallas", vcpus: 1 }];

db.addTable("contact", (table) => {
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").notNull();
  table.catalog.addAddressFields();
  table.linkable();
});

db.catalog.addNotesTable("contact");
db.catalog.addAttachmentsTable("contact");

db.catalog.addDatagridViewTables(["contact"]);

const app = system.addApp("crm", "My CRM");
app.executionConfig = { canDownload: true };

app.useNavbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts"],
  searchDialog: {
    table: "contact",
    displayValues: ["email", "country"],
  },
});

app.addDashboardGridPage((page) => {
  page
    .statRow({
      header: "'Contacts'",
      stats: [
        {
          title: "'Total Contacts'",
          value: "(select count(*) from contact)",
        },
        {
          title: "'Average Email Length'",
          value:
            "(select format.decimal(avg(char_length(email))) from contact)",
        },
      ],
    })
    .table({
      header: "New Contacts",
      query: `select id, first_name, last_name, email, country from contact order by id desc limit 5`,
      columns: [
        {
          cell: (row) => `${row}.first_name || ' ' || ${row}.last_name`,
          href: (row) => `'/contacts/' || ${row}.id`,
          header: "Name",
        },
        {
          cell: (row) => `${row}.email`,
          header: "Email",
        },
        {
          cell: (row) => `${row}.country`,
          header: "Country",
        },
      ],
    })
    .pieChart({
      header: "Contacts by Country",
      state: `select country, count(*) as count from contact where country is not null group by country`,
      cardStyles: { minHeight: "200px", lg: { minHeight: "350px" } },
      pieChartOpts: {
        labels: `select country from result`,
        series: `select count from result`,
        labelPosition: "'outside'",
        labelDirection: "'explode'",
        labelOffset: "16",
      },
    });
});

app.addDatagridPage("contact", (page) => {
  page
    .viewButton()
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete());
});

const halfStyles = { gridColumnSpan: 12, md: { gridColumnSpan: 6 } };

app.addRecordGridPage("contact", (page) => {
  page
    .namedPageHeader()
    .addressCard({ styles: halfStyles })
    .attachmentsCard({ styles: halfStyles })
    .notesListCard({ styles: halfStyles })
    .createUpdatePage();
});

system.addAdminApp();
