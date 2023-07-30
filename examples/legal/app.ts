import { navbarShell } from "@yolm/boost/shells/navbar";
import {
  addEnum,
  addScalarFunction,
  addTable,
  addTableFromCatalog,
} from "@yolm/boost/modelHelpers";
import {
  addUsers,
  if_,
  modify,
  navigate,
  removeUsers,
  returnExpr,
  scalar,
  setScalar,
} from "@yolm/boost/procHelpers";
import { dbManagementPage } from "@yolm/boost/pages/dbManagement";
import { datagridPage } from "@yolm/boost/pages/datagrid";
import { simpleDatagridPage } from "@yolm/boost/pages/simpleDatagrid";
import { recordGridPage } from "@yolm/boost/pages/recordGrid";
import { dashboardGridPage } from "@yolm/boost/pages/dashboardGrid";
import { insertFormPage } from "@yolm/boost/pages/insertForm";
import { updateFormPage } from "@yolm/boost/pages/updateForm";
import { button } from "@yolm/boost/components/button";
import { multiCardInsertPage } from "@yolm/boost/pages/multiCardInsert";
import { typography } from "@yolm/boost/components/typography";
import { materialIcon } from "@yolm/boost/components/materialIcon";
import { model } from "@yolm/boost/singleton";
import { element } from "@yolm/boost/nodeHelpers";
import {
  ReportParameter,
  SimpleReportsPageBuilder,
} from "@yolm/boost/pages/simpleReportPage";
import { card } from "@yolm/boost/components/card";
import { iconButton } from "@yolm/boost/components/iconButton";
import { ServiceProcStatement } from "@yolm/boost/yom";

model.name = "legal";
model.title = "Legal";
model.displayName = "Legal";

/* 

todos:

Simple timeline for matters
reports
dashboard
theme

Adventure works
hello world with contact list with datagrid and search

dev mode
fix focus trap in dialog

boost/platform stuff:

Make default value show up in forms
validate sections are not empty in reports page

*/

//
// DATABASE
//

addTable("user", (table) => {
  table.fieldGroupFromCatalog({ type: "requiredUserFields" });
  table.bool("is_sys_admin").notNull().default("false");
  table.bool("is_admin").notNull().default("false");
  table.fk("employee");
});

addTable("employee", (table) => {
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").notNull();
});

addEnum({
  name: "contact_type",
  values: ["prospect", "client", "lead", "other"],
  withDisplayDt: true,
});

addTable("contact", (table) => {
  table.enum("type", "contact_type").notNull();
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").maxLength(500);
  table.phoneNumber("phone_number");
  table.date("date_of_birth");
  table.fieldGroupFromCatalog({ type: "address" });
  table.bool("mailing_list").notNull().default("false");

  table.linkable();

  table.virtualField({
    name: "remaining_minutes",
    fields: ["id"],
    expr: (id) => `sfn.remaining_minutes(${id})`,
    type: { type: "Int", usage: { type: "Duration", size: "minutes" } },
  });
});

addTableFromCatalog({ type: "notes", mainTable: "contact" });
addTableFromCatalog({ type: "attachments", mainTable: "contact" });

addEnum({
  name: "matter_type",
  values: ["civil", "corporate", "criminal", "family", "other"],
  withDisplayDt: true,
});

addEnum({
  name: "client_position",
  values: [
    "plaintiff",
    "defendant",
    "appellant",
    "co_defendant",
    "petitioner",
    "petitioned_against",
    "respondent",
  ],
  withDisplayDt: true,
});

addTable("matter", (table) => {
  table.enum("type", "matter_type").notNull();
  table.string("name", 100).notNull();
  table.fk("contact").notNull();
  table.fk("employee").notNull();
  table.enum("client_position").notNull();
  table.date("date").notNull();
  table.date("close_date");
  table.string("notes", 2000).multiline();
  table.linkable();
});

addTableFromCatalog({ type: "attachments", mainTable: "matter" });

