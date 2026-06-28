import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth
  }));
  expect(overflow.documentWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewportWidth + 1);
  expect(overflow.bodyWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewportWidth + 1);
}

test("mobile shell stays responsive across primary views", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("body")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const navigation = page.locator("nav");
  if (await navigation.isVisible().catch(() => false)) {
    for (const label of ["Home", "Transactions", "Upload", "Analytics", "Settings"]) {
      await navigation.getByRole("button", { name: label, exact: true }).click();
      await page.waitForTimeout(250);
      await expectNoHorizontalOverflow(page);

      const offscreenControls = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("button, input, select, textarea"))
          .filter((element) => {
            const style = getComputedStyle(element);
            if (style.display === "none" || style.visibility === "hidden") return false;
            let parent = element.parentElement;
            while (parent) {
              const overflowX = getComputedStyle(parent).overflowX;
              if (overflowX === "auto" || overflowX === "scroll") return false;
              parent = parent.parentElement;
            }
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
          })
          .map((element) => element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName)
      );
      expect(offscreenControls, `${label} has controls outside the viewport`).toEqual([]);
    }
  }

  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-full-page.png`),
    fullPage: true
  });
});

test("fixed navigation does not cover the final content block", async ({ page }) => {
  await page.goto("/");
  const navigation = page.locator("nav");
  if (!(await navigation.isVisible().catch(() => false))) return;

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const navBox = await navigation.boundingBox();
  const mainBox = await page.locator("main").boundingBox();
  expect(navBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(mainBox!.height).toBeGreaterThan(navBox!.height + 24);
});
