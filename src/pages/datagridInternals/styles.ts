import { app } from "../../app";
import { createStyles } from "../../styleUtils";

export const styles = createStyles({
  root: () => {
    app.ui.addGlobalStyle({
      "::view-transition-group(dg-body)": {
        animationDuration: app.ui.theme.transitionDurations.drawer,
        animationTimingFunction: app.ui.theme.transitionEasing.drawer,
      },
      'html[data-yolm-transition-type="open-view-drawer"]::view-transition-old(dg-body)':
        {
          position: "absolute",
          width: "100vw",
          overflow: "hidden",
          height: "100%",
          animationName: "none",
        },
      'html[data-yolm-transition-type~="open-view-drawer"]::view-transition-new(dg-body)':
        {
          display: "none",
        },
      'html[data-yolm-transition-type="close-view-drawer"]::view-transition-new(dg-body)':
        {
          position: "absolute",
          width: "100vw",
          overflow: "hidden",
          height: "100%",
          animationName: "none",
        },
      'html[data-yolm-transition-type~="close-view-drawer"]::view-transition-old(dg-body)':
        {
          display: "none",
        },
    });
    return {
      position: "relative",
      flexGrow: 1,
      height: "100%",
      backgroundColor: "common-white",
      dark: {
        backgroundColor: "common-black",
      },
      border: "1px solid",
      borderColor: "divider",
      viewTransitionName: "dg-body",
    };
  },
  row: { display: "flex" },
  cell: () => {
    return {
      "&:focus-within": {
        "--focus-outline-offset": -1,
        ...app.ui.theme.focus.default,
      },
      display: "flex",
      alignItems: "center",
      px: "10px",
      borderBottom: "1px solid",
      boxSizing: "border-box",
      cursor: "default",
      borderRight: "1px solid",
      borderColor: "divider",
    };
  },
  headerCell: () => {
    return {
      "&:focus-within": {
        "--focus-outline-offset": -1,
        ...app.ui.theme.focus.default,
      },
      display: "flex",
      alignItems: "center",
      pl: "10px",
      pr: "4px",
      justifyContent: "space-between",
      borderBottom: "1px solid",
      boxSizing: "border-box",
      position: "relative",
      cursor: "default",
      borderRight: "1px solid",
      borderColor: "divider",
      backgroundColor: "neutral-50",
      dark: {
        backgroundColor: "neutral-800",
      },
    };
  },
  header: {
    display: "flex",
    position: "sticky",
    top: 0,
    zIndex: 2,
    backgroundColor: "common-white",
    dark: {
      backgroundColor: "common-black",
    },
  },
  headerText: {
    display: "block",
    textOverflow: "ellipsis",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  popoverDivider: {
    mt: 1,
  },
  popoverButtons: {
    display: "flex",
    gap: 1,
  },
  ellipsisSpan: {
    textOverflow: "ellipsis",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  cellInput: {
    font: "inherit",
    letterSpacing: "inherit",
    color: "currentcolor",
    p: 0,
    border: 0,
    boxSizing: "content-box",
    background: "none",
    height: "100%",
    width: "100%",
    m: 0,
    display: "block",
    outline: "none",
  },
  emptyGrid: {
    position: "relative",
    flexGrow: 1,
    height: "100%",
    backgroundColor: "common-white",
    dark: {
      backgroundColor: "common-black",
    },
    border: "1px solid",
    borderColor: "divider",
  },
});
