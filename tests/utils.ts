import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import test, { defineConfig, expect, devices, Page } from "@playwright/test";

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const email = "test@yolm.io";

async function getAccessCode() {
  if (!process.env.TMP_ACCESS_CODE_FILE) {
    throw new Error("TMP_ACCESS_CODE_FILE not set");
  }
  await sleep(100);
  const file: string = fs.readFileSync(
    process.env.TMP_ACCESS_CODE_FILE,
    "utf-8",
  );
  const lines = file
    .split("\n")
    .filter((l) => l.trim().length > 0 && l.includes(","))
    .reverse();
  for (const line of lines) {
    const fields = line.split(",");
    if (fields[0].toLowerCase().trim() === email) {
      return fields[1];
    }
  }
}

async function loginToE2E(page: Page) {
  await page.context().clearCookies();
  await page.context().clearPermissions();
  await page.goto("https://localyolmdev.com");
  await page.locator("#login-email").click();
  await page.locator("#login-email").fill(email);
  await page.getByRole("button").click();
  const accessCode = await getAccessCode();
  if (!accessCode) {
    throw new Error(`could not find access code for ${email}`);
  }
  await page.locator("#code-input-0").click();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.type(accessCode[i]);
  }
  await expect(page.getByText("Select an app")).toBeVisible();
}

export async function testSetup() {
  if (process.env.YOLM_E2E_TEST) {
    test.beforeEach(async ({ page }) => {
      await loginToE2E(page);
    });
  }
}

export function exampleE2EConfig(app: string) {
  return defineConfig({
    testDir: "./",
    timeout: 30 * 1000,
    expect: {
      timeout: 5000,
    },
    fullyParallel: false,
    use: {
      actionTimeout: 0,
      trace: "on-first-retry",
    },

    projects: [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] },
      },
    ],
  });
}

export function exampleDevConfig(app: string) {
  return defineConfig({
    testDir: "./",
    timeout: 30 * 1000,
    expect: {
      timeout: 5000,
    },
    fullyParallel: false,
    use: {
      actionTimeout: 0,
      trace: "on-first-retry",
      baseURL: "http://localhost:3001/",
    },

    projects: [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] },
      },
    ],
    webServer: {
      command: `cd ../../examples/${app} && YOLM_EXECUTABLE_PATH=~/dev/platform/target/debug/yolm bun start`,
      url: "http://127.0.0.1:3001",
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
  });
}