addTable("time_entry", (table) => {
  table.fk("matter").notNull().onDelete("Restrict");
  table.fk("employee").notNull().onDelete("Restrict");
  table.date("date").notNull();
  table.minutesDuration("minutes", "SmallUint").notNull();
  table.bool("billable").notNull().default("true");
  table.string("note", 500).multiline();
});

addTable("payment", (table) => {
  table.fk("contact").notNull();
  table.money("cost", { precision: 10, scale: 2 }).notNull();
  table.minutesDuration("minutes", "Uint").notNull();
  table.date("date").notNull();
  table.string("invoice_id", 50).notNull();
});

addScalarFunction({
  name: "remaining_minutes",
  bound: true,
  parameters: [
    {
      name: "contact",
      type: "BigInt",
      notNull: true,
    },
  ],
  returnType: "Int",
  procedure: [
    returnExpr(
      `coalesce((select sum(minutes) from db.payment where contact = input.contact), 0) -
        coalesce((select sum(minutes) from db.time_entry where matter in (select id from db.matter where contact = input.contact) and billable), 0)`
    ),
  ],
});

//
// UI
//

const isSysAdmin = `(select is_sys_admin from db.user from where id = current_user())`;

navbarShell({
  color: "primary",
  variant: "solid",
  links: [
    "/contacts",
    "/matters",
    "/time-entries",
    "/reports",
    {
      showIf: isSysAdmin,
      url: "/employees",
    },
    {
      showIf: isSysAdmin,
      url: "/users",
    },
    {
      showIf: isSysAdmin,
      url: "/db-management",
      label: "DB",
    },
  ],
  primaryActionButton: {
    color: "harmonize",
    variant: "solid",
    size: "sm",
    children: `'Add Time Entries'`,
    href: "'/time-entries/add'",
    startDecorator: materialIcon("Add"),
  },
  multiTableSearchDialog: {
    tables: [
      {
        name: "matter",
        displayValues: ["type", "client_position"],
        icon: "Gavel",
      },
      {
        name: "contact",
        displayValues: ["type", "email"],
        icon: "Person",
      },
    ],
  },
});

const dashboardCardStyles = {
  gridColumnSpan: "full",
  lg: { gridColumnSpan: 6 },
};

dashboardGridPage({
  children: [
    {
      type: "custom",
      content: () =>
        card({
          variant: "soft",
          color: "primary",
          styles: dashboardCardStyles,
          children: element("div", {
            styles: { display: "flex", flexDirection: "column" },
            children: [
              typography({
                level: "h5",
                children: `'Welcome to the Example Legal Application'`,
              }),
              typography({
                level: "body1",
                children: `'A real application would be tweaked to whatever the business needs, but this should give you a good idea of what is possible'`,
              }),
            ],
          }),
        }),
    },
  ],
});

const thirdStyles = {
  gridColumnSpan: 12,
  md: { gridColumnSpan: 6 },
  lg: { gridColumnSpan: 4 },
};
const halfStyles = { gridColumnSpan: 12, md: { gridColumnSpan: 6 } };
const boolFieldStyles = {
  gridColumnSpan: 6,
  sm: { gridColumnSpan: 3 },
};

const contactFormSections = [
  {
    header: "General Information",
    parts: [
      { field: "type", styles: thirdStyles },
      { field: "first_name", styles: thirdStyles },
      { field: "last_name", styles: thirdStyles },
      { field: "email", styles: halfStyles },
      { field: "phone_number", styles: halfStyles },
      {
        field: "date_of_birth",
        styles: {
          gridColumnStart: 1,
          gridColumnEnd: 12,
          sm: { gridColumnEnd: 7 },
        },
      },
      { field: "mailing_list", styles: boolFieldStyles },
    ],
  },
  {
    header: "Address",
    parts: [
      { field: "street", label: "Street", styles: halfStyles },
      { field: "city", label: "City", styles: thirdStyles },
      { field: "state", label: "State", styles: thirdStyles },
      { field: "zip", label: "Zip", styles: thirdStyles },
      { field: "country", label: "Country", styles: thirdStyles },
    ],
  },
];

