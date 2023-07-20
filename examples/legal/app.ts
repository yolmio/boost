import { navbarShell } from "@yolm/boost/shells/navbar";
import { addEnum, addScalarFunction, addTable } from "@yolm/boost/modelHelpers";
import {
  navigate,
  returnExpr,
  scalar,
  setScalar,
} from "@yolm/boost/procHelpers";
import { adminPage } from "@yolm/boost/pages/admin";
import { datagridPage } from "@yolm/boost/pages/datagrid";
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

model.name = "legal";
model.title = "Legal";
model.displayName = "Legal";

/* 

todos:

boost/platform stuff:

need to allow missing non-null values if default is provided
Make default value show up in forms
Proper field display in related records timeline
validate sections are not empty in reports page
attachments card

legal stuff:
attachments
actually insert matter_start and matter_close

*/

//
// DATABASE
//

addTable("employee", (table) => {
  table.fieldGroupFromCatalog({ type: "requiredUserFields" });
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
});

addEnum({
  name: "role",
  values: ["sys_admin"],
  withDisplayDt: true,
});

addTable("employee_role", (table) => {
  table.fk("employee").notNull();
  table.enum("role").notNull();
  table.unique(["employee", "role"]);
});

model.database.userTableName = "employee";
model.database.userRoleTableName = "employee_role";

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

addTable("contact_note", (table) => {
  table.fk("contact").notNull();
  table.string("content", 2000).notNull();
  table.date("date").notNull();
});

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

addTable("matter_start", (table) => {
  table.fk("contact").notNull();
  table.fk("matter").notNull();
  table.date("date").notNull();
});

addTable("matter_close", (table) => {
  table.fk("contact").notNull();
  table.fk("matter").notNull();
  table.date("date").notNull();
});

addTable("time_entry", (table) => {
  table.fk("contact").notNull().onDelete("Restrict");
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
      `coalesce((select sum(minutes) from db.payment where contact = input.contact), 0) - coalesce((select sum(minutes) from db.time_entry where contact = input.contact and billable), 0)`
    ),
  ],
});

//
// UI
//

navbarShell({
  color: "primary",
  variant: "solid",
  links: [
    "/contacts",
    "/matters",
    "/time-entries",
    "/reports",
    {
      auth: { allow: "sys_admin" },
      url: "/admin",
    },
    {
      auth: { allow: "sys_admin" },
      url: "/employees",
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

adminPage({
  auth: { allow: "sys_admin" },
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
  afterSubmitService: () => [navigate(`'/contacts'`)],
});

updateFormPage({
  table: "contact",
  content: {
    type: "TwoColumnSectioned",
    sections: contactFormSections,
  },
  afterSubmitService: () => [navigate(`'/contacts/' || ui.record_id`)],
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
      type: "relatedRecordsTimeline",
      dateField: "date",
      timelineHeader: `'Timeline'`,
      additionalState: [
        scalar(
          `remaining_minutes`,
          `coalesce((select sum(minutes) from db.payment where contact = ui.record_id), 0) - coalesce((select sum(minutes) from db.time_entry where contact = ui.record_id and billable), 0)`
        ),
      ],
      afterHeaderNode: element("div", {
        styles: { display: "flex", gap: 2, pt: 1, pb: 2, px: 1 },
        children: [
          remainingHoursDisplay(
            `'Remaining paid hours: '`,
            `remaining_minutes`
          ),
        ],
      }),
      tables: [
        {
          table: "matter_close",
          dotColor: "success-500",
          header: (helper) => `'Close ' || ${helper.field("matter_name")}`,
          exprs: [
            {
              name: "matter_name",
              type: { type: "String" },
              expr: "(select name from db.matter where id = matter)",
            },
          ],
          icon: "Done",
        },
        {
          table: "time_entry",
          dotColor: "primary-500",
          icon: "AccessTimeFilledOutlined",
          header: (helper) => `'Time entry'`,
          displayFields: ["minutes", "billable", "note"],
        },
        {
          table: "matter_start",
          dotColor: "primary-300",
          header: (helper) => `'Start ' || ${helper.field("matter_name")}`,
          icon: "Gavel",
          exprs: [
            {
              name: "matter_name",
              type: { type: "String" },
              expr: "(select name from db.matter where id = matter)",
            },
          ],
        },
        {
          table: "payment",
          dotColor: "success-500",
          header: (helper) => `'Payment'`,
          icon: "Receipt",
          displayFields: ["cost", "invoice_id"],
        },
      ],
    },
  ],
});

recordGridPage({
  table: "matter",
  createUpdatePage: true,
  children: [
    {
      type: "namedHeader",
      subHeader: "dt.display_matter_type(type)",
    },
    {
      type: "twoColumnDisplayCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      cells: ["client_position", "contact", "date", "close_date"],
    },
    {
      type: "notesCard",
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 4 } },
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
      { field: "employee", initialValue: "current_user()" },
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
    { field: "contact" },
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
