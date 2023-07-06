import { spawnSync } from "child_process";
import which from "which";

export function hasBun() {
  return Boolean(which.sync("bun", { nothrow: true }));
}

export function execWithTranspiler(file: string) {
  const restArgs = process.argv.slice(2);
  if (hasBun()) {
    spawnSync("bun", [file, ...restArgs], { stdio: "inherit", shell: true });
  } else {
    spawnSync("tsx", [file, ...restArgs], { stdio: "inherit", shell: true });
  }
}
