import "./system.ts";
import { system } from "@yolm/boost";

system.addScript("init-dev-db", (s) =>
  s
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, email) values
      (random.uuid(), 'test@yolm.io')`,
    )
    .commitTransaction("db")
    .saveDbToDir("data/dev"),
);

system.addScript("init-db", (s) =>
  s
    .addUsers({
      app: "tutorial",
      query: `select * from (values('none', 'test@yolm.io')) as user(notification_type, email)`,
    })
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, email) values
      ((select global_id from added_user), 'test@yolm.io')`,
    )
    .commitTransaction("db")
    .uploadDb(),
);
