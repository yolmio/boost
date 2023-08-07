import * as yom from "../yom";
import { nodes } from "../nodeHelpers";
import type { Node } from "../nodeTypes";
import { registerKeyframes } from "../nodeTransform";
import { StyleObject } from "../styleTypes";
import { createStyles, cssVar } from "../styleUtils";
import { SlottedComponentWithSlotNames } from "./utils";
import { createSlotsFn } from "./utils";
import { styles as modalStyles } from "./modal";
import { withExitTransition } from "./withExitTransition";
import { DomStatementsOrFn, DomStatements } from "../statements";

type Direction = "left" | "right";

export interface DrawerOpts
  extends SlottedComponentWithSlotNames<"drawer" | "backdrop"> {
  open: string;
  direction: Direction;

  onClose: DomStatementsOrFn;
  children: (close: DomStatements) => Node;
}

const styles = createStyles({
  drawerStyles: (direction: Direction) => {
    const enterAnimation = registerKeyframes({
      from: {
        transform: getDrawerOutOfViewTransform(direction),
      },
      to: {
        transform: "translate(0%, 0)",
      },
    });
    const transform = getDrawerOutOfViewTransform(direction);
    const exitAnimation = registerKeyframes({
      from: {
        transform: "translate(0%, 0)",
      },
      to: {
        transform,
      },
    });
    const styles: StyleObject = {
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      position: "fixed",
      top: 0,
      backgroundColor: "background-popup",
      p: 2,
      minWidth: 300,
      transform: "translate(0%, 0)",
      zIndex: 9999,
      animationName: enterAnimation,
      animationTimingFunction: "ease-out",
      animationDuration: "200ms",
      opacity: 1,
      "&.in_exit_transition": {
        animationName: exitAnimation,
        animationTimingFunction: "ease-in",
        transform,
      },
    };
    if (direction === "right") {
      styles.right = 0;
      styles.borderLeft = "1px solid";
      styles.borderTopLeftRadius = cssVar(`radius-md`);
      styles.borderBottomLeftRadius = cssVar(`radius-md`);
    } else {
      styles.left = 0;
      styles.borderRight = "1px solid";
      styles.borderTopRightRadius = cssVar(`radius-md`);
      styles.borderBottomRightRadius = cssVar(`radius-md`);
    }
    styles.borderColor = "neutral-outlined-border";
    return styles;
  },
});

function getDrawerOutOfViewTransform(direction: Direction) {
  return direction === "right" ? "translate(100%, 0)" : "translate(-100%, 0)";
}

export function drawer(opts: DrawerOpts) {
  const slot = createSlotsFn(opts);
  return withExitTransition(
    200,
    ({ dynamicClasses, transitionIfNode, startCloseTransition }) => {
      const onClose = new DomStatements()
        .statements(opts.onClose)
        .statements(startCloseTransition);
      return transitionIfNode(opts.open, [
        nodes.portal(
          slot("root", {
            tag: "div",
            styles: modalStyles.root(),
            dynamicClasses,
            on: {
              keydown: (s) => s.if("event.key = 'Escape'", onClose),
            },
            children: [
              slot("backdrop", {
                tag: "div",
                styles: modalStyles.backdrop,
                dynamicClasses,
                props: { "aria-hidden": "true" },
              }),
              slot("drawer", {
                tag: "div",
                on: {
                  clickAway: onClose,
                },
                styles: styles.drawerStyles(opts.direction),
                dynamicClasses,
                children: opts.children(onClose),
              }),
            ],
          })
        ),
      ]);
    }
  );
}
