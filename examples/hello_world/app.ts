import { app } from "@yolm/boost";
const { db, ui } = app;

app.name = "hello_world";
app.title = "Hello World App";
app.displayName = "Hello World";
app.dbRunMode = "BrowserSync";

// db

db.addTable("user", (table) => {
  table.uuid(`global_id`).notNull().unique();
  table.bool("disabled").notNull();
  table.string("email", 70);
});

// ui

ui.useNavbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts", "/reports"],
});

ui.pages.push({
  path: "/",
  content: "'hello world!'",
});

ui.pages.push({
  path: "/contacts",
  content: "'No contacts yet'",
});

ui.pages.push({
  path: "/reports",
  content: "'No reports yet'",
});
