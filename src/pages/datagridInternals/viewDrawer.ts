import { nodes } from "../../nodeHelpers";
import { stringLiteral } from "../../utils/sqlHelpers";
import { button } from "../../components/button";
import { iconButton } from "../../components/iconButton";
import { materialIcon } from "../../components/materialIcon";
import { popoverMenu } from "../../components/menu";
import { typography } from "../../components/typography";
import { input } from "../../components/input";
import { deleteRecordDialog } from "../../components/deleteRecordDialog";
import { Node } from "../../nodeTypes";
import { createStyles, flexGrowStyles } from "../../styleUtils";
import { divider } from "../../components/divider";
import { circularProgress } from "../../components/circularProgress";
import { getUniqueUiId } from "../../components/utils";
import {
  DatagridRfns,
  duplicateView,
  saveAsNewView,
  saveToExistingView,
} from "./datagridBase";
import { alert } from "../../components/alert";
import { checkbox } from "../../components/checkbox";
import { hub } from "../../hub";

function withViewDrawerState(datagridName: string, children: Node) {
  return nodes.state({
    procedure: (s) =>
      s
        .scalar(`drawer_refresh_key`, `0`)
        .scalar(`adding`, `false`)
        .scalar(`proc_error`, { type: "String", maxLength: 2000 })
        .scalar(`proc_in_progress`, `false`),
    children: nodes.state({
      watch: ["drawer_refresh_key"],
      procedure: (s) =>
        s.table(
          `datagrid_view`,
          `select id, ordering, name, user is not null as is_personal from db.datagrid_view where datagrid_name = ${stringLiteral(
            datagridName,
          )} and user is null or user = current_user() order by user is not null, ordering`,
        ),
      statusScalar: `drawer_status`,
      children,
    }),
  });
}

