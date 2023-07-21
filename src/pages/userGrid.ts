import { chip, chipDelete } from "../components/chip.js";
import { enumSelect } from "../components/enumSelect.js";
import { modal, modalDialog } from "../components/modal.js";
import { each, element, ifNode, state } from "../nodeHelpers.js";
import {
  addUsers,
  exit,
  if_,
  modify,
  removeUsers,
  scalar,
  serviceProc,
  setScalar,
  table,
} from "../procHelpers.js";
import { ServiceProcStatement, SqlExpression } from "../yom.js";
import { simpleDatagridPage } from "./simpleDatagrid.js";

export interface UserGridOpts {
  allow?: SqlExpression;
  path?: string;
}

export function userGridPage(opts: UserGridOpts = {}) {
  simpleDatagridPage({
    table: "user",
    path: opts.path,
    allow: opts.allow,
    toolbar: {
      add: {
        type: "dialog",
        opts: {
          beforeTransaction: (state) => [
            addUsers(
              `select * from (values(next_record_id(db.user), 'none', ${state.fields.get(
                "email"
              )})) as user(db_id, notification_type, email)`
            ),
            scalar(`new_global_id`, `(select global_id from added_user)`),
          ],
          withValues: { global_id: "new_global_id", disabled: "false" },
        },
      },
    },
    fields: {
      email: { immutable: true },
      disabled: {
        beforeEditTransaction: (newValue, recordId) => [
          if_<ServiceProcStatement>(
            newValue,
            [
              removeUsers(
                `select global_id from db.user where id = ${recordId}`
              ),
            ],
            [
              addUsers(
                `select email, id as db_id, 'none' as notification_type from db.user where id = ${recordId}`
              ),
            ]
          ),
        ],
      },
    },
  });
}
