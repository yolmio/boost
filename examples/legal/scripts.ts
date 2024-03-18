import "./system";
import { system } from "@yolm/boost";

const email = process.env.YOLM_TEST_EMAIL ?? "your@email.com";

system.script("init-dev-db", (s) =>
  s
    .importCsv("db", "data/csv")
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, is_sys_admin, is_admin, email) values (random.uuid(), true, true, 'coolguy@coolemail.com')`,
    )
    .commitTransaction("db")
    .saveDbToDir("data/dev"),
);

system.script("init-db", (s) =>
  s
    .addUsers({
      app: "legal",
      query: `select * from (values('none', '${email}')) as user(notification_type, email)`,
    })
    .importCsv("db", "data/csv")
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, is_sys_admin, is_admin, email) values ((select global_id from added_user), true, true, '${email}')`,
    )
    .commitTransaction("db")
    .uploadDb(),
);
