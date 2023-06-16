import type { Node } from "../nodeTypes.js";
import { createStyles, cssVar } from "../styleUtils.js";
import { createSlotsFn, SlottedComponentWithSlotNames } from "./utils.js";

export interface FormLabelOpts
  extends SlottedComponentWithSlotNames<"asterisk"> {
  required?: boolean;

  children: Node;
}

const styles = createStyles({
  root: {
    WebkitTapHighlightColor: "transparent",
    alignSelf: "var(--form-label-align-self)", // to not fill the block space. It seems like a bug when clicking on empty space (within the label area), even though it is not.
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    userSelect: "none",
    fontFamily: cssVar(`font-family-body`),
    fontSize: `var(--form-label-font-size, ${cssVar(`font-size-sm`)})`,
    fontWeight: cssVar(`font-weight-md`),
    lineHeight: cssVar(`line-height-md`),
    color: `var(--form-label-color, ${cssVar(`palette-text-primary`)})`,
    marginRight: "var(--form-label-margin-right, 0px)",
    marginBottom: "var(--form-label-margin-bottom, 0px)",
  },
  asterisk: {
    color: "var(--form-label-asterisk-color)",
  },
});

export function formLabel(opts: FormLabelOpts) {
  const slot = createSlotsFn(opts);
  return slot("root", {
    tag: "label",
    styles: styles.root,
    children: [
      opts.children,
      opts.required
        ? slot("asterisk", {
            tag: "span",
            styles: styles.asterisk,
            props: { "aria-hidden": "true" },
            children: "'*'",
          })
        : null,
    ],
  });
}
