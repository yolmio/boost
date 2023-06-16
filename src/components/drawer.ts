import { parenWrap } from "../utils/sqlHelpers.js";
import { ClientProcStatement } from "../yom.js";
import {
  commitUiChanges,
  delay,
  if_,
  scalar,
  setScalar,
  spawn,
  stopPropagation,
} from "../procHelpers.js";
import { element, ifNode, portal, state } from "../nodeHelpers.js";
import type { Node } from "../nodeTypes.js";
import { registerKeyframes } from "../nodeTransform.js";
import { StyleObject } from "../styleTypes.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { SlottedComponentWithSlotNames } from "./utils.js";
import { createSlotsFn } from "./utils.js";
import { backdropStyles } from "./modal.js";

type Direction = "left" | "right";

export interface DrawerOpts extends SlottedComponentWithSlotNames<"drawer"> {
  open: string;
  direction: Direction;

  onClose: ClientProcStatement[];
  children: (close: ClientProcStatement[]) => Node;
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
      flex: "1 0 auto",
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
      "&.in_exit_animation": {
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
  const closeWithAnimation = [
    ...opts.onClose,
    setScalar(`ui.in_exit_animation`, `true`),
    spawn({
      detached: true,
      statements: [
        delay(`200`),
        setScalar(`ui.in_exit_animation`, `false`),
        commitUiChanges(),
      ],
    }),
  ];
  return state({
    procedure: [scalar(`in_exit_animation`, `false`)],
    children: ifNode(parenWrap(opts.open) + ` or in_exit_animation`, [
      portal(
        slot("root", {
          tag: "div",
          styles: backdropStyles(),
          dynamicClasses: [
            {
              classes: "in_exit_animation",
              condition: "in_exit_animation",
            },
          ],
          on: {
            keydown: [if_("event.key = 'Escape'", closeWithAnimation)],
          },
          children: slot("drawer", {
            tag: "div",
            on: {
              clickAway: closeWithAnimation,
            },
            styles: styles.drawerStyles(opts.direction),
            dynamicClasses: [
              {
                classes: "in_exit_animation",
                condition: "in_exit_animation",
              },
            ],
            children: opts.children(closeWithAnimation),
          }),
        })
      ),
    ]),
  });
}
