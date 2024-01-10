import { test, expect } from "@playwright/test";
import { gotoHomePage, testSetup } from "../utils";

testSetup();

test("renders all pages", async ({ page }) => {
  await gotoHomePage(page, "Hello World");
  await expect(page.getByText("hello world!")).toBeVisible();
  await page.getByText("Contacts").click();
  await expect(page.getByText("No contacts yet")).toBeVisible();
  await page.getByText("Reports").click();
  await expect(page.getByText("No reports yet")).toBeVisible();
});