const styles = createStyles({
  root: (app) => {
    const enterAnimation = app.registerKeyframes({
      from: {
        transform: "translate(-100%, 0)",
      },
      to: {
        transform: "translate(0%, 0)",
      },
    });
    const exitAnimation = app.registerKeyframes({
      from: {
        transform: "translate(0%, 0)",
      },
      to: {
        transform: "translate(-100%, 0)",
      },
    });
    app.addGlobalStyle({
      "::view-transition-group(view-drawer)": {
        animationDuration: app.theme.transitionDurations.drawer,
        animationTimingFunction: app.theme.transitionEasing.drawer,
      },
      "::view-transition-new(view-drawer):only-child": {
        animationName: enterAnimation,
      },
      "::view-transition-old(view-drawer):only-child": {
        animationName: exitAnimation,
      },
    });
    return {
      width: 300,
      height: "100%",
      p: 1,
      display: "flex",
      flexDirection: "column",
      gap: 1,
      borderTop: "1px solid",
      borderColor: "divider",
      viewTransitionName: "view-drawer",
    };
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

export function viewDrawer(datagridName: string, dts: DatagridRfns) {
  const drawerContent = nodes.element("div", {
    styles: styles.root(),
    children: [
      nodes.element("div", {
        styles: styles.header,
        children: [
          typography({
            level: "body-lg",
            children: `'Views'`,
          }),
          nodes.if(`proc_in_progress`, circularProgress({ size: "sm" })),
          nodes.element("div", { styles: flexGrowStyles }),
          iconButton({
            size: "sm",
            variant: "outlined",
            ariaLabel: `case when adding then 'Cancel' else 'Add view' end`,
            children: nodes.if({
              condition: `adding`,
              then: materialIcon("Close"),
              else: materialIcon("Add"),
            }),
            on: { click: (s) => s.setScalar(`adding`, `not adding`) },
          }),
        ],
      }),
      nodes.if(
        `adding`,
        nodes.state({
          procedure: (s) =>
            s
              .scalar(`view_name`, `''`)
              .scalar(`personal`, `false`)
              .scalar(`waiting`, `false`)
              .scalar(`error`, { type: "String", maxLength: 2000 }),
          children: [
            input({
              slots: { input: { props: { yolmFocusKey: `true` } } },
              on: {
                input: (s) => s.setScalar(`view_name`, `target_value`),
              },
            }),
            nodes.if(
              `error is not null`,
              alert({
                color: "danger",
                children: `error`,
              }),
            ),
            nodes.element("div", {
              styles: styles.addButtons,
              children: [
                checkbox({
                  checked: `personal`,
                  variant: "outlined",
                  color: "primary",
                  label: `'Personal'`,
                  size: "sm",
                  on: {
                    checkboxChange: (s) =>
                      s.setScalar(`personal`, `target_checked`),
                  },
                }),
                nodes.element("div", { styles: flexGrowStyles }),
                button({
                  size: "sm",
                  variant: "soft",
                  color: "neutral",
                  children: `'Cancel'`,
                  on: { click: (s) => s.setScalar(`adding`, `false`) },
                }),
                button({
                  size: "sm",
                  children: `'Add view'`,
                  loading: `waiting`,
                  on: {
                    click: (s) =>
                      s
                        .setScalar(`waiting`, `true`)
                        .setScalar(`error`, `null`)
                        .commitUiTreeChanges()
                        .try({
                          body: (s) =>
                            s.serviceProc((s) =>
                              s
                                .statements(
                                  saveAsNewView(
                                    datagridName,
                                    dts,
                                    `view_name`,
                                    `personal`,
                                  ),
                                )
                                .setScalar(
                                  `drawer_refresh_key`,
                                  `drawer_refresh_key + 1`,
                                )
                                .setQueryParam(`ui.view`, `view_id`),
                            ),
                          catch: (s) =>
                            s
                              .setScalar(`waiting`, `false`)
                              .setScalar(`error`, `'Unable to save view'`)
                              .return(),
                        })
                        .setScalar(`waiting`, `false`)
                        .setScalar(`adding`, `false`),
                  },
                }),
              ],
            }),
          ],
        }),
      ),
      divider(),
      nodes.if(
        `proc_error is not null`,
        alert({ color: "danger", children: `proc_error` }),
      ),
      nodes.switch(
        {
          condition: `drawer_status in ('fallback_triggered', 'requested')`,
          node: nodes.element("div", {
            styles: styles.loadingWrapper,
            children: circularProgress({ size: "lg" }),
          }),
        },
        {
          condition: `drawer_status = 'failed'`,
          node: alert({ color: "danger", children: `'Unable to get views'` }),
        },
        {
          condition: `exists (select id from datagrid_view)`,
          node: nodes.element("ul", {
            styles: styles.viewsList,
            children: nodes.each({
              table: "datagrid_view",
              key: "id",
              recordName: "view_record",
              children: nodes.state({
                procedure: (s) =>
                  s.scalar(`deleting`, `false`).scalar(`editing`, `false`),
                children: nodes.element("li", {
                  styles: styles.view,
                  on: {
                    click: (s) =>
                      s.if(
                        `ui.view is null or ui.view != view_record.id`,
                        (s) => s.setQueryParam(`ui.view`, `view_record.id`),
                      ),
                  },
                  dynamicClasses: [
                    {
                      classes: "active",
                      condition: "view_record.id = view",
                    },
                  ],
                  children: nodes.if({
                    condition: `editing`,
                    then: nodes.state({
                      procedure: (s) =>
                        s.scalar(`view_name`, `view_record.name`),
                      children: input({
                        size: "sm",
                        fullWidth: true,
                        slots: {
                          input: {
                            props: { value: `view_name`, yolmFocusKey: `true` },
                            on: {
                              click: (s) => s.stopPropagation(),
                              input: (s) =>
                                s.setScalar(`view_name`, `target_value`),
                              blur: (s) =>
                                s
                                  .setScalar(`view_name`, `trim(view_name)`)
                                  .if(
                                    `view_name = view_record.name or view_name = ''`,
                                    (s) =>
                                      s.setScalar(`editing`, `false`).return(),
                                  )
                                  .setScalar(`proc_in_progress`, `true`)
                                  .setScalar(`proc_error`, `null`)
                                  .commitUiTreeChanges()
                                  .try({
                                    body: (s) =>
                                      s.serviceProc((s) =>
                                        s
                                          .startTransaction()
                                          .modify(
                                            `update db.datagrid_view set name = view_name where id = view_record.id`,
                                          )
                                          .commitTransaction()
                                          .setScalar(
                                            `drawer_refresh_key`,
                                            `drawer_refresh_key + 1`,
                                          )
                                          .setQueryParam(
                                            `ui.view`,
                                            `view_name`,
                                          ),
                                      ),
                                    catch: (s) =>
                                      s.setScalar(
                                        `proc_error`,
                                        `'Unable to change view name at this time'`,
                                      ),
                                  })
                                  .setScalar(`proc_in_progress`, `false`)
                                  .setScalar(`editing`, `false`),
                              keydown: (s) =>
                                s.if(`event.key = 'Enter'`, (s) =>
                                  s
                                    .setScalar(`view_name`, `trim(view_name)`)
                                    .if(
                                      `view_name = view_record.name or view_name = ''`,
                                      (s) =>
                                        s
                                          .setScalar(`editing`, `false`)
                                          .return(),
                                    )
                                    .setScalar(`proc_in_progress`, `true`)
                                    .setScalar(`proc_error`, `null`)
                                    .commitUiTreeChanges()
                                    .try({
                                      body: (s) =>
                                        s.serviceProc((s) =>
                                          s
                                            .startTransaction()
                                            .modify(
                                              `update db.datagrid_view set name = view_name where id = view_record.id`,
                                            )
                                            .commitTransaction()
                                            .setScalar(
                                              `drawer_refresh_key`,
                                              `drawer_refresh_key + 1`,
                                            )
                                            .setQueryParam(
                                              `ui.view`,
                                              `view_record.id`,
                                            ),
                                        ),
                                      catch: (s) =>
                                        s.setScalar(
                                          `proc_error`,
                                          `'Unable to change view name at this time'`,
                                        ),
                                    })
                                    .setScalar(`proc_in_progress`, `false`)
                                    .setScalar(`editing`, `false`),
                                ),
                            },
                          },
                        },
                      }),
                    }),
                    else: [
                      nodes.element("span", {
                        styles: styles.viewName,
                        children: "view_record.name",
                      }),
                      nodes.element("div", { styles: flexGrowStyles }),
                      nodes.if(
                        `view_record.is_personal`,
                        materialIcon("PersonOutline"),
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
                            ariaLabel: `'Open Actions Menu'`,
                            on: {
                              click: (s) =>
                                s.stopPropagation().statements(onButtonClick),
                            },
                          }),
                        items: [
                          {
                            onClick: (s) =>
                              s.stopPropagation().setScalar(`editing`, `true`),
                            resetMenuAfter: true,
                            children: `'Rename'`,
                          },
                          {
                            onClick: (s) =>
                              s
                                .stopPropagation()
                                .setScalar(`proc_in_progress`, `true`)
                                .setScalar(`proc_error`, `null`)
                                .commitUiTreeChanges()
                                .try({
                                  body: (s) =>
                                    s.serviceProc((s) =>
                                      s
                                        .statements(
                                          duplicateView(`view_record.id`),
                                        )
                                        .setScalar(
                                          `drawer_refresh_key`,
                                          `drawer_refresh_key + 1`,
                                        )
                                        .setQueryParam(
                                          `ui.view`,
                                          `new_view_id`,
                                        ),
                                    ),
                                  catch: (s) =>
                                    s.setScalar(
                                      `proc_error`,
                                      `'Unable to duplicate view at this time'`,
                                    ),
                                })
                                .setScalar(`proc_in_progress`, `false`),
                            resetMenuAfter: true,
                            children: `'Duplicate'`,
                          },
                          {
                            onClick: (s) =>
                              s
                                .setScalar(`proc_in_progress`, `true`)
                                .setScalar(`proc_error`, `null`)
                                .commitUiTreeChanges()
                                .try({
                                  body: (s) =>
                                    s.serviceProc((s) =>
                                      s
                                        .statements(
                                          saveToExistingView(
                                            dts,
                                            `view_record.id`,
                                          ),
                                        )
                                        .setScalar(
                                          `drawer_refresh_key`,
                                          `drawer_refresh_key + 1`,
                                        )
                                        .setQueryParam(
                                          `ui.view`,
                                          `view_record.id`,
                                        ),
                                    ),
                                  errorName: `caught_error`,
                                  catch: (s) =>
                                    s.setScalar(
                                      `proc_error`,
                                      `'Error saving view'`,
                                    ),
                                })
                                .setScalar(`proc_in_progress`, `false`),
                            resetMenuAfter: true,
                            children: `'Save to'`,
                          },
                          {
                            onClick: (s) =>
                              s.stopPropagation().setScalar(`deleting`, `true`),
                            resetMenuAfter: true,
                            children: `'Delete'`,
                          },
                        ],
                      }),
                      deleteRecordDialog({
                        open: `deleting`,
                        onClose: (s) => s.setScalar(`deleting`, `false`),
                        afterTransactionCommit: (s) =>
                          s
                            .if(`view_record.id = view`, (s) =>
                              s.setQueryParam(`ui.view`, `null`),
                            )
                            .setScalar(
                              `drawer_refresh_key`,
                              `drawer_refresh_key + 1`,
                            ),
                        recordId: `view_record.id`,
                        table: `datagrid_view`,
                        confirmDescription: `'Are you sure you want to delete ' || view_record.name || '?'`,
                      }),
                    ],
                  }),
                }),
              }),
            }),
          }),
        },
        {
          condition: `true`,
          node: typography({
            children: `'No views'`,
            level: "body-sm",
            styles: styles.emptyText,
          }),
        },
      ),
    ],
  });
  return nodes.if(
    `view_drawer_open`,
    withViewDrawerState(datagridName, drawerContent),
  );
}
