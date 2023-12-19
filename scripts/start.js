import * as path from "path";
import { fileURLToPath } from "url";
import {
  fetchWithTimeout,
  getScriptModel,
  runScript,
  sleep,
  writeHubModelToDisk,
  yolmPath,
  createProfiles,
} from "./utils.js";
import * as fs from "fs";
import { TextDecoderStream } from "stream/web";

const hasProfilesFile = fs.existsSync(path.join(process.cwd(), "profiles.ts"));
let profiles = createProfiles({});
if (hasProfilesFile) {
  const module = await import(
    "file:///" + path.join(process.cwd(), "profiles.ts")
  );
  profiles = module.profiles;
}

let profileName = "default";
if (process.argv.length > 2) {
  profileName = process.argv[process.argv.length - 1];
}

const profile = profiles[profileName];

if (!profile) {
  throw new Error(`No profile named ${profileName}`);
}

const dbPath = path.normalize(path.join(process.cwd(), profile.db));

if (!fs.existsSync(dbPath)) {
  const dataPath = path.normalize(path.join(process.cwd(), "data"));
  if (dbPath.startsWith(dataPath)) {
    const parsed = path.parse(dbPath);
    const scriptModel = await getScriptModel();
    const initScriptName = `init-${parsed.name}-db`;
    const initScript = scriptModel.scripts?.find(
      (script) => script.name === initScriptName,
    );
    if (initScript) {
      console.log(`About to run script "${initScriptName}"`);
      writeHubModelToDisk(scriptModel);
      runScript(initScriptName);
      console.log(`Successfully ran script "${initScriptName}"`);
    }
  }
}

const runArgs = [yolmPath(), "run", `--db=${dbPath}`];

if (profile.user) {
  runArgs.push(`--user=${profile.user}`);
}
if (profile.port) {
  runArgs.push(`--port=${profile.port}`);
}

const port = profile.port ?? 3000;

let handle;
try {
  handle = Bun.spawn(runArgs, {
    env: {
      ...process.env,
      RUST_BACKTRACE: "1",
      YOLM_DEV_SERVER_DELAY: process.env.YOLM_DEV_SERVER_DELAY ?? "0",
    },
  });
} catch (e) {
  console.error("Unable to spawn yolm run");
  throw e;
}

let found = false;
for (let i = 0; i < 50; i++) {
  try {
    const request = new Request(`http://127.0.0.1:${port}/health`);
    const result = await fetchWithTimeout(request, 100);
    if (result.status === 200) {
      const json = await result.json();
      if (json !== undefined && json.healthy !== undefined && json.healthy) {
        found = true;
        console.log("successfully connected to development server");
        break;
      }
    }
  } catch {}
  await sleep(50);
}

if (!found) {
  console.error("Could not start development server. Timed out.");
  handle.kill();
  process.exit(1);
}

const sendModelPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "sendModel.js",
);

Bun.spawn(["bun", "--watch", sendModelPath], {
  env: { ...process.env, YOLM_DEV_SERVER_PORT: port.toString() },
});
