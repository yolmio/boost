/**
 * Returns a number whose value is limited to the given range.
 * @param  value The value to be clamped
 * @param  min The lower boundary of the output range
 * @param  max The upper boundary of the output range
 * @returns  A number in the range [min, max]
 */
function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(min, value), max);
}

/**
 * Converts a color from CSS hex format to CSS rgb format.
 * @param  color - Hex color, i.e. #nnn or #nnnnnn
 * @returns  A CSS rgb color string
 */
export function hexToRgb(color: string) {
  color = color.slice(1);

  const re = new RegExp(`.{1,${color.length >= 6 ? 2 : 1}}`, "g");
  let colors = color.match(re);

  if (colors && colors[0].length === 1) {
    colors = colors.map((n) => n + n) as any;
  }

  return colors
    ? `rgb${colors.length === 4 ? "a" : ""}(${colors
        .map((n, index) => {
          return index < 3
            ? parseInt(n, 16)
            : Math.round((parseInt(n, 16) / 255) * 1000) / 1000;
        })
        .join(", ")})`
    : "";
}

function intToHex(int: number) {
  const hex = int.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

export interface Color {
  type: string;
  values: number[];
  colorSpace?: string;
}

/**
 * Returns an object with the type and values of a color.
 *
 * Note: Does not support rgb % values.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 */
export function decomposeColor(color: string | Color): Color {
  if (typeof color !== "string") {
    return color;
  }

  if (color.charAt(0) === "#") {
    return decomposeColor(hexToRgb(color));
  }

  const marker = color.indexOf("(");
  const type = color.substring(0, marker);

  if (["rgb", "rgba", "hsl", "hsla", "color"].indexOf(type) === -1) {
    throw new Error(
      `Unsupported \`${color}\` color.\n` +
        "The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()."
    );
  }

  let valuesString = color.substring(marker + 1, color.length - 1);
  let values: string[] = [];
  let colorSpace;

  if (type === "color") {
    values = valuesString.split(" ");
    colorSpace = values.shift();
    if (values.length === 4 && values[3].charAt(0) === "/") {
      values[3] = values[3].slice(1);
    }
    if (
      ["srgb", "display-p3", "a98-rgb", "prophoto-rgb", "rec-2020"].includes(
        colorSpace ?? ""
      )
    ) {
      throw new Error(
        `Unsupported \`${colorSpace}\` color space.\n` +
          "The following color spaces are supported: srgb, display-p3, a98-rgb, prophoto-rgb, rec-2020."
      );
    }
  } else {
    values = valuesString.split(",");
  }
  return { type, values: values.map((value) => parseFloat(value)), colorSpace };
}

/**
 * Returns a channel created from the input color.
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @returns - The channel for the color, that can be used in rgba or hsla colors
 */
export const colorChannel = (color: string) => {
  const decomposedColor = decomposeColor(color);
  return decomposedColor.values
    .slice(0, 3)
    .map((val, idx) =>
      decomposedColor.type.indexOf("hsl") !== -1 && idx !== 0 ? `${val}%` : val
    )
    .join(" ");
};

/**
 * Converts a color object with type and values to a string.
 * @param color - Decomposed color
 */
export function recomposeColor(color: Color) {
  const { type, colorSpace } = color;
  let values: (string | number)[] = color.values;

  if (type.indexOf("rgb") !== -1) {
    // Only convert the first 3 values to int (i.e. not alpha)
    values = values.map((n, i) => (i < 3 ? parseInt(n.toString(), 10) : n));
  } else if (type.indexOf("hsl") !== -1) {
    values[1] = `${values[1]}%`;
    values[2] = `${values[2]}%`;
  }
  let valueStr;
  if (type.indexOf("color") !== -1) {
    valueStr = `${colorSpace} ${values.join(" ")}`;
  } else {
    valueStr = `${values.join(", ")}`;
  }
  return `${type}(${valueStr})`;
}

/**
 * Converts a color from CSS rgb format to CSS hex format.
 * @param color - RGB color, i.e. rgb(n, n, n)
 * @returns A CSS rgb color string, i.e. #nnnnnn
 */
export function rgbToHex(color: string) {
  // Idempotent
  if (color.indexOf("#") === 0) {
    return color;
  }

  const { values } = decomposeColor(color);
  return `#${values
    .map((n, i) => intToHex(i === 3 ? Math.round(255 * n) : n))
    .join("")}`;
}

/**
 * Converts a color from hsl format to rgb format.
 * @param color - HSL color values
 * @returns rgb color values
 */
export function hslToRgb(color: string) {
  const colorObj = decomposeColor(color);
  const { values } = colorObj;
  const h = values[0];
  const s = values[1] / 100;
  const l = values[2] / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12) =>
    l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

  let type = "rgb";
  const rgb = [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];

  if (colorObj.type === "hsla") {
    type += "a";
    rgb.push(values[3]);
  }

  return recomposeColor({ type, values: rgb });
}

