import { each, element, ifNode, state, switchNode } from "../../nodeHelpers.js";
import {
  commitUiChanges,
  debugExpr,
  debugQuery,
  delay,
  exit,
  if_,
  modify,
  scalar,
  serviceProc,
  setQueryParam,
  setScalar,
  spawn,
  stopPropagation,
  table,
  throwError,
  try_,
} from "../../procHelpers.js";
import { stringLiteral } from "../../utils/sqlHelpers.js";
import { button } from "../../components/button.js";
import { iconButton } from "../../components/iconButton.js";
import { materialIcon } from "../../components/materialIcon.js";
import { popoverMenu } from "../../components/menu.js";
import { typography } from "../../components/typography.js";
import { input } from "../../components/input.js";
import { ClientProcStatement } from "../../yom.js";
import { deleteRecordDialog } from "../../components/deleteRecordDialog.js";
import { Node } from "../../nodeTypes.js";
import { createStyles, flexGrowStyles } from "../../styleUtils.js";
import { divider } from "../../components/divider.js";
import { circularProgress } from "../../components/circularProgress.js";
import { getUniqueUiId } from "../../components/utils.js";
import {
  DatagridDts,
  duplicateView,
  saveAsNewView,
  saveToExistingView,
} from "./baseDatagrid.js";
import { alert } from "../../components/alert.js";
import { checkbox } from "../../components/checkbox.js";

function withViewDrawerState(datagridName: string, children: Node) {
  return state({
    procedure: [
      scalar(`drawer_refresh_key`, `0`),
      scalar(`adding`, `false`),
      scalar(`proc_error`, { type: "String", maxLength: 2000 }),
      scalar(`proc_in_progress`, `false`),
    ],
    children: state({
      watch: ["drawer_refresh_key"],
      procedure: [
        table(
          `datagrid_view`,
          `select id, ordering, name, user is not null as is_personal from db.datagrid_view where datagrid_name = ${stringLiteral(
            datagridName
          )} and user is null or user = current_user() order by user is not null, ordering`
        ),
      ],
      statusScalar: `drawer_status`,
      children,
    }),
  });
}

const styles = createStyles({
  root: {
    width: 300,
    height: "100%",
    p: 1,
    display: "flex",
    flexDirection: "column",
    gap: 1,
    borderTop: "1px solid",
    borderColor: "divider",
  },
  header: {
    display: "flex",
    gap: 1,
  },
  addButtons: {
    display: "flex",
    gap: 1,
    alignItems: "center",
  },
  viewsList: { mt: 1, p: 0 },
  view: {
    display: "flex",
    alignItems: "center",
    borderRadius: "sm",
    px: 1.5,
    py: 0.5,
    textDecoration: "none",
    cursor: "pointer",
    "&.active": {
      backgroundColor: "primary-100",
      dark: {
        backgroundColor: "primary-900",
      },
    },
  },
  viewName: {
    color: "text-primary",
    fontWeight: "lg",
    fontSize: "sm",
  },
  loadingWrapper: {
    mx: "auto",
    mt: 2,
  },
  emptyText: {
    fontSize: "lg",
  },
  menu: {
    width: 180,
  },
});

const viewIdBase = stringLiteral(getUniqueUiId());

