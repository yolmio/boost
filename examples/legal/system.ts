import {
  system,
  colors,
  colorUtils,
  components,
  nodes,
  types,
} from "@yolm/boost";

const { db } = system;

system.name = "legal";
system.region = "us-miami";
system.memoryGb = 16;
system.vcpus = 4;

//
// DATABASE
//

db.table("user", (table) => {
  table.catalog.requiredUserFields();
  table.bool("disabled").notNull().default("false");
  table.bool("is_sys_admin").notNull().default("false");
  table.bool("is_admin").notNull().default("false");
  table.fk("employee");
});

db.table("employee", (table) => {
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").notNull();
});

system.enum_({
  name: "contact_type",
  values: ["prospect", "client", "lead", "other"],
});

db.table("contact", (table) => {
  table.enum("type", "contact_type").notNull();
  table.string("first_name", 50).notNull();
  table.string("last_name", 50).notNull();
  table.email("email").maxLength(500);
  table.phoneNumber("phone_number");
  table.date("date_of_birth");
  table.catalog.addressFields();
  table.bool("mailing_list").notNull().default("false");

  table.linkable();
});

db.catalog.table.notes("contact");
db.catalog.table.attachments("contact");

system.enum_({
  name: "matter_type",
  values: ["civil", "corporate", "criminal", "family", "other"],
});

system.enum_({
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
});

