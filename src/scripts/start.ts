import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  fetchWithTimeout,
  getScriptModel,
  runScript,
  sleep,
  writeAppModelToDisk,
  yolmPath,
} from "./utils.js";
import * as dns from "dns";
import { Request } from "node-fetch";
import * as fs from "fs";
import { createProfiles } from "../profile.js";

dns.setDefaultResultOrder("ipv4first");

const hasProfilesFile = fs.existsSync(path.join(process.cwd(), "profiles.ts"));
let profiles = createProfiles({});
if (hasProfilesFile) {
  const module = await import(path.join(process.cwd(), "profiles.ts"));
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
      (script) => script.name === initScriptName
    );
    if (initScript) {
      console.log(`About to run script "${initScriptName}"`);
      writeAppModelToDisk(scriptModel);
      runScript(initScriptName);
      console.log(`Successfully ran script "${initScriptName}"`);
    }
  }
}

const runArgs: string[] = ["run", `--db=${dbPath}`];

if (profile.user) {
  runArgs.push(`--user=${profile.user}`);
}
if (profile.port) {
  runArgs.push(`--port=${profile.port}`);
}

let handle;
try {
  const cmdPath = yolmPath();
  handle = spawn(cmdPath, runArgs, {
    detached: false,
    stdio: [process.stdin, process.stdout, process.stderr],
    env: {
      ...process.env,
      RUST_MIN_STACK: "10000000",
      RUST_BACKTRACE: "1",
      YOLM_DEV_SERVER_DELAY: process.env.YOLM_DEV_SERVER_DELAY ?? "0",
    },
  });
  // console.log("yolm run pid ", run.pid);
} catch (e) {
  console.error("Unable to spawn yolm run");
  throw e;
}
await sleep(1000);

let found = false;
for (let i = 0; i < 10; i++) {
  try {
    const request = new Request("http://localhost:3000/health");
    const result = await fetchWithTimeout(request, 100);
    if (result.status === 200) {
      const json: { healthy: boolean } = (await result.json()) as any;
      if (json !== undefined && json.healthy !== undefined && json.healthy) {
        found = true;
        console.log("successfully connected to development server");
        break;
      }
      await sleep(1000);
    }
  } catch {}
}

if (!found) {
  console.error("Could not start development server. Timed out.");
  handle.kill();
  process.exit(1);
}

const sendModelPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "sendModel.js"
);

spawn("tsx", ["watch", "--clear-screen=false", sendModelPath], {
  stdio: "inherit",
});
