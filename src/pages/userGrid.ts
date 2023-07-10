import { chip, chipDelete } from "../components/chip.js";
import { enumSelect } from "../components/enumSelect.js";
import { modal, modalDialog } from "../components/modal.js";
import { Authorization } from "../modelTypes.js";
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
import { ServiceProcStatement } from "../yom.js";
import { simpleDatagridPage } from "./simpleDatagrid.js";

export interface UserGridOpts {
  auth?: Authorization;
  path?: string;
}

export function userGridPage(opts: UserGridOpts = {}) {
  const displayRoles = each({
    table: `role`,
    recordName: `role_record`,
    children: chip({
      variant: "soft",
      color: "neutral",
      size: "sm",
      children: `dt.display_role(role_record.role)`,
      endDecorator: chipDelete({
        color: "neutral",
        variant: "soft",
        on: {
          click: [
            serviceProc([
              modify(`delete from db.user_role where id = role_record.id`),
            ]),
            modify(`delete from ui.role where id = role_record.id`),
          ],
        },
      }),
    }),
  });

  simpleDatagridPage({
    table: "user",
    path: opts.path,
    auth: opts.auth,
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
    extraColumns: [
      {
        header: `'Roles'`,
        width: 300,
        cell: ({ recordId, editing, stopEditing }) =>
          state({
            procedure: [
              table(
                `role`,
                `select id, role from db.user_role where user = ${recordId}`
              ),
            ],
            children: [
              displayRoles,
              ifNode(
                editing,
                modal({
                  open: editing,
                  onClose: stopEditing,
                  children: () =>
                    modalDialog({
                      children: element("div", {
                        styles: { display: "flex", flexDirection: "column" },
                        children: [
                          enumSelect({
                            enum: "role",
                            emptyOption: `'Select a role'`,
                            on: {
                              change: [
                                scalar(
                                  `new_role`,
                                  `try_cast(target_value as enums.role)`
                                ),
                                if_(`new_role is null`, [exit()]),
                                scalar(`new_role_id`, { type: "BigInt" }),
                                serviceProc([
                                  modify(
                                    `insert into db.user_role (user, role) values (${recordId}, cast(target_value as enums.role))`
                                  ),
                                  setScalar(
                                    `new_role_id`,
                                    `(select max(id) from db.user_role)`
                                  ),
                                ]),
                                modify(
                                  `insert into ui.role (id, role) values (new_role_id, cast(target_value as enums.role))`
                                ),
                              ],
                            },
                          }),
                          element("div", {
                            styles: { display: "flex", mt: 2 },
                            children: displayRoles,
                          }),
                        ],
                      }),
                    }),
                })
              ),
            ],
          }),
      },
    ],
  });
}
