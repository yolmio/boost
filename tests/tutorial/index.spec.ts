import { test, expect } from "@playwright/test";
import { testSetup } from "../utils";

testSetup();

test("renders home page", async ({ page }) => {
  await page.goto(".");
  await expect(page.getByText("hello world!")).toBeVisible();
});

test("add contact", async ({ page }) => {
  await page.goto("./contacts");
  await page.getByLabel("Add").click();
  await page.getByLabel("First Name").fill("Justin");
  await page.getByLabel("Last Name").fill("Haug");
  await page.getByLabel("Email").fill("g@gmail.com");
  await page.getByText("Add", { exact: true }).click();
  await expect(page.getByText("Justin")).toBeVisible();
  await expect(page.getByText("Haug")).toBeVisible();
  await expect(page.getByText("g@gmail.com")).toBeVisible();
});
