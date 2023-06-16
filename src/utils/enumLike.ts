import { BoolEnumLikeConfig } from "../modelTypes.js";
import { stringLiteral } from "./sqlHelpers.js";

export function enumLikeDisplayName(
  value: string,
  enumLike: BoolEnumLikeConfig
) {
  const trueLiteral = stringLiteral(enumLike.true);
  const falseLiteral = stringLiteral(enumLike.false);
  return `case when ${value} then ${trueLiteral} when not ${value} then ${falseLiteral} else ${stringLiteral(
    enumLike.null ?? "Unspecified"
  )} end`;
}
