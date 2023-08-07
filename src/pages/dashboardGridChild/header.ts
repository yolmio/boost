import { element } from "../../nodeHelpers";
import { Style } from "../../styleTypes";
import { createStyles } from "../../styleUtils";
import { SqlExpression } from "../../yom";

export const name = "header";

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
    return element("div", {
      styles: styles.rootWithLogo,
      children: [
        element("img", {
          props: { src: opts.logo.src },
          styles: opts.logo.styles,
        }),
        element("div", {
          styles: styles.headerWrapper,
          children: [
            element("h1", {
              styles: styles.header,
              children: opts.header,
            }),
            element("h2", {
              styles: styles.subHeader,
              children: opts.subHeader,
            }),
          ],
        }),
      ],
    });
  } else {
    return element("div", {
      styles: styles.root,
      children: [
        element("h1", {
          styles: styles.header,
          children: opts.header,
        }),
        element("h2", {
          styles: styles.subHeader,
          children: opts.subHeader,
        }),
      ],
    });
  }
}
