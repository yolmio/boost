import { test, expect } from "@playwright/test";
import { testSetup } from "../utils";

testSetup();

test("renders home page", async ({ page }) => {
  await page.goto(".");
  await expect(page.getByText("hello world!")).toBeVisible();
});

test("blah", async ({ page }) => {
  await page.goto("./contacts");
  await expect(page.getByText("Filter")).toBeVisible();
});
