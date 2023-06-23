import { materialIcon } from "../../components/materialIcon.js";
import { typography } from "../../components/typography.js";
import { element } from "../../nodeHelpers.js";
import { createStyles } from "../../styleUtils.js";

export const name = "header";

export interface Opts {
  header: string;
  subHeader: string;
}

const styles = createStyles({
  root: {
    gridColumnSpan: "full",
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
