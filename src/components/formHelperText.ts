import type { Node } from "../nodeTypes.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { mergeEls, SingleElementComponentOpts } from "./utils.js";

export interface FormHelperTextOpts extends SingleElementComponentOpts {
  children: Node;
}

const styles = createStyles({
  root: {
    display: "flex",
    alignItems: "center",
    fontFamily: cssVar(`font-family-body`),
    fontSize: `var(--form-helper-text-font-size, ${cssVar(`font-size-sm`)})`,
    lineHeight: cssVar(`line-height-sm`),
    color: `var(--form-helper-text-color, ${cssVar(`palette-text-secondary`)})`,
    marginTop: "var(--form-helper-text-margin-top, 0px)",
    [`label + &`]: {
      "--form-helper-text-margin-top": "0px", // remove the margin if the helper text is next to the form label.
    },
  },
});

export function formHelperText(opts: FormHelperTextOpts) {
  return mergeEls(
    {
      tag: "div",
      styles: styles.root,
      children: opts.children,
    },
    opts
  );
}
