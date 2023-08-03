import { navbarShell } from "@yolm/boost/shells/navbar";
import { addPage, addTable } from "@yolm/boost/appHelpers";
import { app } from "@yolm/boost/singleton";

app.name = "hello_world";
app.title = "Hello World App";
app.displayName = "Hello World";
app.dbRunMode = "BrowserSync";

// db

addTable("user", (table) => {
  table.uuid(`global_id`).notNull().unique();
  table.bool("disabled").notNull();
  table.string("email", 70);
});

// ui

navbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts", "/reports"],
});

addPage({
  path: "/",
  content: "'hello world!'",
});

addPage({
  path: "/contacts",
  content: "'No contacts yet'",
});

addPage({
  path: "/reports",
  content: "'No reports yet'",
});
