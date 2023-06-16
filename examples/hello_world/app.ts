import { navbar } from "@yolm/boost/shells/navbar";
import {
  addEnum,
  addPage,
  addRunProfile,
  addScript,
  addTable,
} from "@yolm/boost/modelHelpers";
import { model } from "@yolm/boost/singleton";
import { addUsers, modify, setDb, table } from "@yolm/boost/procHelpers";

model.name = "hello_world";
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

//

navbar({
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

const uuid = `bbab7507-ed34-46d4-82c4-c28fe2a4dc8f`;

addRunProfile({
  asUser: uuid,
  name: "default",
  procedure: [],
  time: `2021-11-11T16:37:49.715Z`,
});
