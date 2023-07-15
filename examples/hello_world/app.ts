import { navbarShell } from "@yolm/boost/shells/navbar";
import { addEnum, addPage, addTable } from "@yolm/boost/modelHelpers";
import { model } from "@yolm/boost/singleton";

model.name = "hello_world";
model.title = "Hello World App";
model.dbRunMode = "BrowserSync";

// db

addTable("user", (table) => {
  table.uuid(`global_id`).notNull().unique();
  table.bool("disabled").notNull();
  table.string("email", 70);
});

addEnum({
  name: "role",
  values: ["sys_admin"],
  withDisplayDt: true,
});

addTable("user_role", (table) => {
  table.fk("user").notNull();
  table.enum("role").notNull();
  table.unique(["user", "role"]);
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