db.table("matter", (table) => {
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

db.catalog.table.attachments("matter");

db.table("time_entry", (table) => {
  table.fk("matter").notNull().onDelete("Restrict");
  table.fk("employee").notNull().onDelete("Restrict");
  table.date("date").notNull().indexed();
  table.minutesDuration("minutes", "SmallUint").notNull();
  table.bool("billable").notNull().default("true");
  table.string("note", 500).multiline();
});

db.table("payment", (table) => {
  table.fk("contact").notNull();
  table.money("cost", { precision: 10, scale: 2 }).notNull();
  table.minutesDuration("minutes", "Uint").notNull();
  table.date("date").notNull();
  table.string("invoice_id", 50).notNull();
});

db.scalarFunction({
  name: "remaining_minutes",
  parameters: [
    {
      name: "contact",
      type: "BigInt",
      notNull: true,
    },
  ],
  returnType: "Int",
  procedure: (s) =>
    s.return(
      `coalesce((select sum(minutes) from db.payment where contact = input.contact), 0) -
        coalesce((select sum(minutes) from db.time_entry where matter in (select id from db.matter where contact = input.contact) and billable), 0)`,
    ),
});

db.catalog.tables.datagridView(["contact", "matter", "time_entry", "payment"]);

//
// UI
//

const app = system.apps.add("legal", "Legal");
app.executionConfig = { canDownload: true };

// generated the woff files with:
// https://gwfh.mranftl.com/fonts
for (const weight of ["regular", "500", "600", "700"]) {
  app.addGlobalStyle({
    "@font-face": {
      fontDisplay: "swap",
      fontFamily: "'Arimo'",
      fontStyle: "normal",
      fontWeight: weight,
      src: `url('/assets/arimo-v28-latin-${weight}.woff2') format('woff2')`,
    },
  });
}

// generated palette with:
// https://www.tints.dev/brand/1345B9
const primaryLightPalette = {
  50: "#E3EBFC",
  100: "#C7D6F9",
  200: "#90AEF4",
  300: "#5885EE",
  400: "#215DE8",
  500: "#1345B9",
  600: "#0F3794",
  700: "#0B296F",
  800: "#081C4A",
  900: "#040E25",
};
const primaryDarkPalette = {
  50: "#E8EEFD",
  100: "#D1DDFA",
  200: "#A2BBF6",
  300: "#7499F1",
  400: "#4578ED",
  500: "#1756E8",
  600: "#1245BA",
  700: "#0E338B",
  800: "#09225D",
  900: "#05112E",
};

app.setTheme({
  fontFamily: {
    body: "Arimo, sans-serif",
  },
  radius: {
    xs: "2px",
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "10px",
  },
  lightColorSystem: {
    palette: {
      primary: primaryLightPalette,
      neutral: colors.slate,
      focusVisible: primaryLightPalette[500],
    },
    shadowChannel: colorUtils.colorChannel(primaryLightPalette[50]),
  },
  darkColorSystem: {
    palette: {
      primary: primaryDarkPalette,
      neutral: {
        ...colors.slate,
        outlinedBorder: colors.slate[700],
      },
      focusVisible: primaryDarkPalette[500],
    },
    shadowChannel: colorUtils.colorChannel(primaryDarkPalette[900]),
  },
});

const isSysAdmin = `(select is_sys_admin from db.user from where id = current_user())`;

app.shells.navbar({
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
    startDecorator: components.materialIcon("Add"),
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

const openMatters = `
select
  matter.id as matter_id,
  name,
  first_name || ' ' || last_name as employee_name,
  employee.id as employee_id,
  date
from db.matter
  join db.employee
    on employee.id = matter.employee
where close_date is null
order by date
limit 10`;

app.pages.dashboardGrid((page) =>
  page
    .header({
      header: `'Legal App Demo'`,
      subHeader: "'Welcome back. Here''s whats going on'",
      logo: {
        src: "'/assets/logo.png'",
        styles: {
          width: "150px",
          mr: 2,
          borderRadius: "md",
          backgroundColor: "neutral-100",
          dark: { backgroundColor: "neutral-800" },
        },
      },
    })
    .statRow({
      header: `'Last 30 Days'`,
      stats: [
        {
          title: "'Billable Hours'",
          procedure: (s) =>
            s
              .scalar(
                `value_num`,
                `(select sum(minutes) from db.time_entry where billable and date > date.add(day, -30, today()))`,
              )
              .scalar(
                `previous_num`,
                `(select sum(minutes) from db.time_entry where billable and date between date.add(day, -60, today()) and date.add(day, -30, today()))`,
              ),
          value: `fn.display_minutes_duration(value_num)`,
          previous: `fn.display_minutes_duration(previous_num)`,
          trend: `cast((value_num - previous_num) as decimal(18, 2)) / cast(previous_num as decimal(18, 2))`,
        },
        {
          title: "'Income'",
          procedure: (s) =>
            s
              .scalar(
                `value_num`,
                `(select sum(cast(cost as decimal(18, 2))) from db.payment where date > date.add(day, -30, today()))`,
              )
              .scalar(
                `previous_num`,
                `(select sum(cast(cost as decimal(18, 2))) from db.payment where date between date.add(day, -60, today()) and date.add(day, -30, today()))`,
              ),
          value: `format.currency(value_num, 'USD')`,
          previous: `format.currency(previous_num, 'USD')`,
          trend: `(value_num - previous_num) / previous_num`,
        },
        {
          title: "'Closed Matters'",
          value: `(select count(*) from db.matter where close_date > date.add(day, -30, today()))`,
          previous: `(select count(*) from db.matter where close_date between date.add(day, -60, today()) and date.add(day, -30, today())))`,
          trend: `case
            when previous = 0 and value = 0 then 0
            when previous = 0 then 1 else
            cast((value - previous) as decimal(10, 2)) / cast(previous as decimal(10, 2))
          end`,
        },
      ],
    })
    .table({
      query: openMatters,
      header: "Open Matters",
      columns: [
        {
          cell: (row) => `${row}.name`,
          href: (row) => `'/matters/' || ${row}.matter_id`,
          header: "Matter",
        },
        {
          cell: (row) => `${row}.employee_name`,
          href: (row) => `'/employees/' || ${row}.employee_id`,
          header: "Employee",
        },
        {
          cell: (row) => `format.date(${row}.date, '%-d %b %Y')`,
          header: "Start Date",
        },
      ],
    })
    .pieChart({
      cardStyles: { minHeight: "200px", lg: { minHeight: "350px" } },
      header: "Hours in the last 30 days",
      state: (s) =>
        s.record(
          `last_30_days`,
          `select
            sum(case when billable then minutes end) as billable,
            sum(case when not billable then minutes end) as non_billable
          from db.time_entry where date > date.add(day, -30, today())`,
        ),
      pieChartOpts: {
        labels:
          "select value from (values('Billable'), ('Non-Billable')) as t(value)",
        series: "select billable, non_billable from last_30_days",
        donut: "true",
        donutWidth: "15",
      },
    }),
);

const thirdStyles: types.StyleObject = {
  gridColumnSpan: 12,
  md: { gridColumnSpan: 6 },
  lg: { gridColumnSpan: 4 },
};
const halfStyles: types.StyleObject = {
  gridColumnSpan: 12,
  md: { gridColumnSpan: 6 },
};
const boolFieldStyles: types.StyleObject = {
  gridColumnSpan: 6,
  sm: { gridColumnSpan: 3 },
};

const contactFormSections: types.form.insert.TwoColumnSectionedSection[] = [
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

app.pages.forms.insertTwoColumnSectioned({
  table: "contact",
  sections: contactFormSections,
  afterTransactionCommit: (_, s) =>
    s.navigate(`'/contacts/' || last_record_id(db.contact)`),
});

app.pages.forms.updateTwoColumnSectioned({
  table: "contact",
  sections: contactFormSections,
  afterTransactionCommit: (_, s) => s.navigate(`'/contacts/' || ui.record_id`),
});

app.pages.datagrid("contact", (page) => {
  page
    .selectable()
    .viewButton()
    .toolbar((t) => t.insertPage().export().delete())
    .virtualColumn({
      storageName: "remaining_minutes",
      expr: `fn.remaining_minutes(id)`,
      filter: { type: "minutes_duration", notNull: true },
      cell: (cell) =>
        `fn.display_minutes_duration(try_cast(${cell.value} as bigint))`,
      sort: { type: "numeric" },
    });
});

const remainingHoursStyles: types.StyleObject = {
  color: "text-secondary",
  my: 0,
  "& .positive": { color: "text-primary", fontWeight: "lg" },
  "& .negative": { color: "danger-400", fontWeight: "lg" },
};

function remainingHoursDisplay(label: string, value: string) {
  return nodes.element("p", {
    styles: remainingHoursStyles,
    children: [
      label,
      nodes.element("span", {
        dynamicClasses: [
          { classes: "positive", condition: `${value} > 0` },
          {
            classes: "negative",
            condition: `${value} < 0`,
          },
        ],
        children: `fn.display_minutes_duration(${value})`,
      }),
    ],
  });
}

const linkStyle: types.StyleObject = {
  color: "primary-500",
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
};

app.pages.recordGrid("contact", (page) =>
  page
    .namedPageHeader({
      chips: ["mailing_list"],
      subHeader: "fn.display_contact_type(type)",
    })
    .twoColumnDisplayCard({
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      cells: ["date_of_birth", "email", "phone_number"],
    })
    .addressCard({
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 4 } },
    })
    .notesListCard({
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 6 } },
    })
    .attachmentsCard({
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 6 } },
    })
    .timeline({
      dateField: "date",
      timelineHeader: `'Timeline'`,
      additionalState: (s) =>
        s.scalar(`remaining_minutes`, `fn.remaining_minutes(ui.record_id)`),
      afterHeaderNode: nodes.element("div", {
        styles: { display: "flex", gap: 2, pt: 1, px: 1 },
        children: [
          remainingHoursDisplay(
            `'Remaining paid hours: '`,
            `remaining_minutes`,
          ),
        ],
      }),
      sources: [
        {
          table: "matter",
          customFrom: `from db.matter where contact = ${page.recordId} and close_date is not null`,
          dateExpr: `close_date`,
          icon: {
            styles: { backgroundColor: "success-500" },
            content: components.materialIcon("Done"),
          },
          itemContent: {
            type: "RecordDefault",
            headerValues: ["id", "name"],
            header: (id, name) => [
              `'Close ' `,
              nodes.element("a", {
                styles: linkStyle,
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
          customFrom: `from db.time_entry where matter in (select id from db.matter where matter.contact = ${page.recordId})`,
          icon: {
            styles: { backgroundColor: "primary-500" },
            content: components.materialIcon("AccessTimeFilledOutlined"),
          },
          itemContent: {
            type: "RecordDefault",
            header: () => `'Time entry'`,
            displayValues: ["matter", "minutes", "billable", "note"],
          },
        },
        {
          table: "matter",
          customFrom: `from db.matter where contact = ${page.recordId}`,
          icon: {
            styles: { backgroundColor: "primary-300" },
            content: components.materialIcon("Gavel"),
          },
          itemContent: {
            type: "RecordDefault",
            headerValues: ["id", "name"],
            header: (id, name) => [
              `'Start ' `,
              nodes.element("a", {
                styles: linkStyle,
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
            content: components.materialIcon("Receipt"),
          },
          itemContent: {
            type: "RecordDefault",
            header: () => `'Payment'`,
            displayValues: ["cost", "invoice_id"],
          },
        },
      ],
    }),
);

app.pages.simpleDatagrid("employee", (page) => {
  page
    .toolbar((t) =>
      t.insertDialog({
        beforeTransactionCommit: (state, s) =>
          s
            .addUsers({
              app: "legal",
              query: `select ${
                state.field("email").value
              } as email, 'none' as notification_type`,
              outputTable: "added_user",
            })
            .modify(
              `insert into db.user (global_id, is_sys_admin, is_admin, disabled, email, employee) values ((select global_id from added_user), false, false, false, ${
                state.field("email").value
              }, last_record_id(db.employee))`,
            ),
      }),
    )
    .fieldConfig("email", {
      beforeEdit: (newValue, recordId) => (s) =>
        s
          .scalar(
            `user_id`,
            `(select id from db.user where employee = ${recordId})`,
          )
          .modify(`update db.user set email = ${newValue} where id = user_id`)
          .if(`not (select disabled from db.user where id = user_id)`, (s) =>
            s
              .removeUsers(
                "legal",
                `select global_id from db.user where id = user_id`,
              )
              .addUsers({
                app: "legal",
                query: `select ${newValue} as email, user_id as db_id, 'none' as notification_type`,
              })
              .modify(
                `update db.user set global_id = (select global_id from added_user) where id = user_id`,
              ),
          ),
    });
});

app.pages.simpleDatagrid("user", (page) => {
  page
    .toolbar((t) =>
      t.insertDialog({
        withValues: { global_id: "new_global_id", disabled: "false" },
        beforeTransactionStart: (state, s) =>
          s
            .addUsers({
              app: "legal",
              query: `select 'none' as notification_type, ${
                state.field("email").value
              } as email`,
            })
            .scalar(`new_global_id`, `(select global_id from added_user)`),
      }),
    )
    .fieldConfig("disabled", {
      beforeEdit: (newValue, recordId) => (s) =>
        s.if({
          condition: newValue,
          then: (s) =>
            s.removeUsers(
              "legal",
              `select global_id from db.user where id = ${recordId}`,
            ),
          else: (s) =>
            s
              .addUsers({
                app: "legal",
                query: `select email, id as db_id, 'none' as notification_type from db.user where id = ${recordId}`,
              })
              .modify(
                `update db.user set global_id = (select global_id from added_user) where id = ${recordId}`,
              ),
        }),
    })
    .fieldConfig("email", {
      beforeEdit: (newValue, recordId) => (s) =>
        s
          .scalar(
            `employee`,
            `(select employee from db.user where id = ${recordId})`,
          )
          .modify(
            `update db.employee set email = ${newValue} where id = employee`,
          )
          .removeUsers(
            "legal",
            `select global_id from db.user where id = ${recordId}`,
          )
          .addUsers({
            app: "legal",
            query: `select ${newValue} as email, ${recordId} as db_id, 'none' as notification_type`,
          })
          .modify(
            `update db.user set global_id = (select global_id from added_user) where id = ${recordId}`,
          ),
    });
});

app.pages.recordGrid("matter", (page) =>
  page
    .namedPageHeader({
      subHeader: "fn.display_matter_type(type)",
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
    })
    .twoColumnDisplayCard({
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 8 } },
      cells: [
        "contact",
        "client_position",
        "date",
        "close_date",
        {
          label: "'Total time spent'",
          expr: `(select fn.display_minutes_duration(sum(minutes)) from db.time_entry where matter = ${page.recordId})`,
        },
        {
          label: "'Time entry count'",
          expr: `(select count(*) from db.time_entry where matter = ${page.recordId})`,
        },
      ],
    })
    .notesCard({
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 4 } },
    })
    .attachmentsCard({
      styles: { gridColumnSpan: 12, lg: { gridColumnSpan: 6 } },
    })
    .singleSourceTimeline({
      table: "time_entry",
      dateExpr: "date",
      icon: {
        styles: { backgroundColor: "primary-500" },
        content: components.materialIcon("AccessTimeFilledOutlined"),
      },
      itemContent: {
        type: "RecordDefault",
        header: () => `'Time entry'`,
        displayValues: ["matter", "minutes", "billable", "note"],
      },
      timelineHeader: `'Time entries'`,
    }),
);

app.pages.datagrid("matter", (page) => {
  page
    .selectable()
    .viewButton()
    .toolbar((t) =>
      t
        .insertDialog({
          withValues: { close_date: "null", date: "current_date()" },
        })
        .export()
        .delete(),
    );
});

app.pages.datagrid("time_entry", (page) => {
  page.selectable().toolbar((t) => t.insertPage().export().delete());
});

app.pages.forms.multiCardInsert({
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
                where employee = ${state.field("employee").value}
                group by matter
                order by most_recent desc, matter desc
          ) join db.matter as record on record.id = matter limit 10`,
    },
    { field: "minutes" },
    { field: "note" },
  ],
  afterInsertScreen: {
    node: nodes.element("div", {
      styles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mt: 6,
      },
      children: [
        nodes.element("div", {
          styles: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          },
          children: [
            components.materialIcon({
              name: "ThumbUp",
              fontSize: "xl4",
            }),
            nodes.element("p", {
              styles: { ml: 4, fontSize: "xl2" },
              children: `'Good Job!'`,
            }),
          ],
        }),
        nodes.element("p", {
          styles: { mt: 6, fontSize: "lg", mb: 0 },
          children: `'Added ' || added_entries || case when added_entries = 1 then ' entry' else ' entries' end`,
        }),
        nodes.element("p", {
          styles: { mt: 2, mb: 4 },
          children: `'For a total of ' || fn.display_minutes_duration(added_minutes) || ' minutes'`,
        }),
        components.button({
          variant: "soft",
          color: "success",
          children: `'Click here to add more'`,
          on: { click: (s) => s.setScalar(`ui.added`, `false`) },
        }),
      ],
    }),
    state: (s) =>
      s
        .scalar(`added_minutes`, { type: "Int" })
        .scalar(`added_entries`, { type: "Int" }),
  },
  afterSubmitClient: (_, s) =>
    s
      .setScalar(
        `ui.added_minutes`,
        `(select sum(fn.parse_minutes_duration(minutes)) from ui.time_entry)`,
      )
      .setScalar(`ui.added_entries`, `(select count(*) from ui.time_entry)`),
});

app.pages.simpleReports((page) => {
  page.section("Employees");

  const lastMonthParams = page.defineParams(
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
  );

  const timeEntryStats = `
select
  first_name || ' ' || last_name as employee,
  billable_minutes,
  non_billable_minutes,
  billable_minutes + non_billable_minutes as total_minutes,
  billable_count,
  non_billable_count,
  billable_count + non_billable_count as total_count
from (
  select
    employee,
    sum(case when billable then minutes else 0 end) as billable_minutes,
    sum(case when not billable then minutes else 0 end) as non_billable_minutes,
    count(case when billable then true end) as billable_count,
    count(case when not billable then true end) as non_billable_count
  from db.time_entry
  where date between start_date and end_date
  group by employee
) join db.employee as record on record.id = employee
order by total_minutes desc`;

  page.table({
    name: "Time Entry Stats",
    parameters: lastMonthParams,
    query: timeEntryStats,
    columns: [
      { header: "Employee", cell: (r) => `${r}.employee` },
      {
        header: "Total Hours",
        cell: (r) => `fn.display_minutes_duration(${r}.total_minutes)`,
      },
      {
        header: "Billable Hours",
        cell: (r) => `fn.display_minutes_duration(${r}.billable_minutes)`,
      },
      {
        header: "Non Billable Hours",
        cell: (r) => `fn.display_minutes_duration(${r}.non_billable_minutes)`,
      },
      {
        header: "Total Entry Count",
        cell: (r) => `${r}.total_count`,
      },
      {
        header: "Billable Entry Count",
        cell: (r) => `${r}.billable_count`,
      },
      {
        header: "Non Billable Entry Count",
        cell: (r) => `${r}.non_billable_count`,
      },
    ],
  });

  const mattersStartedQuery = `
select
  first_name || ' ' || last_name as employee,
  (select count(*) from db.matter where employee = employee.id and date between start_date and end_date) as matters_started,
  (select count(*) from db.matter where employee = employee.id and close_date between start_date and end_date) as matters_closed,
  (select count(*) from db.matter where employee = employee.id and close_date is null) as current_matters_open
from db.employee
order by current_matters_open desc`;

  page.table({
    name: "Matter Stats",
    parameters: lastMonthParams,
    query: mattersStartedQuery,
    columns: [
      { header: "Employee", cell: (r) => `${r}.employee` },
      {
        header: "Current Matters Open",
        cell: (r) => `${r}.current_matters_open`,
      },
      {
        header: "Matters Started",
        cell: (r) => `${r}.matters_started`,
      },
      {
        header: "Matters Closed",
        cell: (r) => `${r}.matters_closed`,
      },
    ],
  });

  page.section("Clients");

  const highestPayingClients = `
with minutes_by_matter as (
  select
    matter,
    sum(minutes) as minutes
  from db.time_entry
  group by matter
),
minutes_by_client as (
  select
    contact,
    sum(minutes) as minutes
  from minutes_by_matter
    join db.matter
      on matter.id = minutes_by_matter.matter
  group by contact
),
payments_by_client as (
  select
    contact,
    sum(cost) as cost
  from db.payment
  group by contact
)
select
  id,
  first_name || ' ' || last_name as client_name,
  (select cost from payments_by_client where contact = contact.id) as total_paid,
  (select count(*) from db.matter where contact = contact.id) as matter_count,
  (select minutes from minutes_by_client where contact = contact.id) as total_minutes
from db.contact
where type = 'client'
order by total_paid desc nulls last
limit 10`;

  page.table({
    name: "Highest Paying Clients",
    query: highestPayingClients,
    columns: [
      {
        header: "Client",
        cell: (r) => `${r}.client_name`,
        href: (r) => `'/contacts/' || ${r}.id`,
      },
      {
        header: "Total Paid",
        cell: (r) => `format.currency(${r}.total_paid, 'usd')`,
      },
      {
        header: "Matter Count",
        cell: (r) => `format.decimal(${r}.matter_count)`,
      },
      {
        header: "Total Hours",
        cell: (r) => `fn.display_minutes_duration(${r}.total_minutes)`,
      },
    ],
  });

  page.section("Matters");

  const longestRunningMattersQuery = `
select
  id,
  name,
  date.duration(day, date, coalesce(close_date, current_date())) as days
from db.matter
order by days desc
limit 10`;

  page.table({
    name: "Longest Running Matters",
    query: longestRunningMattersQuery,
    columns: [
      {
        header: "Matter",
        cell: (r) => `${r}.name`,
        href: (r) => `'/matters/' || ${r}.id`,
      },
      {
        header: "Days Open",
        cell: (r) => `${r}.days`,
      },
    ],
  });

  page.singleColumnFixedRowsTable({
    name: "Matters Overview",
    rows: [
      {
        header: "Open Matter Count",
        expr: `(select count(*) from db.matter where close_date is null)`,
      },
      {
        header: "Average Open Matter Duration",
        expr: `(select avg(date.duration(day, date, coalesce(close_date, current_date()))) from db.matter)`,
        cell: (v) =>
          `format.decimal(${v}, maximum_fraction_digits => 1) || ' days'`,
      },
    ],
  });
});

system.apps.admin();
