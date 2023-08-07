import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";

export function makeConditionalLink(node: Node, showIf?: string) {
  if (showIf) {
    return nodes.state({
      procedure: (s) => s.scalar(`show_link`, showIf),
      statusScalar: `status`,
      children: nodes.if(`status = 'received' and show_link`, node),
    });
  } else {
    return node;
  }
}
