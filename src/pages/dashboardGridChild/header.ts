import { nodes } from "../../nodeHelpers";
import { Style } from "../../styleTypes";
import { createStyles } from "../../styleUtils";
import { SqlExpression } from "../../yom";

export interface Opts {
  logo?: {
    src?: SqlExpression;
    styles?: Style;
  };
  header: SqlExpression;
  subHeader: SqlExpression;
}

const styles = createStyles({
  root: {
    gridColumnSpan: "full",
    display: "flex",
    flexDirection: "column",
  },
  rootWithLogo: {
    gridColumnSpan: "full",
    display: "flex",
  },
  headerWrapper: {
    display: "flex",
    flexDirection: "column",
  },
  header: {
    fontWeight: "md",
    fontSize: "xl2",
    my: 0,
  },
  subHeader: {
    fontWeight: "md",
    fontSize: "md",
    color: "text-secondary",
    my: 0,
  },
});

export function content(opts: Opts) {
  if (opts.logo) {
    return nodes.element("div", {
      styles: styles.rootWithLogo,
      children: [
        nodes.element("img", {
          props: { src: opts.logo.src },
          styles: opts.logo.styles,
        }),
        nodes.element("div", {
          styles: styles.headerWrapper,
          children: [
            nodes.element("h1", {
              styles: styles.header,
              children: opts.header,
            }),
            nodes.element("h2", {
              styles: styles.subHeader,
              children: opts.subHeader,
            }),
          ],
        }),
      ],
    });
  } else {
    return nodes.element("div", {
      styles: styles.root,
      children: [
        nodes.element("h1", {
          styles: styles.header,
          children: opts.header,
        }),
        nodes.element("h2", {
          styles: styles.subHeader,
          children: opts.subHeader,
        }),
      ],
    });
  }
}
