import { nodes } from "../nodeHelpers";
import { registerKeyframes } from "../nodeTransform";
import { Node } from "../nodeTypes";
import { app } from "../app";
import { createStyles, cssVar } from "../styleUtils";
import { Variant } from "../theme";
import {
  createSlotsFn,
  mergeEls,
  SingleElementComponentOpts,
  SlottedComponentWithSlotNames,
} from "./utils";
import { withExitTransition } from "./withExitTransition";
import { DomStatements, DomStatementsOrFn } from "../statements";

export interface ModalOpts
  extends SlottedComponentWithSlotNames<"backdrop" | "overflow"> {
  open: string;
  onClose: DomStatementsOrFn;
  children: (close: DomStatements) => Node;
}

export const styles = createStyles({
  root: () => {
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
      position: "fixed",
      zIndex: 1300,
      inset: 0,
      backdropFilter: "blur(8px)",
      opacity: "1",
      animationName: enterAnimation,
      animationTimingFunction: "ease-out",
      animationDuration: "200ms",
      "&.in_exit_transition": {
        animationName: exitAnimation,
        animationTimingFunction: "ease-in",
        backdropFilter: "blur(0px)",
        opacity: "0",
      },
    };
  },
  backdrop: {
    zIndex: -1,
    position: "fixed",
    inset: 0,
    overflowY: "auto",
    overflowX: "hidden",
    backgroundColor: "background-backdrop",
    WebkitTapHighlightColor: "transparent",
  },
  overflow: {
    position: "absolute",
    inset: 0,
    height: "100%",
    overflow: "hidden auto",
    outline: "none",
    display: "flex",
    flexDirection: "column", // required for fullscreen ModalDialog, using `row` cannot be achieved.
  },
  dialog: (size: Size, layout: DialogLayout) => {
    return {
      // Divider integration
      "--divider-inset": "calc(-1 * var(--modal-dialog-padding))",
      "--modal-close-radius":
        "max((var(--modal-dialog-radius) - var(--variant-border-width, 0px)) - var(--modal-close-inset), min(var(--modal-close-inset) / 2, (var(--modal-dialog-radius) - var(--variant-borderWidth, 0px)) / 2))",
      ...(size === "sm" && {
        "--modal-dialog-padding": app.theme.spacing(1.25),
        "--modal-dialog-radius": cssVar(`radius-sm`),
        "--modal-close-inset": app.theme.spacing(0.75),
        fontSize: cssVar(`font-size-sm`),
      }),
      ...(size === "md" && {
        "--modal-dialog-padding": app.theme.spacing(2),
        "--modal-dialog-radius": cssVar(`radius-md`),
        "--modal-close-inset": app.theme.spacing(1),
        fontSize: cssVar(`font-size-md`),
      }),
      ...(size === "lg" && {
        "--modal-dialog-padding": app.theme.spacing(3),
        "--modal-dialog-radius": cssVar(`radius-md`),
        "--modal-close-inset": app.theme.spacing(1.5),
        fontSize: cssVar(`font-size-md`),
      }),
      boxSizing: "border-box",
      boxShadow: "md",
      borderRadius: "var(--modal-dialog-radius)",
      fontFamily: cssVar(`font-family-body`),
      lineHeight: cssVar(`line-height-md`),
      padding: "var(--modal-dialog-padding)",
      minWidth:
        "min(calc(100vw - 2 * var(--modal-dialog-padding)), var(--modal-dialog-min-width, 300px))",
      outline: 0,
      background: cssVar(`palette-background-body`),
      ...(layout === "fullscreen" && {
        borderRadius: 0,
        width: "100%",
        margin: "calc(-1 * var(--modal-overflow-padding-y)) 0",
        flex: 1,
      }),
      ...(layout === "center" && {
        height: "max-content", // height is based on content, otherwise `margin: auto` will take place.
        margin: "auto",
      }),
      ...(layout === "fullscreenOnMobile" && {
        borderRadius: 0,
        width: "100%",
        margin: "calc(-1 * var(--modal-overflow-padding-y)) 0",
        flex: 1,
        height: "auto",
        md: {
          margin: "auto",
          height: "max-content", // height is based on content, otherwise `margin: auto` will take place.
          width: "unset",
          borderRadius: "var(--modal-dialog-radius)",
          flex: "unset",
        },
      }),
    };
  },
});

export function modal(opts: ModalOpts) {
  const slot = createSlotsFn(opts);
  return withExitTransition(
    200,
    ({ transitionIfNode, dynamicClasses, startCloseTransition }) => {
      const close = new DomStatements().statements(
        opts.onClose,
        startCloseTransition
      );
      return transitionIfNode(
        opts.open,
        nodes.portal(
          slot("root", {
            tag: "div",
            styles: styles.root(),
            dynamicClasses,
            on: {
              click: close,
              keydown: (s) => s.if("event.key = 'Escape'", close),
            },
            children: [
              slot("backdrop", {
                tag: "div",
                styles: styles.backdrop,
                dynamicClasses,
                props: { "aria-hidden": "true" },
              }),
              slot("overflow", {
                tag: "div",
                styles: styles.overflow,
                children: opts.children(close),
              }),
            ],
          })
        )
      );
    }
  );
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
      on: { click: (s) => s.stopPropagation() },
      focusLock: {},
      scrollLock: { enabled: `true` },
      children: opts.children,
    },
    opts
  );
}
