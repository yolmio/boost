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