insertFormPage({
  table: "contact",
  content: {
    type: "TwoColumnSectioned",
    sections: contactFormSections,
  },
  afterTransactionCommit: () => [navigate(`'/contacts'`)],
});

updateFormPage({
  table: "contact",
  content: {
    type: "TwoColumnSectioned",
    sections: contactFormSections,
  },
  afterTransactionCommit: () => [navigate(`'/contacts/' || ui.record_id`)],
});

datagridPage({
  table: "contact",
  selectable: true,
  toolbar: {
    add: { type: "href", href: "/contacts/add" },
    export: true,
    delete: true,
  },
  viewButton: true,
});

const remainingHoursStyles = {
  color: "text-secondary",
  my: 0,
  "& .positive": { color: "text-primary", fontWeight: "lg" },
  "& .negative": { color: "danger-400", fontWeight: "lg" },
};

function remainingHoursDisplay(label: string, value: string) {
  return element("p", {
    styles: remainingHoursStyles,
    children: [
      label,
      element("span", {
        dynamicClasses: [
          { classes: "positive", condition: `${value} > 0` },
          {
            classes: "negative",
            condition: `${value} < 0`,
          },
        ],
        children: `sfn.display_minutes_duration(${value})`,
      }),
    ],
  });
}

recordGridPage({
  table: "contact",
  children: [
    {
      type: "namedHeader",
      chips: ["mailing_list"],
      subHeader: "dt.display_contact_type(type)",
    },
    {
      type: "twoColumnDisplayCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      cells: ["date_of_birth", "email", "phone_number"],
    },
    {
      type: "addressCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 4 } },
    },
    {
      type: "notesListCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 6 } },
    },
    {
      type: "attachmentsCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 6 } },
    },
    {
      type: "relatedRecordsTimeline",
      dateField: "date",
      timelineHeader: `'Timeline'`,
      additionalState: () => [
        scalar(`remaining_minutes`, `sfn.remaining_minutes(ui.record_id)`),
      ],
      afterHeaderNode: () =>
        element("div", {
          styles: { display: "flex", gap: 2, pt: 1, pb: 2, px: 1 },
          children: [
            remainingHoursDisplay(
              `'Remaining paid hours: '`,
              `remaining_minutes`
            ),
          ],
        }),
      sources: (ctx) => [
        {
          table: "matter",
          customFrom: `from db.matter where contact = ${ctx.recordId} and close_date is not null`,
          dateExpr: `close_date`,
          icon: {
            styles: { backgroundColor: "success-500" },
            content: materialIcon("Done"),
          },
          itemContent: {
            type: "RecordDefault",
            headerValues: ["id", "name"],
            header: (id, name) => [
              `'Close ' `,
              element("a", {
                styles: {
                  color: "primary-500",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                },
                props: { href: `'/matters/' || ${id}` },
                children: name,
              }),
            ],
            disableDefaultAction: true,
            displayValues: ["type", "client_position"],
          },
          disableInsert: true,
        },
        {
          table: "time_entry",
          customFrom: `from db.time_entry where matter in (select id from db.matter where matter.contact = ${ctx.recordId})`,
          icon: {
            styles: { backgroundColor: "primary-500" },
            content: materialIcon("AccessTimeFilledOutlined"),
          },
          itemContent: {
            type: "RecordDefault",
            header: () => `'Time entry'`,
            displayValues: ["matter", "minutes", "billable", "note"],
          },
        },
        {
          table: "matter",
          customFrom: `from db.matter where contact = ${ctx.recordId}`,
          icon: {
            styles: { backgroundColor: "primary-300" },
            content: materialIcon("Gavel"),
          },
          itemContent: {
            type: "RecordDefault",
            headerValues: ["id", "name"],
            header: (id, name) => [
              `'Start ' `,
              element("a", {
                styles: {
                  color: "primary-500",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                },
                props: { href: `'/matters/' || ${id}` },
                children: name,
              }),
            ],
            disableDefaultAction: true,
            displayValues: ["type", "client_position"],
          },
          disableInsert: true,
        },
        {
          table: "payment",
          icon: {
            styles: { backgroundColor: "success-300" },
            content: materialIcon("Receipt"),
          },
          itemContent: {
            type: "RecordDefault",
            header: () => `'Payment'`,
            displayValues: ["cost", "invoice_id"],
          },
        },
      ],
    },
  ],
});

