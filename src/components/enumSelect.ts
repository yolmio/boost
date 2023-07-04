import { element } from "../nodeHelpers.js";
import { model } from "../singleton.js";
import { select, SelectOpts } from "./select.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { BoolEnumLikeConfig } from "../modelTypes.js";
import { memoize } from "../utils/memoize.js";

export type EnumSelectOpts = Omit<SelectOpts, "children"> & {
  enum: string;
  emptyOption?: string;
};

const getEnumOptions = memoize((enumName: string, emptyOption?: string) => {
  const enum_ = model.enums[enumName];
  const options = Object.values(enum_.values).map((v) =>
    element("option", {
      children: stringLiteral(v.displayName),
      props: { value: stringLiteral(v.name) },
    })
  );
  if (emptyOption) {
    options.unshift(
      element("option", {
        children: emptyOption,
        props: { value: `''` },
      })
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
        ? element("option", {
            props: { value: `''` },
            children: opts.enumLike.null
              ? stringLiteral(opts.enumLike.null)
              : `'Unspecified'`,
          })
        : null,
      element("option", {
        props: { value: `'true'` },
        children: stringLiteral(opts.enumLike.true),
      }),
      element("option", {
        props: { value: `'false'` },
        children: stringLiteral(opts.enumLike.false),
      }),
    ],
  });
}
