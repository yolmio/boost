import { nodes } from "../nodeHelpers";
import { system } from "../system";
import { select, SelectOpts } from "./select";
import { stringLiteral } from "../utils/sqlHelpers";
import { BoolEnumLikeConfig } from "../system";
import { memoize } from "../utils/memoize";

export type EnumSelectOpts = Omit<SelectOpts, "children"> & {
  enum: string;
  emptyOption?: string;
};

const getEnumOptions = memoize((enumName: string, emptyOption?: string) => {
  const enum_ = system.enums[enumName];
  const options = Object.values(enum_.values).map((v) =>
    nodes.element("option", {
      children: stringLiteral(v.displayName),
      props: { value: stringLiteral(v.name) },
    }),
  );
  if (emptyOption) {
    options.unshift(
      nodes.element("option", {
        children: emptyOption,
        props: { value: `''` },
      }),
    );
  }
  return options;
});

export function enumSelect(opts: EnumSelectOpts) {
  return select({
    ...opts,
    children: getEnumOptions(opts.enum, opts.emptyOption),
  });
}

export type EnumLikeSelectOpts = Omit<SelectOpts, "children"> & {
  enumLike: BoolEnumLikeConfig;
  notNull: boolean;
};

export function enumLikeSelect(opts: EnumLikeSelectOpts) {
  return select({
    ...opts,
    children: [
      !opts.notNull
        ? nodes.element("option", {
          props: { value: `''` },
          children: opts.enumLike.null
            ? stringLiteral(opts.enumLike.null)
            : `'Unspecified'`,
        })
        : null,
      nodes.element("option", {
        props: { value: `'true'` },
        children: stringLiteral(opts.enumLike.true),
      }),
      nodes.element("option", {
        props: { value: `'false'` },
        children: stringLiteral(opts.enumLike.false),
      }),
    ],
  });
}
