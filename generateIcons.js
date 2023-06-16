import fse from "fs-extra";
import path from "path";
import rimraf from "rimraf";
import globAsync from "fast-glob";
import * as svgo from "svgo";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const outputDir = path.join(currentDirectory, "material-icons");
const svgDir = path.join(currentDirectory, "material-icons-input");

const singleDigitNumbers = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
];
const twoDigitNumbers1 = [
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

function renameFilter(svgPathObj) {
  let fileName = svgPathObj.base;

  fileName = fileName
    .replace(/_([0-9]+)px\.svg/, ".json")
    .replace(/(^.)|(_)(.)/g, (match, p1, p2, p3) => (p1 || p3).toUpperCase());

  if (fileName.startsWith("3dRotation")) {
    return `ThreeD${fileName.slice(2)}`;
  }

  if (fileName.startsWith("3p")) {
    return `ThreeP${fileName.slice(2)}`;
  }

  if (fileName.startsWith("30fps")) {
    return `ThirtyFps${fileName.slice(5)}`;
  }
  if (fileName.startsWith("60fps")) {
    return `SixtyFps${fileName.slice(5)}`;
  }
  if (fileName.startsWith("360")) {
    return `ThreeSixty${fileName.slice(3)}`;
  }

  if (/\dk/.test(fileName)) {
    return `${singleDigitNumbers[fileName[0]]}K${fileName.slice(2)}`;
  }

  if (/^\dmp/.test(fileName)) {
    return `${singleDigitNumbers[fileName[0]]}M${fileName.slice(2)}`;
  }
  if (/^1\dmp/.test(fileName)) {
    return `${twoDigitNumbers1[fileName[1]]}M${fileName.slice(3)}`;
  }
  if (/^2\dmp/.test(fileName)) {
    return `Twenty${singleDigitNumbers[fileName[1]]}M${fileName.slice(3)}`;
  }

  if (fileName.startsWith("1x")) {
    return `TimesOne${fileName.slice(2)}`;
  }

  if (fileName.startsWith("3g")) {
    return `ThreeG${fileName.slice(2)}`;
  }
  if (fileName.startsWith("4g")) {
    return `FourG${fileName.slice(2)}`;
  }
  if (fileName.startsWith("5g")) {
    return `FiveG${fileName.slice(2)}`;
  }

  // All other names starting with a number between 10 and 19
  if (/^1\d/.test(fileName)) {
    return `${twoDigitNumbers1[fileName[1]]}${fileName.slice(2)}`;
  }

  return fileName;
}

/**
 * Converts directory separators to slashes, so the path can be used in fast-glob.
 * @param {string} pathToNormalize
 * @returns
 */
function normalizePath(pathToNormalize) {
  return pathToNormalize.replace(/\\/g, "/");
}

async function generateIconTypesFile() {
  const files = await globAsync(normalizePath(path.join(outputDir, "*.json")));
  const types = files
    .map((file) => {
      const typename = path.basename(file).replace(".json", "");
      return `"${typename}"`;
    })
    .sort()
    .join(" | ");
  const file = `export type IconName = ${types}`;

  await fse.writeFile(
    path.join(currentDirectory, "src", "components", "materialIconNames.ts"),
    file
  );
}

// Noise introduced by Google by mistake
const noises = [
  ['="M0 0h24v24H0V0zm0 0h24v24H0V0z', '="'],
  ['="M0 0h24v24H0zm0 0h24v24H0zm0 0h24v24H0z', '="'],
];

function removeNoise(input, prevInput = null) {
  if (input === prevInput) {
    return input;
  }

  let output = input;

  noises.forEach(([search, replace]) => {
    if (output.indexOf(search) !== -1) {
      output = output.replace(search, replace);
    }
  });

  return removeNoise(output, input);
}

function cleanPaths({ svgPath, data }) {
  // Remove hardcoded color fill before optimizing so that empty groups are removed
  const input = data
    .replace(/ fill="#010101"/g, "")
    .replace(/<rect fill="none" width="24" height="24"\/>/g, "")
    .replace(/<rect id="SVGID_1_" width="24" height="24"\/>/g, "");

  const result = svgo.optimize(input, {
    floatPrecision: 4,
    multipass: true,
    plugins: [
      { name: "cleanupAttrs" },
      { name: "removeDoctype" },
      { name: "removeXMLProcInst" },
      { name: "removeComments" },
      { name: "removeMetadata" },
      { name: "removeTitle" },
      { name: "removeDesc" },
      { name: "removeUselessDefs" },
      { name: "removeEditorsNSData" },
      { name: "removeEmptyAttrs" },
      { name: "removeHiddenElems" },
      { name: "removeEmptyText" },
      { name: "removeViewBox" },
      { name: "cleanupEnableBackground" },
      { name: "minifyStyles" },
      { name: "convertStyleToAttrs" },
      { name: "convertColors" },
      { name: "convertPathData" },
      { name: "convertTransform" },
      { name: "removeUnknownsAndDefaults" },
      { name: "removeNonInheritableGroupAttrs" },
      {
        name: "removeUselessStrokeAndFill",
        params: {
          // https://github.com/svg/svgo/issues/727#issuecomment-303115276
          removeNone: true,
        },
      },
      { name: "removeUnusedNS" },
      { name: "cleanupIDs" },
      { name: "cleanupNumericValues" },
      { name: "cleanupListOfValues" },
      { name: "moveElemsAttrsToGroup" },
      { name: "moveGroupAttrsToElems" },
      { name: "collapseGroups" },
      { name: "removeRasterImages" },
      { name: "mergePaths" },
      { name: "convertShapeToPath" },
      { name: "sortAttrs" },
      { name: "removeDimensions" },
      { name: "removeElementsByAttr" },
      { name: "removeStyleElement" },
      { name: "removeScriptElement" },
      { name: "removeEmptyContainers" },
    ],
  });

  // True if the svg has multiple children
  const jsxResult = svgo.optimize(result.data, {
    plugins: [
      {
        name: "svgAsReactFragment",
        type: "visitor",
        fn: () => {
          return {
            root: {
              enter(root) {
                const [svg, ...rootChildren] = root.children;
                if (rootChildren.length > 0) {
                  throw new Error("Expected a single child of the root");
                }
                if (svg.type !== "element" || svg.name !== "svg") {
                  throw new Error("Expected an svg element as the root child");
                }
                root.spliceContent(0, svg.children.length, svg.children);
              },
            },
          };
        },
      },
    ],
  });

  // Extract the paths from the svg string
  // Clean xml paths
  // TODO: Implement as svgo plugins instead
  let paths = jsxResult.data
    .replace(/"\/>/g, '" />')
    .replace(/fill-opacity=/g, "fillOpacity=")
    .replace(/xlink:href=/g, "xlinkHref=")
    .replace(/clip-rule=/g, "clipRule=")
    .replace(/fill-rule=/g, "fillRule=")
    .replace(/ clip-path=".+?"/g, "") // Fix visibility issue and save some bytes.
    .replace(/<clipPath.+?<\/clipPath>/g, ""); // Remove unused definitions

  const sizeMatch = svgPath.match(/^.*_([0-9]+)px.svg$/);
  const size = sizeMatch ? Number(sizeMatch[1]) : null;

  if (size !== 24) {
    const scale = Math.round((24 / size) * 100) / 100; // Keep a maximum of 2 decimals
    paths = paths.replace('clipPath="url(#b)" ', "");
    paths = paths.replace(
      /<path /g,
      `<path transform="scale(${scale}, ${scale})" `
    );
  }

  paths = removeNoise(paths);

  return paths;
}

function escapeStringLiteral(s) {
  return s.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
    switch (char) {
      case "'":
        return "''";
      default:
        return char;
    }
  });
}

