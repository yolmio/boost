import "./system.ts";
import { system } from "@yolm/boost";

system.script("init-dev-db", (s) =>
  s
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, email) values
      (random.uuid(), 'test@test.com')`,
    )
    .modify(
      `insert into contact (first_name, last_name, email, street, city, state, country, zip) values
      ('John', 'Doe', 'johndoe@example.com', '123 Baker St', 'Springfield', 'Illinois', 'USA', '62704'),
      ('Jane', 'Smith', 'janesmith@example.com', '456 Oak Ave', 'Metropolis', 'New York', 'USA', '10108'),
      ('Alice', 'Johnson', 'alicej@example.com', '789 Pine Rd', 'Smallville', 'Kansas', 'USA', '66002'),
      ('Gerd', 'Muller', 'gerd@example.com', '123 Neuer Strasse', 'Munchen', 'Bayern', 'Germany', 'ABC123')`,
    )
    .modify(
      `insert into contact (first_name, last_name, email) values ('Bob', 'Brown', 'bobb@example.com')`,
    )
    .modify(
      `insert into contact (first_name, last_name, email, city, country) values ('Chuck', 'Leclerc', 'pain@ferrari.com', 'Monaco', 'Monaco')`,
    )
    .commitTransaction("db")
    .saveDbToDir("data/dev"),
);

const YOUR_EMAIL = `test@yolm.io`;

system.script("init-db", (s) =>
  s
    .addUsers({
      app: "crm",
      query: `select * from (values('none', '${YOUR_EMAIL}')) as user(notification_type, email)`,
    })
    .startTransaction("db")
    .modify(
      `insert into db.user (global_id, email) values
      ((select global_id from added_user), '${YOUR_EMAIL}')`,
    )
    .commitTransaction("db")
    .uploadDb(),
);
