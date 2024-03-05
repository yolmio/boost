import { test, expect } from "@playwright/test";
import { gotoHomePage, testSetup } from "../utils";

testSetup();

test("renders dashboard", async ({ page }) => {
  await gotoHomePage(page, "My CRM");
  await expect(page.getByText("Total Contacts")).toBeVisible();
  await expect(page.getByText("New Contacts")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard.png");
  await page.getByText("Chuck Leclerc").click();
  await expect(page.getByText("Chuck Leclerc")).toBeVisible();
});

test("add contact", async ({ page }) => {
  await gotoHomePage(page, "My CRM");
  await page.getByRole("link", { name: "Contacts" }).click();
  await page.getByLabel("Add").click();
  await page.getByLabel("First Name").fill("Justin");
  await page.getByLabel("Last Name").fill("Haug");
  await page.getByLabel("Email").fill("g@gmail.com");
  await page.getByText("Add", { exact: true }).click();
  await expect(page.getByText("Justin")).toBeVisible();
  await expect(page.getByText("Haug")).toBeVisible();
  await expect(page.getByText("g@gmail.com")).toBeVisible();
});

test("edit contact", async ({ page }) => {
  await gotoHomePage(page, "My CRM");
  await page.getByText("Bob Brown").click();
  await page.getByText("Edit").click();
  await page.getByLabel("First Name").fill("Bobby");
  await page.getByLabel("Country").fill("USA");
  await page.getByText("Save").click();
  await expect(page.getByText("Bobby Brown")).toBeVisible();
  await page.getByLabel("Home").click();
  await expect(page.getByText("Bobby Brown")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-after-edit.png");
});
