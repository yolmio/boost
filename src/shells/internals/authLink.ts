import { ifNode, state } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { scalar } from "../../procHelpers.js";

export function makeConditionalLink(node: Node, showIf?: string) {
  if (showIf) {
    return state({
      procedure: [scalar(`show_link`, showIf)],
      statusScalar: `status`,
      children: ifNode(`status = 'received' and show_link`, node),
    });
  } else {
    return node;
  }
}
