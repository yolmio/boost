import { addPage } from "../appHelpers";
import { element } from "../nodeHelpers";
import { Node } from "../nodeTypes";
import { baseGridStyles, createStyles } from "../styleUtils";
import { containerStyles } from "../styleUtils";
import { ChildOpts, childFnMap } from "./dashboardGridChild/index";

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
