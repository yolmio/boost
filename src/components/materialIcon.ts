import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { IconName } from "./materialIconNames";
import { Node } from "../nodeTypes";
import { memoize } from "../utils/memoize";
import { svgIcon, SvgIconColor, SvgIconFontSize } from "./svgIcon";

export interface MaterialIconOpts {
  color?: SvgIconColor;
  fontSize?: SvgIconFontSize;
  title?: string;
  name: IconName;
}

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const iconsDir = path.resolve(currentDirectory, "..", "material-icons");
const loadedIcons = new Map<IconName, Node>();

export const materialIcon = memoize((opts: MaterialIconOpts | IconName) => {
  const normalizedOpts = typeof opts === "string" ? { name: opts } : opts;
  let children = loadedIcons.get(normalizedOpts.name);
  if (!children) {
    const json: Node = JSON.parse(
      readFileSync(path.join(iconsDir, normalizedOpts.name + ".json"), "utf8")
    );
    loadedIcons.set(normalizedOpts.name, json);
    children = json;
  }
  return svgIcon({
    children: children!,
    color: normalizedOpts.color,
    title: normalizedOpts.title,
    fontSize: normalizedOpts.fontSize,
  });
});
