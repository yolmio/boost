import { app } from "../../app";
import { nodes } from "../../nodeHelpers";
import { Node } from "../../nodeTypes";
import { createStyles } from "../../styleUtils";
import { memoize } from "../../utils/memoize";

export interface Opts {
  openScalar: string;
  buttonId: string;
  children: Node;
  name: string;
}

const createBounceKeyframes = memoize((origin: string) => {
  const enterAnimation = app.ui.registerKeyframes({
    "0%": {
      transform: "scale(0)",
      transformOrigin: origin,
    },
    "100%": {
      transform: "scale(1)",
      transformOrigin: origin,
    },
  });
  const exitAnimation = app.ui.registerKeyframes({
    from: {
      transform: "scale(1)",
      transformOrigin: origin,
    },
    to: {
      transform: "scale(0)",
      transformOrigin: origin,
    },
  });
  return { enterAnimation, exitAnimation };
});

export function createBounceViewTransition(name: string, origin: string) {
  const { enterAnimation, exitAnimation } = createBounceKeyframes(origin);
  app.ui.addGlobalStyle({
    [`::view-transition-group(${name})`]: {
      animationDuration: app.ui.theme.transitionDurations.popover,
      animationTimingFunction: app.ui.theme.transitionEasing.popover,
    },
    [`::view-transition-new(${name}):only-child`]: {
      animationName: enterAnimation,
    },
    [`::view-transition-old(${name}):only-child`]: {
      animationName: exitAnimation,
    },
  });
}

const styles = createStyles({
  popover: (name: string) => {
    createBounceViewTransition(name, "top left");
    return {
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
      viewTransitionName: name,
    };
  },
});

export function toolbarPopover({ openScalar, buttonId, children, name }: Opts) {
  return nodes.if(
    openScalar,
    nodes.portal(
      nodes.element("div", {
        styles: styles.popover(name),
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
          clickAway: (s) =>
            s.setScalar(openScalar, `false`).triggerViewTransition("immediate"),
          keydown: (s) =>
            s.if(`event.key = 'Escape'`, (s) =>
              s
                .setScalar(openScalar, `false`)
                .triggerViewTransition("immediate")
            ),
        },
        children,
      })
    )
  );
}
