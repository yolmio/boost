import { Style } from "../styleTypes";
import { ColorPaletteProp } from "../theme";
import { Variant } from "../theme";

export type Color = ColorPaletteProp | "harmonize";
export type Size = "sm" | "md" | "lg";
export type { Variant };

export interface ComponentOpts {
  color?: Color;
  size?: Size;
  variant?: Variant;
}
