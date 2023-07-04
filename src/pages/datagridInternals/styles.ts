import { model } from "../../singleton.js";
import { createStyles } from "../../styleUtils.js";

export const styles = createStyles({
  root: {
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
  row: { display: "flex" },
  cell: () => {
    return {
      "&:focus-within": {
        "--focus-outline-offset": -1,
        ...model.theme.focus.default,
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
        ...model.theme.focus.default,
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
