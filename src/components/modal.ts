import { nodes } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { app } from "../app";
import { createStyles, cssVar, fadeIn, fadeOut } from "../styleUtils";
import { Variant } from "../theme";
import {
  createSlotsFn,
  mergeEls,
  SingleElementComponentOpts,
  SlottedComponentWithSlotNames,
} from "./utils";
import { DomStatements, DomStatementsOrFn } from "../statements";
import { lazy, memoize } from "../utils/memoize";

export interface ModalOpts
  extends SlottedComponentWithSlotNames<"backdrop" | "overflow"> {
  open: string;
  onClose: DomStatementsOrFn;
  children: (close: DomStatements) => Node;
}

export const styles = createStyles({
  root: {
    position: "fixed",
    zIndex: 1300,
    inset: 0,
  },
  backdrop: () => {
    app.ui.addGlobalStyle({
      "::view-transition-new(modal-backdrop):only-child": {
        animationName: fadeIn(),
      },
      "::view-transition-old(modal-backdrop):only-child": {
        animationName: fadeOut(),
      },
      "::view-transition-group(modal-backdrop)": {
        zIndex: 2,
        animationDuration: app.ui.theme.transitionDurations.dialog,
        animationTimingFunction: app.ui.theme.transitionEasing.dialog,
      },
    });
    return {
      zIndex: -1,
      position: "fixed",
      inset: 0,
      overflowY: "auto",
      overflowX: "hidden",
      backgroundColor: "background-backdrop",
      opacity: 1,
      WebkitTapHighlightColor: "transparent",
      viewTransitionName: "modal-backdrop",
    };
  },
  overflow: {
    position: "absolute",
    inset: 0,
    height: "100%",
    overflow: "hidden auto",
    outline: "none",
    display: "flex",
    flexDirection: "column", // required for fullscreen ModalDialog, using `row` cannot be achieved.
    opacity: 1,
  },
  dialog: (size: Size, layout: DialogLayout) => {
    return {
      // Divider integration
      "--divider-inset": "calc(-1 * var(--modal-dialog-padding))",
      "--modal-close-radius":
        "max((var(--modal-dialog-radius) - var(--variant-border-width, 0px)) - var(--modal-close-inset), min(var(--modal-close-inset) / 2, (var(--modal-dialog-radius) - var(--variant-borderWidth, 0px)) / 2))",
      ...(size === "sm" && {
        "--modal-dialog-padding": app.ui.theme.spacing(1.25),
        "--modal-dialog-radius": cssVar(`radius-sm`),
        "--modal-close-inset": app.ui.theme.spacing(0.75),
        fontSize: cssVar(`font-size-sm`),
      }),
      ...(size === "md" && {
        "--modal-dialog-padding": app.ui.theme.spacing(2),
        "--modal-dialog-radius": cssVar(`radius-md`),
        "--modal-close-inset": app.ui.theme.spacing(1),
        fontSize: cssVar(`font-size-md`),
      }),
      ...(size === "lg" && {
        "--modal-dialog-padding": app.ui.theme.spacing(3),
        "--modal-dialog-radius": cssVar(`radius-md`),
        "--modal-close-inset": app.ui.theme.spacing(1.5),
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
      viewTransitionName: "dialog-" + layout,
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
  const close = new DomStatements()
    .statements(opts.onClose)
    .triggerViewTransition("immediate");
  return nodes.if(
    opts.open,
    nodes.portal(
      slot("root", {
        tag: "div",
        styles: styles.root,
        on: {
          click: close,
          keydown: (s) => s.if("event.key = 'Escape'", close),
        },
        children: [
          slot("backdrop", {
            tag: "div",
            styles: styles.backdrop(),
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

type Size = "sm" | "md" | "lg";
type DialogLayout = "center" | "fullscreen" | "fullscreenOnMobile";

export interface ModalDialogOpts extends SingleElementComponentOpts {
  layout?: DialogLayout;
  size?: Size;
  variant?: Variant;
  children: Node;
}

const centerDialogEnter = lazy(() =>
  app.ui.registerKeyframes({
    "0%": {
      transform: "scale(0.33) translateY(-50%)",
      opacity: 0,
    },
    "80%": {
      transform: "scale(1.02) translateY(2%)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(1) translateY(0%)",
      opacity: 1,
    },
  })
);
const centerDialogExit = lazy(() =>
  app.ui.registerKeyframes({
    "0%": {
      transform: "scale(1) translateY(0%)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(0.33) translateY(-50%)",
      opacity: 0,
    },
  })
);
const fullscreenDialogEnter = lazy(() =>
  app.ui.registerKeyframes({
    "0%": {
      transform: "scale(0.33)",
      opacity: 0,
    },
    "100%": {
      transform: "scale(1)",
      opacity: 1,
    },
  })
);
const fullscreenDialogExit = lazy(() =>
  app.ui.registerKeyframes({
    "0%": {
      transform: "scale(1)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(0.33)",
      opacity: 0,
    },
  })
);

export const addDialogViewTransitionStyles = memoize((layout: DialogLayout) => {
  const viewTransitionName = `dialog-${layout}`;
  app.ui.addGlobalStyle({
    [`::view-transition-group(${viewTransitionName})`]: {
      zIndex: 5,
      animationDuration: app.ui.theme.transitionDurations.dialog,
      animationTimingFunction: app.ui.theme.transitionEasing.dialog,
    },
  });
  switch (layout) {
    case "center":
      app.ui.addGlobalStyle({
        [`::view-transition-new(${viewTransitionName}):only-child`]: {
          animationName: centerDialogEnter(),
        },
        [`::view-transition-old(${viewTransitionName}):only-child`]: {
          animationName: centerDialogExit(),
        },
      });
      break;
    case "fullscreen":
      app.ui.addGlobalStyle({
        [`::view-transition-new(${viewTransitionName}):only-child`]: {
          animationName: fullscreenDialogEnter(),
        },
        [`::view-transition-old(${viewTransitionName}):only-child`]: {
          animationName: fullscreenDialogExit(),
        },
      });
      break;
    case "fullscreenOnMobile":
      app.ui.addGlobalStyle({
        [`::view-transition-new(${viewTransitionName}):only-child`]: {
          animationName: fullscreenDialogEnter(),
        },
        [`::view-transition-old(${viewTransitionName}):only-child`]: {
          animationName: fullscreenDialogExit(),
        },
        [app.ui.theme.breakpoints.up("md")]: {
          [`::view-transition-new(${viewTransitionName}):only-child`]: {
            animationName: centerDialogEnter(),
          },
          [`::view-transition-old(${viewTransitionName}):only-child`]: {
            animationName: centerDialogExit(),
          },
        },
      });
      break;
  }
});

export function modalDialog(opts: ModalDialogOpts) {
  addDialogViewTransitionStyles(opts.layout ?? "fullscreenOnMobile");
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
