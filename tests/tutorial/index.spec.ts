import { test, expect } from "@playwright/test";
import { gotoHomePage, testSetup } from "../utils";

testSetup();

test("renders home page", async ({ page }) => {
  await gotoHomePage(page, "Tutorial");
  await expect(page.getByText("hello world!")).toBeVisible();
});

test("add contact", async ({ page }) => {
  await gotoHomePage(page, "Tutorial");
  await page.getByText("Contacts").click();
  await page.getByLabel("Add").click();
  await page.getByLabel("First Name").fill("Justin");
  await page.getByLabel("Last Name").fill("Haug");
  await page.getByLabel("Email").fill("g@gmail.com");
  await page.getByText("Add", { exact: true }).click();
  await expect(page.getByText("Justin")).toBeVisible();
  await expect(page.getByText("Haug")).toBeVisible();
  await expect(page.getByText("g@gmail.com")).toBeVisible();
});
