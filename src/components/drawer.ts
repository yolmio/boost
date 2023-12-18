import { nodes } from "../nodeHelpers";
import type { Node } from "../nodeTypes";
import { StyleObject } from "../styleTypes";
import { createStyles, cssVar } from "../styleUtils";
import { SlottedComponentWithSlotNames } from "./utils";
import { createSlotsFn } from "./utils";
import { styles as modalStyles } from "./modal";
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
  drawerStyles: (app, direction: Direction) => {
    const enterAnimation = app.registerKeyframes({
      from: {
        transform: getDrawerOutOfViewTransform(direction),
      },
      to: {
        transform: "translate(0%, 0)",
      },
    });
    const transform = getDrawerOutOfViewTransform(direction);
    const exitAnimation = app.registerKeyframes({
      from: {
        transform: "translate(0%, 0)",
      },
      to: {
        transform,
      },
    });
    app.addGlobalStyle({
      [`::view-transition-new(drawer-${direction}):only-child`]: {
        animation: `300ms cubic-bezier(0, 0, 0.2, 1) both ${enterAnimation}`,
      },
      [`::view-transition-old(drawer-${direction}):only-child`]: {
        animation: `300ms cubic-bezier(0, 0, 0.2, 1) both ${exitAnimation}`,
      },
      [`::view-transition-group(drawer-${direction})`]: {
        zIndex: 5,
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
      viewTransitionName: "drawer-" + direction,
      opacity: 1,
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
  const onClose = new DomStatements()
    .statements(opts.onClose)
    .triggerViewTransition("immediate");
  return nodes.if(opts.open, [
    nodes.portal(
      slot("root", {
        tag: "div",
        styles: modalStyles.root,
        on: {
          keydown: (s) => s.if("event.key = 'Escape'", onClose),
        },
        children: [
          slot("backdrop", {
            tag: "div",
            styles: modalStyles.backdrop(),
            props: { "aria-hidden": "true" },
          }),
          slot("drawer", {
            tag: "div",
            on: {
              clickAway: onClose,
            },
            styles: styles.drawerStyles(opts.direction),
            children: opts.children(onClose),
          }),
        ],
      }),
    ),
  ]);
}
