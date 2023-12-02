import { test, expect } from "@playwright/test";
import { testSetup } from "../utils";

testSetup();

test("renders all pages", async ({ page }) => {
  await page.goto(".");
  await expect(page.getByText("hello world!")).toBeVisible();
  await page.goto("./contacts");
  await expect(page.getByText("No contacts yet")).toBeVisible();
  await page.goto("./reports");
  await expect(page.getByText("No reports yet")).toBeVisible();
});