function stringLiteral(s) {
  return `'${escapeStringLiteral(s)}'`;
}

async function transformFile(svgPath) {
  const normalizedSvgPath = path.normalize(svgPath);
  const svgPathObj = path.parse(normalizedSvgPath);
  const innerPath = path
    .dirname(normalizedSvgPath)
    .replace(svgDir, "")
    .replace(path.relative(process.cwd(), svgDir), ""); // for relative dirs
  const destPath = renameFilter(svgPathObj, innerPath);

  const outputFileDir = path.dirname(path.join(outputDir, destPath));
  await fse.ensureDir(outputFileDir);

  const data = await fse.readFile(svgPath, { encoding: "utf8" });
  const paths = cleanPaths({ svgPath, data });

  const jsdom = new JSDOM(paths);
  function transformNode(node) {
    const props = {};
    for (const attr of node.attributes) {
      props[attr.name] = stringLiteral(attr.value);
    }
    const children = [];
    for (const child of node.childNodes) {
      children.push(transformNode(child));
    }
    return {
      t: "Element",
      tag: node.nodeName.toLowerCase(),
      props,
      children:
        children.length === 0
          ? undefined
          : children.length === 1
          ? children[0]
          : children,
    };
  }
  const transformedNodes = [];
  for (const node of jsdom.window.document.body.childNodes) {
    transformedNodes.push(transformNode(node));
  }
  const json = JSON.stringify(
    transformedNodes.length === 1 ? transformedNodes[0] : transformedNodes
  );

  const absDestPath = path.join(outputDir, destPath);
  await fse.writeFile(absDestPath, json);
}

rimraf.sync(`${outputDir}/*.json`);
await fse.ensureDir(outputDir);

const svgPaths = await globAsync(normalizePath(path.join(svgDir, "**/*.svg")));
await Promise.all(svgPaths.map((svgPath) => transformFile(svgPath)));

await generateIconTypesFile();