simpleDatagridPage({
  table: "employee",
  toolbar: {
    add: {
      type: "dialog",
      opts: {
        beforeTransactionCommit: (state) => [
          addUsers(
            `select ${state.fields.get(
              "email"
            )} as email, next_record_id(db.user) as db_id, 'none' as notification_type`,
            "added_user"
          ),
          modify(
            `insert into db.user (global_id, is_sys_admin, is_admin, disabled, email, employee) values ((select global_id from added_user), false, false, false, ${state.fields.get(
              "email"
            )}, last_record_id(db.employee))`
          ),
        ],
      },
    },
  },
  fields: {
    email: {
      beforeEdit: (newValue, recordId) => [
        scalar(
          `user_id`,
          `(select id from db.user where employee = ${recordId})`
        ),
        modify(`update db.user set email = ${newValue} where id = user_id`),
        if_(`not (select disabled from db.user where id = user_id)`, [
          removeUsers(`select global_id from db.user where id = user_id`),
          addUsers(
            `select ${newValue} as email, user_id as db_id, 'none' as notification_type`,
            `added_user`
          ),
          modify(
            `update db.user set global_id = (select global_id from added_user) where id = user_id`
          ),
        ]),
      ],
    },
  },
});

simpleDatagridPage({
  table: "user",
  toolbar: {
    add: {
      type: "dialog",
      opts: {
        withValues: { global_id: "new_global_id", disabled: "false" },
        beforeTransactionStart: (state) => [
          addUsers(
            `select next_record_id(db.user) as db_id, 'none' as notification_type, ${state.fields.get(
              "email"
            )} as email`
          ),
          scalar(`new_global_id`, `(select global_id from added_user)`),
        ],
      },
    },
  },
  fields: {
    disabled: {
      beforeEdit: (newValue, recordId) => [
        if_<ServiceProcStatement>(
          newValue,
          [removeUsers(`select global_id from db.user where id = ${recordId}`)],
          [
            addUsers(
              `select email, id as db_id, 'none' as notification_type from db.user where id = ${recordId}`,
              `added_user`
            ),
            modify(
              `update db.user set global_id = (select global_id from added_user) where id = ${recordId}`
            ),
          ]
        ),
      ],
    },
    email: {
      beforeEdit: (newValue, recordId) => [
        scalar(
          `employee`,
          `(select employee from db.user where id = ${recordId})`
        ),
        modify(
          `update db.employee set email = ${newValue} where id = employee`
        ),
        removeUsers(`select global_id from db.user where id = ${recordId}`),
        addUsers(
          `select ${newValue} as email, ${recordId} as db_id, 'none' as notification_type`,
          `added_user`
        ),
        modify(
          `update db.user set global_id = (select global_id from added_user) where id = ${recordId}`
        ),
      ],
    },
  },
});

recordGridPage({
  table: "matter",
  createUpdatePage: true,
  children: [
    {
      type: "namedHeader",
      subHeader: "dt.display_matter_type(type)",
      chips: [
        {
          fields: ["close_date"],
          condition: (closeDate) => `${closeDate} is not null`,
          displayName: "Closed",
          color: "success",
          size: "md",
          variant: "solid",
        },
      ],
    },
    {
      type: "twoColumnDisplayCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      cells: [
        "contact",
        "client_position",
        "date",
        "close_date",
        {
          label: "'Total time spent'",
          expr: `(select sfn.display_minutes_duration(sum(minutes)) from db.time_entry where matter = ui.record_id)`,
        },
        {
          label: "'Time entry count'",
          expr: `(select count(*) from db.time_entry where matter = ui.record_id)`,
        },
      ],
    },
    {
      type: "notesCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 4 } },
    },
    {
      type: "attachmentsCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 6 } },
    },
  ],
});

