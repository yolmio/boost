import { Node } from "../nodeTypes";
import { parenWrap } from "../utils/sqlHelpers";
import * as yom from "../yom";
import { nodes } from "../nodeHelpers";
import { DomStatementsOrFn } from "../statements";

export interface TransitionHelper {
  showing: (open: yom.SqlExpression) => yom.SqlExpression;
  transitionIfNode: (open: yom.SqlExpression, node: Node) => Node;
  startCloseTransition: DomStatementsOrFn;
  dynamicClasses: yom.DynamicClass[];
}

export function withExitTransition(
  duration: number,
  children: (node: TransitionHelper) => Node
) {
  return nodes.state({
    procedure: (s) => s.scalar(`in_exit_transition`, `false`),
    children: children({
      showing: (open) => parenWrap(open) + ` or in_exit_transition`,
      dynamicClasses: [
        { classes: "in_exit_transition", condition: "in_exit_transition" },
      ],
      transitionIfNode: (open, node) =>
        nodes.if(parenWrap(open) + ` or in_exit_transition`, node),
      startCloseTransition: (s) =>
        s.setScalar(`in_exit_transition`, `true`).spawn({
          procedure: (s) =>
            s
              .delay(duration.toString())
              .scalar(`should_commit`, `ui.in_exit_transition`)
              .setScalar(`ui.in_exit_transition`, `false`)
              .if("should_commit", (s) => s.commitUiChanges()),
          detached: true,
        }),
    }),
  });
}