/**
 * The relative brightness of any point in a color space,
 * normalized to 0 for darkest black and 1 for lightest white.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @returns The relative brightness of the color in the range 0 - 1
 */
export function getLuminance(color: string) {
  const colorObj = decomposeColor(color);

  let rgb =
    colorObj.type === "hsl" || colorObj.type === "hsla"
      ? decomposeColor(hslToRgb(color)).values
      : colorObj.values;
  rgb = rgb.map((val) => {
    if (colorObj.type !== "color") {
      val /= 255; // normalized
    }
    return val <= 0.03928 ? val / 12.92 : ((val + 0.055) / 1.055) ** 2.4;
  });

  // Truncate at 3 digits
  return Number(
    (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]).toFixed(3)
  );
}

/**
 * Calculates the contrast ratio between two colors.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 * @param foreground - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param background - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @returns A contrast ratio value in the range 0 - 21.
 */
export function getContrastRatio(foreground: string, background: string) {
  const lumA = getLuminance(foreground);
  const lumB = getLuminance(background);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

/**
 * Sets the absolute transparency of a color.
 * Any existing alpha values are overwritten.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param value - value to set the alpha channel to in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export function alpha(color: string, value: number) {
  const colorObj = decomposeColor(color);
  value = clamp(value);

  if (colorObj.type === "rgb" || colorObj.type === "hsl") {
    colorObj.type += "a";
  }
  if (colorObj.type === "color") {
    colorObj.values[3] = `/${value}` as any;
  } else {
    colorObj.values[3] = value;
  }

  return recomposeColor(colorObj);
}

/**
 * Darkens a color.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export function darken(color: string, coefficient: number) {
  const colorObj = decomposeColor(color);
  coefficient = clamp(coefficient);

  if (colorObj.type.indexOf("hsl") !== -1) {
    colorObj.values[2] *= 1 - coefficient;
  } else if (
    colorObj.type.indexOf("rgb") !== -1 ||
    colorObj.type.indexOf("color") !== -1
  ) {
    for (let i = 0; i < 3; i += 1) {
      colorObj.values[i] *= 1 - coefficient;
    }
  }
  return recomposeColor(colorObj);
}

/**
 * Lightens a color.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export function lighten(color: string, coefficient: number) {
  const colorObj = decomposeColor(color);
  coefficient = clamp(coefficient);

  if (colorObj.type.indexOf("hsl") !== -1) {
    colorObj.values[2] += (100 - colorObj.values[2]) * coefficient;
  } else if (colorObj.type.indexOf("rgb") !== -1) {
    for (let i = 0; i < 3; i += 1) {
      colorObj.values[i] += (255 - colorObj.values[i]) * coefficient;
    }
  } else if (colorObj.type.indexOf("color") !== -1) {
    for (let i = 0; i < 3; i += 1) {
      colorObj.values[i] += (1 - colorObj.values[i]) * coefficient;
    }
  }

  return recomposeColor(colorObj);
}

/**
 * Darken or lighten a color, depending on its luminance.
 * Light colors are darkened, dark colors are lightened.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient=0.15 - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export function emphasize(color: string, coefficient = 0.15) {
  return getLuminance(color) > 0.5
    ? darken(color, coefficient)
    : lighten(color, coefficient);
}
