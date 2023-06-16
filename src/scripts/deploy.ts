import { deploy } from "./utils.js";

const args = process.argv;

if (args.length == 1) {
  await deploy(false);
} else {
  const arg = args[1];
  if (arg.toLowerCase() === "true") {
    await deploy(true);
  } else {
    await deploy(false);
  }
}
