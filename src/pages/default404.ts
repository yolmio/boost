import { button } from "../components/button.js";
import { materialIcon } from "../components/materialIcon.js";
import { typography } from "../components/typography.js";
import { element } from "../nodeHelpers.js";
import { createStyles } from "../styleUtils.js";

const styles = createStyles({
  root: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    pt: 6,
    flexDirection: "column",
    gap: 2,
  },
});

export function default404Page() {
  return element("div", {
    styles: styles.root,
    children: [
      typography({
        level: "h3",
        children: `'No page here!'`,
      }),
      button({
        variant: "outlined",
        href: "'/'",
        startDecorator: materialIcon("Home"),
        children: `'Go home'`,
      }),
    ],
  });
}
