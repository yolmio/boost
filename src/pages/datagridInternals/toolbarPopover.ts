import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles } from "../../styleUtils";

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
  return nodes.if(
    openScalar,
    nodes.portal(
      nodes.element("div", {
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
          clickAway: (s) => s.setScalar(openScalar, `false`),
          keydown: (s) =>
            s.if(`event.key = 'Escape'`, (s) =>
              s.setScalar(openScalar, `false`)
            ),
        },
        children,
      })
    )
  );
}
