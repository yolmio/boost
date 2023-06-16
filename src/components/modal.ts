import { element, ifNode, portal, state } from "../nodeHelpers.js";
import { registerKeyframes } from "../nodeTransform.js";
import { Node } from "../nodeTypes.js";
import {
  commitUiChanges,
  delay,
  if_,
  scalar,
  setScalar,
  spawn,
  stopPropagation,
} from "../procHelpers.js";
import { theme } from "../singleton.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { Variant } from "../theme.js";
import { lazy } from "../utils/memoize.js";
import { parenWrap } from "../utils/sqlHelpers.js";
import { ClientProcStatement } from "../yom.js";
import {
  createSlotsFn,
  mergeEls,
  SingleElementComponentOpts,
  SlottedComponentWithSlotNames,
} from "./utils.js";

export interface ModalOpts extends SlottedComponentWithSlotNames<"backdrop"> {
  open: string;
  onClose: ClientProcStatement[];
  children: (close: ClientProcStatement[]) => Node;
}

export const backdropStyles = lazy(() => {
  const enterAnimation = registerKeyframes({
    from: {
      backdropFilter: "blur(0px)",
      opacity: "0",
    },
    to: {
      backdropFilter: "blur(8px)",
      opacity: "1",
    },
  });
  const exitAnimation = registerKeyframes({
    from: {
      backdropFilter: "blur(8px)",
      opacity: "1",
    },
    to: {
      backdropFilter: "blur(0px)",
      opacity: "0",
    },
  });
  return {
    zIndex: 1300,
    position: "fixed",
    right: 0,
    bottom: 0,
    top: 0,
    left: 0,
    overflowY: "auto",
    overflowX: "hidden",
    backgroundColor: cssVar(`palette-background-backdrop`),
    WebkitTapHighlightColor: "transparent",
    backdropFilter: "blur(8px)",
    opacity: "1",
    animationName: enterAnimation,
    animationTimingFunction: "ease-out",
    animationDuration: "200ms",
    "&.in_exit_animation": {
      animationName: exitAnimation,
      animationTimingFunction: "ease-in",
      backdropFilter: "blur(0px)",
      opacity: "0",
    },
  };
});

const styles = createStyles({
  modalRoot: {
    position: "fixed",
    zIndex: 1300,
    right: 0,
    bottom: 0,
    top: 0,
    left: 0,
  },
  dialog: (size: Size, layout: DialogLayout) => {
    return {
      // Divider integration
      "--divider-inset": "calc(-1 * var(--modal-dialog-padding))",
      "--modal-close-radius":
        "max((var(--modal-dialog-radius) - var(--variant-border-width, 0px)) - var(--modal-close-inset), min(var(--modal-close-inset) / 2, (var(--modal-dialog-radius) - var(--variant-borderWidth, 0px)) / 2))",
      ...(size === "sm" && {
        "--modal-dialog-padding": theme.spacing(1.25),
        "--modal-dialog-radius": cssVar(`radius-sm`),
        "--modal-close-inset": theme.spacing(0.75),
        fontSize: cssVar(`font-size-sm`),
      }),
      ...(size === "md" && {
        "--modal-dialog-padding": theme.spacing(2),
        "--modal-dialog-radius": cssVar(`radius-md`),
        "--modal-close-inset": theme.spacing(1),
        fontSize: cssVar(`font-size-md`),
      }),
      ...(size === "lg" && {
        "--modal-dialog-padding": theme.spacing(3),
        "--modal-dialog-radius": cssVar(`radius-md`),
        "--modal-close-inset": theme.spacing(1.5),
        fontSize: cssVar(`font-size-md`),
      }),
      boxSizing: "border-box",
      boxShadow: theme.shadow.md,
      borderRadius: "var(--modal-dialog-radius)",
      fontFamily: cssVar(`font-family-body`),
      lineHeight: cssVar(`line-height-md`),
      padding: "var(--modal-dialog-padding)",
      minWidth:
        "min(calc(100vw - 2 * var(--modal-dialog-padding)), var(--modal-dialog-min-width, 300px))",
      outline: 0,
      position: "absolute",
      background: cssVar(`palette-background-body`),
      overflow: "auto",
      ...(layout === "fullscreen" && {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: 0,
        borderRadius: 0,
      }),
      ...(layout === "center" && {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }),
      ...(layout === "fullscreenOnMobile" && {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: 0,
        borderRadius: 0,
        md: {
          top: "50%",
          left: "50%",
          right: "unset",
          bottom: "unset",
          transform: "translate(-50%, -50%)",
        },
      }),
    };
  },
});

export function modal(opts: ModalOpts) {
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
    children: ifNode(
      parenWrap(opts.open) + ` or in_exit_animation`,
      portal(
        slot("root", {
          tag: "div",
          styles: styles.modalRoot,
          children: slot("backdrop", {
            tag: "div",
            styles: backdropStyles(),
            dynamicClasses: [
              {
                classes: "in_exit_animation",
                condition: "in_exit_animation",
              },
            ],
            on: {
              click: closeWithAnimation,
              keydown: [if_("event.key = 'Escape'", closeWithAnimation)],
            },
            children: opts.children(closeWithAnimation),
          }),
        })
      )
    ),
  });
}

type Size = "sm" | "md" | "lg";
type DialogLayout = "center" | "fullscreen" | "fullscreenOnMobile";

export interface ModalDialogOpts extends SingleElementComponentOpts {
  layout?: DialogLayout;
  size?: Size;
  variant?: Variant;
  children: Node;
}

export function modalDialog(opts: ModalDialogOpts) {
  return mergeEls(
    {
      tag: "div",
      styles: styles.dialog(
        opts.size ?? "md",
        opts.layout ?? "fullscreenOnMobile"
      ),
      on: { click: [stopPropagation()] },
      focusLock: {},
      scrollLock: { enabled: `true` },
      children: opts.children,
    },
    opts
  );
}
