import { system, types } from "@yolm/boost";
const { db } = system;

system.name = "tutorial";
system.region = "us-miami";
system.replicas = [{ region: "us-dallas", vcpus: 1 }];

db.table("contact", (table) => {
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").notNull();
  table.catalog.addressFields();
  table.linkable();
});

db.catalog.table.notes("contact");
db.catalog.table.attachments("contact");
db.catalog.tables.datagridView(["contact"]);

const app = system.apps.add("crm", "My CRM");
app.executionConfig = { canDownload: true };

app.shells.navbar({
  color: "primary",
  variant: "solid",
  links: ["/contacts"],
  searchDialog: {
    table: "contact",
    displayValues: ["email", "country"],
  },
});

app.pages.dashboardGrid((page) => {
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
        "email",
        "country",
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

app.pages.datagrid("contact", (page) => {
  page
    .viewButton()
    .selectable()
    .toolbar((toolbar) => toolbar.insertDialog().delete());
});

const halfStyles: types.StyleObject = {
  gridColumnSpan: 12,
  md: { gridColumnSpan: 6 },
};

app.pages.recordGrid("contact", (page) => {
  page
    .namedPageHeader()
    .addressCard({ styles: halfStyles })
    .attachmentsCard({ styles: halfStyles })
    .notesListCard({ styles: halfStyles })
    .addUpdateFormPage();
});

system.apps.admin();
