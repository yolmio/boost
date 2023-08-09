import { button } from "../components/button";
import { materialIcon } from "../components/materialIcon";
import { typography } from "../components/typography";
import { nodes } from "../nodeHelpers";
import { createStyles } from "../styleUtils";

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
  return nodes.element("div", {
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
