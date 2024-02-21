import "./system";
import { system } from "@yolm/boost";

system.addScript("init-dev-db", (s) =>
  s
    .importCsv("db", "data/csv")
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, is_sys_admin, is_admin, email) values (random.uuid(), true, true, 'coolguy@coolemail.com')`,
    )
    .commitTransaction("db")
    .saveDbToDir("data/dev"),
);

system.addScript("init-db", (s) =>
  s
    .addUsers({
      app: "legal",
      query: `select * from (values('none', 'your@email.com')) as user(notification_type, email)`,
    })
    .importCsv("db", "data/csv")
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, is_sys_admin, is_admin, email) values ((select global_id from added_user), true, true, 'your@email.com')`,
    )
    .commitTransaction("db")
    .uploadDb(),
);
