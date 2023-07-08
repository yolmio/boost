import { baseGridStyles, createStyles } from "../../styleUtils.js";

export const genericFormStyles = createStyles({
  actionButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 1.5,
  },
  pageHeader: {
    fontSize: "xl2",
    fontWeight: "lg",
    my: 0,
  },
  errorText: {
    display: "flex",
    alignItems: "center",
    fontSize: "sm",
    lineHeight: "sm",
    color: "danger-500",
    marginTop: 0.375,
  },
});

export const multiCardInsertStyles = createStyles({
  relationCard: {
    p: 2,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    sm: {
      p: 3,
    },
    dark: {
      backgroundColor: "neutral-800",
    },
  },
  addButtonWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    py: 4,
  },
  addButton: {
    backgroundColor: "transparent",
    display: "flex",
    alignItems: "center",
    borderColor: "neutral-400",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: "lg",
    px: 6,
    py: 4,
    cursor: "pointer",
    "&:hover": {
      borderColor: "primary-600",
    },
  },
});

export const twoColumnFormStyles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 3.5,
  },
  section: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 3.5,
    md: {
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
    },
    xl: {
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 3fr)",
    },
  },
  partsWrapper: {
    ...baseGridStyles,
    rowGap: 3.5,
    columnGap: 2,
  },
  header: {
    mb: 1,
    fontSize: "lg",
  },
  description: {
    my: 0,
    fontSize: "md",
    color: "text-secondary",
  },
  cardRelation: {
    display: "grid",
    gap: 2,
    gridTemplateColumns: `repeat(1, minmax(0, 1fr))`,
    lg: {
      gridTemplateColumns: `repeat(2, minmax(0, 1fr))`,
    },
    sm: {
      gap: 3,
    },
  },
  cardFooter: {
    display: "flex",
    justifyContent: "flex-end",
  },
});

export const labelOnLeftStyles = createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
});
