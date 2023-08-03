import { memoize } from "../utils/memoize.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { ElementEventHandlers, ElementProps } from "../yom.js";
import { app } from "../singleton.js";
import { element } from "../nodeHelpers.js";
import type { ElementNode, Node } from "../nodeTypes.js";
import { Style } from "../styleTypes.js";
import { cssVar } from "../styleUtils.js";

type Orientation = "vertical" | "horizontal";
type Inset = "none" | "context";

export interface DividerOpts {
  orientation?: "vertical" | "horizontal";
  inset?: "none" | "context";

  role?: "seperator" | "presentation";
  props?: ElementProps;
  on?: ElementEventHandlers;
  styles?: Style;

  children?: Node;
}

const getDividerStyles = memoize(
  (
    orientation: Orientation,
    hasChildren: boolean,
    inset: Inset | undefined
  ) => {
    const styles: Style = {
      "--divider-thickness": "1px",
      "--divider-line-color": cssVar(`palette-divider`),
      margin: "initial", // reset margin for `hr` tag
      marginX: orientation === "vertical" ? "initial" : "var(--divider-inset)",
      marginY: orientation === "vertical" ? "var(--divider-inset)" : "initial",
      position: "relative",
      alignSelf: "stretch",
      flexShrink: 0,
    };
    switch (inset) {
      case "none":
        styles["--divider-inset"] = "0px";
        break;
      case "context":
        styles["--divider-inset"] = "var(--divider-inset, 0px)";
        break;
    }
    if (hasChildren) {
      Object.assign(styles, {
        "--divider-gap": app.theme.spacing(1),
        "--divider-child-position": "50%",
        display: "flex",
        flexDirection: orientation === "vertical" ? "column" : "row",
        alignItems: "center",
        whiteSpace: "nowrap",
        textAlign: "center",
        border: 0,
        fontFamily: cssVar(`font-family-body`),
        fontSize: cssVar(`font-size-sm`),
        "&::before, &::after": {
          position: "relative",
          inlineSize:
            orientation === "vertical" ? "var(--divider-thickness)" : "initial",
          blockSize:
            orientation === "vertical" ? "initial" : "var(--divider-thickness)",
          backgroundColor: "var(--divider-line-color)", // use logical size + background is better than border because they work with gradient.
          content: '""',
        },
        "&::before": {
          marginRight:
            orientation === "vertical"
              ? "initial"
              : "min(var(--divider-child-position) * 999, var(--divider-gap))",
          marginBottom:
            orientation === "vertical"
              ? "min(var(--divider-child-position) * 999, var(--divider-gap))"
              : "initial",
          flexBasis: "var(--divider-child-position)",
        },
        "&::after": {
          marginLeft:
            orientation === "vertical"
              ? "initial"
              : "min((100% - var(--divider-child-position)) * 999, var(--divider-gap))",
          marginTop:
            orientation === "vertical"
              ? "min((100% - var(--divider-child-position)) * 999, var(--divider-gap))"
              : "initial",
          flexBasis: "calc(100% - var(--divider-child-position))",
        },
      });
    } else {
      Object.assign(styles, {
        border: "none", // reset the border for `hr` tag
        listStyle: "none",
        backgroundColor: "var(--divider-line-color)", // use logical size + background is better than border because they work with gradient.
        inlineSize:
          orientation === "vertical" ? "var(--divider-thickness)" : "initial",
        blockSize:
          orientation === "vertical" ? "initial" : "var(--divider-thickness)",
      });
    }
    return styles;
  }
);

export function divider(opts: DividerOpts = {}): ElementNode {
  const role = opts.role ?? (opts.children ? undefined : "seperator");
  const orientation = opts.orientation ?? "horizontal";
  const styles = getDividerStyles(
    orientation,
    Boolean(opts.children),
    opts.inset
  );
  return element(opts.children ? "div" : "hr", {
    props: {
      role: role ? stringLiteral(role) : undefined,
      "aria-orientation":
        role === "seperator" && opts.orientation === "vertical"
          ? "'vertical'"
          : undefined,
      ...opts.props,
    },
    styles: opts.styles ? [styles, opts.styles] : styles,
    children: opts.children,
    on: opts.on,
  });
}
