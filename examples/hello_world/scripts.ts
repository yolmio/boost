import "./app.ts";
import { app } from "@yolm/boost";

app.addScript("init-dev-db", (s) =>
  s
    .modify(
      `insert into db.user (global_id, disabled, email) values
      (random.uuid(), false, 'v@nuvanti.com')`
    )
    .saveDb("data/dev")
);

app.addScript("init-db", (s) =>
  s
    .addUsers(
      `select * from (values(next_record_id(db.user), 'none', 'v@nuvanti.com')) as user(db_id, notification_type, email)`
    )
    .modify(
      `insert into db.user (global_id, disabled, email) values
      ((select global_id from added_user), false, 'v@nuvanti.com')`
    )
    .setDb()
);