export function viewDrawer(datagridName: string, dts: DatagridDts) {
  const drawerContent = element("div", {
    styles: styles.root,
    children: [
      element("div", {
        styles: styles.header,
        children: [
          typography({
            level: "h6",
            children: `'Views'`,
          }),
          ifNode(`proc_in_progress`, circularProgress({ size: "sm" })),
          element("div", { styles: flexGrowStyles }),
          iconButton({
            size: "sm",
            variant: "outlined",
            children: ifNode(
              `adding`,
              materialIcon("Close"),
              materialIcon("Add")
            ),
            on: { click: [setScalar(`adding`, `not adding`)] },
          }),
        ],
      }),
      ifNode(
        `adding`,
        state({
          procedure: [
            scalar(`view_name`, `''`),
            scalar(`personal`, `false`),
            scalar(`waiting`, `false`),
            scalar(`error`, { type: "String", maxLength: 2000 }),
          ],
          children: [
            input({
              slots: { input: { props: { yolmFocusKey: `true` } } },
              on: {
                input: [setScalar(`view_name`, `target_value`)],
              },
            }),
            ifNode(
              `error is not null`,
              alert({
                color: "danger",
                children: `error`,
              })
            ),
            element("div", {
              styles: styles.addButtons,
              children: [
                checkbox({
                  checked: `personal`,
                  variant: "outlined",
                  color: "primary",
                  label: `'Personal'`,
                  size: "sm",
                  on: {
                    checkboxChange: [setScalar(`personal`, `target_checked`)],
                  },
                }),
                element("div", { styles: flexGrowStyles }),
                button({
                  size: "sm",
                  variant: "soft",
                  color: "neutral",
                  children: `'Cancel'`,
                  on: { click: [setScalar(`adding`, `false`)] },
                }),
                button({
                  size: "sm",
                  children: `'Add view'`,
                  loading: `waiting`,
                  on: {
                    click: [
                      setScalar(`waiting`, `true`),
                      setScalar(`error`, `null`),
                      commitUiChanges(),
                      try_<ClientProcStatement>({
                        body: [
                          serviceProc([
                            ...saveAsNewView(
                              datagridName,
                              dts,
                              `view_name`,
                              `personal`
                            ),
                            setScalar(
                              `drawer_refresh_key`,
                              `drawer_refresh_key + 1`
                            ),
                            setQueryParam(`ui.view`, `view_id`),
                          ]),
                        ],
                        catch: [
                          setScalar(`waiting`, `false`),
                          setScalar(`error`, `'Unable to save view'`),
                          exit(),
                        ],
                      }),
                      setScalar(`waiting`, `false`),
                      setScalar(`adding`, `false`),
                    ],
                  },
                }),
              ],
            }),
          ],
        })
      ),
      divider(),
      ifNode(
        `proc_error is not null`,
        alert({ color: "danger", children: `proc_error` })
      ),
      switchNode(
        [
          `drawer_status in ('fallback_triggered', 'requested')`,
          element("div", {
            styles: styles.loadingWrapper,
            children: circularProgress({ size: "lg" }),
          }),
        ],
        [
          `drawer_status = 'failed'`,
          alert({ color: "danger", children: `'Unable to get views'` }),
        ],
        [
          `exists (select id from datagrid_view)`,
          element("ul", {
            styles: styles.viewsList,
            children: each({
              table: "datagrid_view",
              key: "id",
              recordName: "view_record",
              children: state({
                procedure: [
                  scalar(`deleting`, `false`),
                  scalar(`editing`, `false`),
                ],
                children: element("li", {
                  styles: styles.view,
                  on: {
                    click: [
                      if_(
                        `ui.view is null or ui.view != view_record.id`,
                        setQueryParam(`ui.view`, `view_record.id`)
                      ),
                    ],
                  },
                  dynamicClasses: [
                    {
                      classes: "active",
                      condition: "view_record.id = view",
                    },
                  ],
                  children: ifNode(
                    `editing`,
                    state({
                      procedure: [scalar(`view_name`, `view_record.name`)],
                      children: input({
                        size: "sm",
                        fullWidth: true,
                        slots: {
                          input: {
                            props: { value: `view_name`, yolmFocusKey: `true` },
                            on: {
                              click: [stopPropagation()],
                              input: [setScalar(`view_name`, `target_value`)],
                              blur: [
                                setScalar(`view_name`, `trim(view_name)`),
                                if_(
                                  `view_name = view_record.name or view_name = ''`,
                                  [setScalar(`editing`, `false`), exit()]
                                ),
                                setScalar(`proc_in_progress`, `true`),
                                setScalar(`proc_error`, `null`),
                                commitUiChanges(),
                                try_<ClientProcStatement>({
                                  body: [
                                    serviceProc([
                                      modify(
                                        `update db.datagrid_view set name = view_name where id = view_record.id`
                                      ),
                                      setScalar(
                                        `drawer_refresh_key`,
                                        `drawer_refresh_key + 1`
                                      ),
                                      setQueryParam(`ui.view`, `view_name`),
                                    ]),
                                  ],
                                  catch: [
                                    setScalar(
                                      `proc_error`,
                                      `'Unable to change view name at this time'`
                                    ),
                                  ],
                                }),
                                setScalar(`proc_in_progress`, `false`),
                                setScalar(`editing`, `false`),
                              ],
                              keydown: [
                                if_(`event.key = 'Enter'`, [
                                  setScalar(`view_name`, `trim(view_name)`),
                                  if_(
                                    `view_name = view_record.name or view_name = ''`,
                                    [setScalar(`editing`, `false`), exit()]
                                  ),
                                  setScalar(`proc_in_progress`, `true`),
                                  setScalar(`proc_error`, `null`),
                                  commitUiChanges(),
                                  try_<ClientProcStatement>({
                                    body: [
                                      serviceProc([
                                        modify(
                                          `update db.datagrid_view set name = view_name where id = view_record.id`
                                        ),
                                        setScalar(
                                          `drawer_refresh_key`,
                                          `drawer_refresh_key + 1`
                                        ),
                                        setQueryParam(
                                          `ui.view`,
                                          `view_record.id`
                                        ),
                                      ]),
                                    ],
                                    catch: [
                                      setScalar(
                                        `proc_error`,
                                        `'Unable to change view name at this time'`
                                      ),
                                    ],
                                  }),
                                  setScalar(`proc_in_progress`, `false`),
                                  setScalar(`editing`, `false`),
                                ]),
                              ],
                            },
                          },
                        },
                      }),
                    }),
                    [
                      element("span", {
                        styles: styles.viewName,
                        children: "view_record.name",
                      }),
                      element("div", { styles: flexGrowStyles }),
                      ifNode(
                        `view_record.is_personal`,
                        materialIcon("PersonOutline")
                      ),
                      popoverMenu({
                        id: `${viewIdBase} || '-' || view_record.id`,
                        menuListOpts: {
                          styles: styles.menu,
                        },
                        button: ({ buttonProps, onButtonClick }) =>
                          iconButton({
                            variant: "plain",
                            size: "sm",
                            children: materialIcon("MoreHoriz"),
                            props: buttonProps,
                            on: {
                              click: [stopPropagation(), ...onButtonClick],
                            },
                          }),
                        items: [
                          {
                            onClick: [
                              stopPropagation(),
                              setScalar(`editing`, `true`),
                            ],
                            resetMenuAfter: true,
                            children: `'Rename'`,
                          },
                          {
                            onClick: [
                              stopPropagation(),
                              setScalar(`proc_in_progress`, `true`),
                              setScalar(`proc_error`, `null`),
                              commitUiChanges(),
                              try_<ClientProcStatement>({
                                body: [
                                  serviceProc([
                                    ...duplicateView(`view_record.id`),
                                    setScalar(
                                      `drawer_refresh_key`,
                                      `drawer_refresh_key + 1`
                                    ),
                                    setQueryParam(`ui.view`, `new_view_id`),
                                  ]),
                                ],
                                catch: [
                                  setScalar(
                                    `proc_error`,
                                    `'Unable to duplicate view at this time'`
                                  ),
                                ],
                              }),
                              setScalar(`proc_in_progress`, `false`),
                            ],
                            resetMenuAfter: true,
                            children: `'Duplicate'`,
                          },
                          {
                            onClick: [
                              setScalar(`proc_in_progress`, `true`),
                              setScalar(`proc_error`, `null`),
                              commitUiChanges(),
                              try_<ClientProcStatement>({
                                body: [
                                  serviceProc([
                                    ...saveToExistingView(
                                      dts,
                                      `view_record.id`
                                    ),
                                    setScalar(
                                      `drawer_refresh_key`,
                                      `drawer_refresh_key + 1`
                                    ),
                                    setQueryParam(`ui.view`, `view_record.id`),
                                  ]),
                                ],
                                errorName: `caught_error`,
                                catch: [
                                  debugQuery(`select * from caught_error`),
                                  setScalar(
                                    `proc_error`,
                                    `'Error saving view'`
                                  ),
                                ],
                              }),
                              setScalar(`proc_in_progress`, `false`),
                            ],
                            resetMenuAfter: true,
                            children: `'Save to'`,
                          },
                          {
                            onClick: [
                              stopPropagation(),
                              setScalar(`deleting`, `true`),
                            ],
                            resetMenuAfter: true,
                            children: `'Delete'`,
                          },
                        ],
                      }),
                      deleteRecordDialog({
                        open: `deleting`,
                        onClose: [setScalar(`deleting`, `false`)],
                        afterDeleteService: [
                          if_(`view_record.id = view`, [
                            setQueryParam(`ui.view`, `null`),
                          ]),
                          setScalar(
                            `drawer_refresh_key`,
                            `drawer_refresh_key + 1`
                          ),
                        ],
                        recordId: `view_record.id`,
                        table: `datagrid_view`,
                        confirmDescription: `'Are you sure you want to delete ' || view_record.name || '?'`,
                      }),
                    ]
                  ),
                }),
              }),
            }),
          }),
        ],
        [
          `true`,
          typography({
            children: `'No views'`,
            level: "body2",
            styles: styles.emptyText,
          }),
        ]
      ),
    ],
  });
  return ifNode(
    `view_drawer_open`,
    withViewDrawerState(datagridName, drawerContent)
  );
}
