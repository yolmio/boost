import {
  BasicStatements,
  DomStatements,
  DomStatementsOrFn,
  ServiceStatementsOrFn,
} from "../statements";
import type { Node } from "../nodeTypes";
import * as yom from "../yom";
import { materialIcon } from "./materialIcon";
import { iconButton } from "./iconButton";
import { button } from "./button";
import { snackbar } from "./snackbar";
import { nodes } from "../nodeHelpers";
import { lazy } from "../utils/memoize";
import { createStyles } from "../styleUtils";

export interface UndoSnackbarsOptions {
  successSnackbarContent: Node;
  afterUndo?: ServiceStatementsOrFn;
  afterUndoClient?: DomStatementsOrFn;
}

const undoTxScalar = `snackbar_tx_to_undo`;
const currentlyOpenScalar = `undo_snackbar_currently_open`;

enum SnackbarType {
  Success = "0",
  Failure = "1",
  UndoSuccess = "2",
}

const undoSuccessSnackbar = lazy(() =>
  snackbar({
    variant: "soft",
    color: "success",
    children: "'Successfully performed undo'",
    anchorOrigin: { vertical: "bottom", horizontal: "center" },
    startDecorator: materialIcon("CheckCircle"),
    endDecorator: iconButton({
      variant: "plain",
      color: "harmonize",
      children: materialIcon("Close"),
      on: { click: (s) => s.setScalar(currentlyOpenScalar, `null`) },
      ariaLabel: `'Close snackbar'`,
    }),
  }),
);

const failureSnackbar = lazy(() =>
  snackbar({
    variant: "soft",
    color: "danger",
    children: "'Unable to perform undo'",
    anchorOrigin: { vertical: "bottom", horizontal: "center" },
    startDecorator: materialIcon("Warning"),
    endDecorator: iconButton({
      variant: "plain",
      color: "harmonize",
      children: materialIcon("Close"),
      on: { click: (s) => s.setScalar(currentlyOpenScalar, `null`) },
      ariaLabel: `'Close snackbar'`,
    }),
  }),
);

const styles = createStyles({
  successEndDecorator: {
    display: "flex",
    gap: 1,
    ml: 4,
  },
});

export function createUndoSnackbars(opts: UndoSnackbarsOptions): UndoSnackbars {
  const successSnackbar = snackbar({
    variant: "soft",
    color: "success",
    children: opts.successSnackbarContent,
    invertColors: true,
    startDecorator: materialIcon("CheckCircle"),
    anchorOrigin: { vertical: "bottom", horizontal: "center" },
    endDecorator: nodes.element("div", {
      styles: styles.successEndDecorator,
      children: [
        button({
          variant: "soft",
          color: "harmonize",
          children: "'Undo'",
          on: {
            click: (s) =>
              s
                .try({
                  body: (s) =>
                    s.serviceProc((s) =>
                      s
                        .startTransaction()
                        .if(
                          `(select creator != current_user() from db.tx where id = ${undoTxScalar})`,
                          (s) => s.throwError(`'Nice try hackerman'`),
                        )
                        .undoTx(undoTxScalar)
                        .commitTransaction()
                        .statements(opts.afterUndo),
                    ),
                  errorName: `err`,
                  catch: (s) =>
                    s
                      .setScalar(currentlyOpenScalar, SnackbarType.Failure)
                      .spawn({
                        detached: true,
                        procedure: (s) =>
                          s
                            .delay(`3000`)
                            .if(
                              `${currentlyOpenScalar} = ${SnackbarType.Failure}`,
                              (s) =>
                                s
                                  .setScalar(currentlyOpenScalar, `null`)
                                  .commitUiTreeChanges(),
                            ),
                      })
                      .return(),
                })
                .setScalar(currentlyOpenScalar, SnackbarType.UndoSuccess)
                .spawn({
                  detached: true,
                  procedure: (s) =>
                    s
                      .delay(`3000`)
                      .if(
                        `${currentlyOpenScalar} = ${SnackbarType.UndoSuccess}`,
                        (s) =>
                          s
                            .setScalar(currentlyOpenScalar, `null`)
                            .commitUiTreeChanges(),
                      ),
                })
                .statements(opts.afterUndoClient),
          },
        }),
        iconButton({
          variant: "plain",
          color: "harmonize",
          children: materialIcon("Close"),
          on: { click: (s) => s.setScalar(currentlyOpenScalar, `null`) },
          ariaLabel: `'Close snackbar'`,
        }),
      ],
    }),
  });
  return {
    wrap: (node) =>
      nodes.state({
        procedure: (s) =>
          s
            .scalar(currentlyOpenScalar, { type: "TinyUint" })
            .scalar(undoTxScalar, { type: "BigUint" }),
        children: [
          node,
          nodes.switch(
            {
              condition: `${currentlyOpenScalar} = ${SnackbarType.Success}`,
              node: successSnackbar,
            },
            {
              condition: `${currentlyOpenScalar} = ${SnackbarType.Failure}`,
              node: failureSnackbar(),
            },
            {
              condition: `${currentlyOpenScalar} = ${SnackbarType.UndoSuccess}`,
              node: undoSuccessSnackbar(),
            },
          ),
        ],
      }),
    setUndoTx: (tx) =>
      new BasicStatements().setScalar(undoTxScalar, tx ?? `current_tx()`),
    openSuccess: new DomStatements()
      .setScalar(currentlyOpenScalar, SnackbarType.Success)
      .spawn({
        detached: true,
        procedure: (s) =>
          s
            .delay(`7500`)
            .if(`${currentlyOpenScalar} = ${SnackbarType.Success}`, (s) =>
              s.setScalar(currentlyOpenScalar, `null`).commitUiTreeChanges(),
            ),
      }),
    closeSuccess: new BasicStatements().setScalar(currentlyOpenScalar, `null`),
    delayedCloseSuccess: new DomStatements().spawn({
      detached: true,
      procedure: (s) =>
        s
          .delay(`7500`)
          .if(`${currentlyOpenScalar} = ${SnackbarType.Success}`, (s) =>
            s.setScalar(currentlyOpenScalar, `null`).commitUiTreeChanges(),
          ),
    }),
    openSuccessWithoutDelayedClose: (tx) =>
      new BasicStatements()
        .setScalar(undoTxScalar, tx)
        .setScalar(currentlyOpenScalar, SnackbarType.Success),
  };
}

export interface UndoSnackbars {
  wrap: (node: Node) => Node;
  setUndoTx: (tx?: yom.SqlExpression) => BasicStatements;
  openSuccess: DomStatements;
  openSuccessWithoutDelayedClose: (tx: yom.SqlExpression) => BasicStatements;
  delayedCloseSuccess: DomStatements;
  closeSuccess: BasicStatements;
}
