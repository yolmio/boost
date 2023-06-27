import { ifNode, state } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import {
  commitUiChanges,
  delay,
  if_,
  scalar,
  setScalar,
  spawn,
} from "../procHelpers.js";
import { parenWrap } from "../utils/sqlHelpers.js";
import { ClientProcStatement, DynamicClass, SqlExpression } from "../yom.js";

export interface TransitionHelper {
  showing: (open: SqlExpression) => SqlExpression;
  transitionIfNode: (open: SqlExpression, node: Node) => Node;
  startCloseTransition: ClientProcStatement[];
  dynamicClasses: DynamicClass[];
}

export function withExitTransition(
  duration: number,
  children: (node: TransitionHelper) => Node
) {
  return state({
    procedure: [scalar(`in_exit_transition`, `false`)],
    children: children({
      showing: (open) => parenWrap(open) + ` or in_exit_transition`,
      dynamicClasses: [
        { classes: "in_exit_transition", condition: "in_exit_transition" },
      ],
      transitionIfNode: (open, node) =>
        ifNode(parenWrap(open) + ` or in_exit_transition`, node),
      startCloseTransition: [
        setScalar(`in_exit_transition`, `true`),
        spawn({
          detached: true,
          statements: [
            delay(duration.toString()),
            scalar(`should_commit`, `ui.in_exit_transition`),
            setScalar(`ui.in_exit_transition`, `false`),
            if_("should_commit", commitUiChanges()),
          ],
        }),
      ],
    }),
  });
}
