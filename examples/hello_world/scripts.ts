import "./app.ts";
import { addUsers, modify, saveDb, setDb } from "@yolm/boost/procHelpers";
import { addScript, DEFAULT_DEV_USER_UUID } from "@yolm/boost/modelHelpers";

addScript({
  name: "init-dev-db",
  procedure: [
    modify(
      `insert into db.user (global_id, disabled, email) values
      (cast('${DEFAULT_DEV_USER_UUID}' as uuid), false, 'realemail@test.com')`
    ),
    modify(`insert into db.user_role (user, role) values (0, 'sys_admin')`),
    saveDb(`data/dev`),
  ],
});

addScript({
  name: "init-db",
  procedure: [
    addUsers(
      `select * from (values(next_record_id(db.user), 'none', 'realemail@test.com')) as user(db_id, notification_type, email)`
    ),
    modify(
      `insert into db.user (global_id, disabled, email) values
      ((select global_id from added_user), false, 'realemail@test.com')`
    ),
    modify(`insert into db.user_role (user, role) values (0, 'sys_admin')`),
    setDb({ allowOverwrite: true }),
  ],
});