datagridPage({
  table: "matter",
  selectable: true,
  toolbar: {
    add: {
      type: "dialog",
      opts: { withValues: { close_date: "null", date: "current_date()" } },
    },
    export: true,
    delete: true,
  },
  viewButton: true,
});

datagridPage({
  table: "time_entry",
  selectable: true,
  toolbar: {
    add: { type: "href", href: "/time-entries/add" },
    export: true,
    delete: true,
  },
});

multiCardInsertPage({
  table: "time_entry",
  sharedSection: {
    header: `'Choose an employee and date'`,
    fields: [
      {
        field: "employee",
        initialValue:
          "(select employee from db.user where id = current_user())",
      },
      { field: "date", initialValue: `current_date()` },
    ],
  },
  cardFooterFields: [{ field: "billable" }],
  initialCardRecord: { billable: "true" },
  cardFields: [
    {
      field: "matter",
      emptyComboboxQuery: (state) =>
        `from (
            select matter, max(date) as most_recent
                from db.time_entry
                where employee = ${state.fields.get("employee")}
                group by matter
                order by most_recent desc, matter desc
          ) join db.matter as record on record.id = matter limit 10`,
    },
    { field: "minutes" },
    { field: "note" },
  ],
  afterInsertScreen: {
    node: element("div", {
      styles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mt: 6,
      },
      children: [
        element("div", {
          styles: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          },
          children: [
            materialIcon({
              name: "ThumbUp",
              fontSize: "xl7",
            }),
            element("p", {
              styles: { ml: 4, fontSize: "xl2" },
              children: `'Good Job!'`,
            }),
          ],
        }),
        element("p", {
          styles: { mt: 6, fontSize: "lg", mb: 0 },
          children: `'Added ' || added_entries || case when added_entries = 1 then ' entry' else ' entries' end`,
        }),
        element("p", {
          styles: { mt: 2, mb: 4 },
          children: `'For a total of ' || sfn.display_minutes_duration(added_minutes) || ' minutes'`,
        }),
        button({
          variant: "soft",
          color: "success",
          children: `'Click here to add more'`,
          on: { click: [setScalar(`ui.added`, `false`)] },
        }),
      ],
    }),
    state: [
      scalar(`added_minutes`, { type: "Int" }),
      scalar(`added_entries`, { type: "Int" }),
    ],
  },
  afterSubmitClient: () => [
    setScalar(
      `ui.added_minutes`,
      `(select sum(sfn.parse_minutes_duration(minutes)) from ui.time_entry)`
    ),
    setScalar(`ui.added_entries`, `(select count(*) from ui.time_entry)`),
  ],
});

const reportsBuilder = new SimpleReportsPageBuilder();

reportsBuilder.section("Employees");

const lastMonthParams: ReportParameter[] = [
  {
    name: "start_date",
    initialValue: `date.add(day, -30, current_date())`,
    type: "Date",
  },
  {
    name: "end_date",
    initialValue: `current_date()`,
    type: "Date",
  },
];

const employeeHoursQuery = `
select 
  first_name || ' ' || last_name as employee,
  billable_minutes,
  non_billable_minutes,
  billable_minutes + non_billable_minutes as total_minutes
from (
  select
    employee,
    sum(case when billable then minutes else 0 end) as billable_minutes,
    sum(case when not billable then minutes else 0 end) as non_billable_minutes
  from db.time_entry
  where date between start_date and end_date
  group by employee
) join db.employee as record on record.id = employee
order by total_minutes desc`;

reportsBuilder.table({
  name: "Hours",
  parameters: lastMonthParams,
  query: employeeHoursQuery,
  columns: [
    { header: "Employee", cell: (r) => `${r}.employee` },
    {
      header: "Total",
      cell: (r) => `sfn.display_minutes_duration(${r}.total_minutes)`,
    },
    {
      header: "Billable",
      cell: (r) => `sfn.display_minutes_duration(${r}.billable_minutes)`,
    },
    {
      header: "Non Billable",
      cell: (r) => `sfn.display_minutes_duration(${r}.non_billable_minutes)`,
    },
  ],
});

reportsBuilder.finish();

dbManagementPage({ allow: isSysAdmin });
