import { homedir } from "os";
import * as path from "path";

export function yolmPath() {
  if (process.env.YOLM_EXECUTABLE_PATH) {
    return process.env.YOLM_EXECUTABLE_PATH;
  }
  return path.join(homedir(), ".yolm", "bin", "yolm");
}

export function fetchWithTimeout(request: Request, timeOutMs: number) {
  const controller = new AbortController();
  const config = { signal: controller.signal };
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeOutMs);
  return fetch(request, config)
    .then((response) => {
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(response.status + ": " + response.statusText);
      }
      return response;
    })
    .catch((error) => {
      if (error.name === "AbortError") {
        throw new Error("Response timed out");
      }
      throw new Error(error.message);
    });
}

export async function getModel() {
  const start = performance.now();
  await runTsOrJsFile("system");
  const { system } = await import("../dist/index");
  const yom = system.generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms",
  );
  return yom;
}

async function runTsOrJsFile(fileBase: string) {
  const tsPath = path.join(process.cwd(), fileBase + ".ts");
  if (await Bun.file(tsPath).exists()) {
    await import("file:///" + tsPath);
    return;
  }
  const jsPath = path.join(process.cwd(), fileBase + ".js");
  if (await Bun.file(jsPath).exists()) {
    await import("file:///" + jsPath);
    return;
  }
  throw new Error("No file find at " + tsPath + " or " + jsPath);
}

export async function getScriptModel() {
  const start = performance.now();
  await runTsOrJsFile("scripts");
  const { system } = await import("../dist/index");
  const yom = system.generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms",
  );
  return yom;
}

export async function getTestModel() {
  const start = performance.now();
  await runTsOrJsFile("test");
  const { system } = await import("../dist/index");
  const yom = system.generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms",
  );
  return yom;
}

export async function writeModelToDisk(model: any) {
  await Bun.write(
    path.join(process.cwd(), "system.json"),
    JSON.stringify(model, null, 2),
  );
}

export async function runScript(name: string) {
  const child = Bun.spawn([yolmPath(), "script", name], {
    stdout: "inherit",
    env: process.env,
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

export async function getSystemYolmConfig() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(await Bun.file(packageJsonPath).text());
  if (packageJson.yolm === undefined) {
    return {
      deployed: false,
      profile: "",
    };
  }
  const yolm = packageJson.yolm;
  const deployed = yolm.deployed !== undefined;
  const profile = yolm.profile ?? "";
  return {
    deployed,
    profile,
  };
}

export function createProfiles(profiles: Record<string, any>) {
  const computedProfile = {
    default: {
      db: "data/dev",
      ...profiles.default,
    },
  };
  for (const [name, profile] of Object.entries(profiles)) {
    if (name === "default") {
      continue;
    }
    computedProfile[name] = {
      db: "data/dev",
      ...profile,
    };
  }
  return computedProfile;
}
