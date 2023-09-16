import { spawnSync } from "child_process";
import which from "which";

export function hasBun() {
  return Boolean(which.sync("bun", { nothrow: true }));
}

export function execWithTranspiler(file) {
  const restArgs = process.argv.slice(2);
  if (hasBun()) {
    console.log("Using bun");
    spawnSync("bun", [file, ...restArgs], { stdio: "inherit", shell: true });
  } else {
    console.log("Using tsx");
    spawnSync("tsx", [file, ...restArgs], { stdio: "inherit", shell: true });
  }
}
