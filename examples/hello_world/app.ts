import { app } from "@yolm/boost";

app.name = "hello_world";
app.title = "Hello World App";
app.displayName = "Hello World";
app.dbRunMode = "BrowserSync";

// db

app.db.addTable("user", (table) => {
  table.uuid(`global_id`).notNull().unique();
  table.bool("disabled").notNull();
  table.string("email", 70);
});

// ui

app.ui.useNavbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts", "/reports"],
});

app.ui.pages.push({
  path: "/",
  content: "'hello world!'",
});

app.ui.pages.push({
  path: "/contacts",
  content: "'No contacts yet'",
});

app.ui.pages.push({
  path: "/reports",
  content: "'No reports yet'",
});
