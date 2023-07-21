import "./app.ts";
import { addUsers, modify, saveDb, setDb } from "@yolm/boost/procHelpers";
import { addScript, DEFAULT_DEV_USER_UUID } from "@yolm/boost/modelHelpers";

addScript({
  name: "init-dev-db",
  procedure: [
    modify(
      `insert into db.user (global_id, disabled, email) values
      (cast('${DEFAULT_DEV_USER_UUID}' as uuid), false, 'v@nuvanti.com')`
    ),
    saveDb(`data/dev`),
  ],
});

addScript({
  name: "init-db",
  procedure: [
    addUsers(
      `select * from (values(next_record_id(db.user), 'none', 'v@nuvanti.com')) as user(db_id, notification_type, email)`
    ),
    modify(
      `insert into db.user (global_id, disabled, email) values
      ((select global_id from added_user), false, 'v@nuvanti.com')`
    ),
    setDb({ allowOverwrite: true }),
  ],
});
