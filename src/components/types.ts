import { Style } from "../styleTypes.js";
import { ColorPaletteProp } from "../theme.js";
import { Variant } from "../theme.js";

export type Color = ColorPaletteProp | "harmonize";
export type Size = "sm" | "md" | "lg";
export type { Variant };

export interface ComponentOpts {
  color?: Color;
  size?: Size;
  variant?: Variant;
}
