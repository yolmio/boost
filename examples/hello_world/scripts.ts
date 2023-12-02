import "./app.ts";
import { app } from "@yolm/boost";

app.addScript("init-dev-db", (s) =>
  s
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, disabled, email) values
      (random.uuid(), false, 'test@yolm.io')`,
    )
    .commitTransaction("db")
    .saveDbToDir("data/dev"),
);

app.addScript("init-db", (s) =>
  s
    .addUsers(
      `select * from (values(next_record_id(db.user), 'none', 'test@yolm.io')) as user(db_id, notification_type, email)`,
    )
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, disabled, email) values
      ((select global_id from added_user), false, 'test@yolm.io')`,
    )
    .commitTransaction("db")
    .uploadDb(),
);
