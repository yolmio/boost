import { addPage } from "../appHelpers.js";
import { element } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { baseGridStyles, createStyles } from "../styleUtils.js";
import { containerStyles } from "../styleUtils.js";
import { ChildOpts, childFnMap } from "./dashboardGridChild/index.js";

const styles = createStyles({
  header: {
    ml: 1.5,
    my: 1,
  },
  loadingWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 156,
  },
  root: () => ({
    ...containerStyles(),
    ...baseGridStyles,
    py: 2,
    gap: 2,
    md: { gap: 4 },
  }),
});

interface CustomChild {
  type: "custom";
  content: () => Node;
}

type DashboardGridChild = ChildOpts | CustomChild;

export interface DashboardGridPageOpts {
  path?: string;
  children: DashboardGridChild[];
}

export function dashboardGridPage(opts: DashboardGridPageOpts) {
  const content = element("div", {
    styles: styles.root(),
    children: opts.children.map((c) => {
      if (c.type === "custom") {
        return c.content();
      } else {
        return childFnMap[c.type](c as any);
      }
    }),
  });
  addPage({
    path: opts.path ?? "/",
    content,
  });
}
