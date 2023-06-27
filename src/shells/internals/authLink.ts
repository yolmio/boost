import { Authorization } from "../../modelTypes.js";
import { ifNode, state } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { scalar } from "../../procHelpers.js";
import { currentUserIsAuthorized } from "../../utils/auth.js";

export function makeAuthorizedLink(node: Node, auth?: Authorization) {
  if (auth) {
    return state({
      procedure: [scalar(`show_link`, currentUserIsAuthorized(auth))],
      statusScalar: `status`,
      children: ifNode(`status = 'received' and show_link`, node),
    });
  } else {
    return node;
  }
}
