import { element, ifNode, portal } from "../../nodeHelpers.js";
import { Node } from "../../nodeTypes.js";
import { if_, setScalar } from "../../procHelpers.js";
import { createStyles } from "../../styleUtils.js";

export interface Opts {
  openScalar: string;
  buttonId: string;
  children: Node;
}

const styles = createStyles({
  popover: {
    backgroundColor: "background-popup",
    borderRadius: "md",
    boxShadow: "md",
    display: "flex",
    flexDirection: "column",
    py: 2,
    px: 3,
    zIndex: 100,
    border: "1px solid",
    borderColor: "divider",
    gap: 1,
  },
});

export function toolbarPopover({ openScalar, buttonId, children }: Opts) {
  return ifNode(
    openScalar,
    portal(
      element("div", {
        styles: styles.popover,
        props: { tabIndex: `-1` },
        floating: {
          anchorEl: buttonId,
          placement: `'bottom-start'`,
          strategy: `'absolute'`,
          shift: { mainAxis: "true", crossAxis: "true" },
          offset: {
            mainAxis: `4`,
            crossAxis: `0`,
          },
          flip: { crossAxis: `false`, mainAxis: `false` },
        },
        on: {
          clickAway: [setScalar(openScalar, `false`)],
          keydown: [
            if_(`event.key = 'Escape'`, [setScalar(openScalar, `false`)]),
          ],
        },
        children,
      })
    )
  );
}
