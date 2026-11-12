import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { root } from "./content.mjs";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080/";
const artifacts = path.join(root, ".artifacts");
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const routes = [
  "",
  "docs/",
  "docs/current/",
  "docs/current/getting-started/first-session/",
  "docs/devel/getting-started/first-session/",
  "docs/0.2.14/guides/first-session/",
  "docs/0.2.14/product/v1-announcement/",
  "journal/",
  "journal/2026-09-16-does-the-subscription-include-navier-stokes/",
  "why/",
  "contribute/",
  "releases/",
  "releases/v0.2.15/",
];
const results = [];
try {
  for (const width of [1440, 360]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of routes) {
      const response = await page.goto(new URL(route, base).href, {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), 200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(
        overflow,
        false,
        `Horizontal page overflow: ${width} ${route}`,
      );
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const violations = audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => n.target),
      }));
      results.push({ width, route, violations });
      assert.equal(
        violations.length,
        0,
        JSON.stringify(results.at(-1), null, 2),
      );
      if (["", "docs/", "docs/current/getting-started/first-session/", "docs/0.2.14/guides/first-session/", "journal/", "why/"].includes(route))
        await page.screenshot({
          path: path.join(
            artifacts,
            `${width}-${route.replaceAll("/", "-") || "home"}.png`,
          ),
          fullPage: true,
        });
    }
    await page.goto(base);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").textContent(), "Skip to content");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(":focus").getAttribute("id"), "main");
    await page
      .getByRole("link", { name: /^Open your first workspace/ })
      .click();
    assert.match(page.url(), /docs\/current\/getting-started\/first-session\/$/);
    if (await page.locator(".mobile-toc summary").isVisible())
      await page.locator(".mobile-toc summary").click();
    await page
      .locator(width === 1440 ? ".toc-desktop" : ".mobile-toc")
      .getByRole("link", { name: "1. Make a first workspace", exact: true })
      .click();
    assert.equal(new URL(page.url()).hash, "#1-make-a-first-workspace");
    if (width === 1440) {
      const shellCols = await page.evaluate(
        () => getComputedStyle(document.querySelector(".docs-shell")).gridTemplateColumns.trim().split(/\s+/).length,
      );
      assert.equal(shellCols, 3, "Desktop >= 1200px renders 3-column .docs-shell");
      assert.equal(await page.locator(".docs-sidebar-left").isVisible(), true);
      assert.equal(await page.locator(".docs-toc-right").isVisible(), true);
      assert.equal(await page.locator(".docs-nav-toggle").isVisible(), false);
      await page.waitForTimeout(100);
      assert.ok(
        await page.locator('.docs-toc-right a[aria-current="location"]').count() >= 1,
        "Right TOC scroll-spy highlights an active section",
      );
    } else {
      assert.equal(await page.locator(".docs-toc-right").isVisible(), false, "Mobile hides right TOC");
      const toggle = page.locator(".docs-nav-toggle");
      assert.equal(await toggle.isVisible(), true, "Mobile shows primary nav drawer toggle");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator("#docs-primary-nav").isVisible(), false);
      await toggle.click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      assert.equal(await page.locator("#docs-primary-nav").isVisible(), true);
      const drawerAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      assert.equal(drawerAudit.violations.length, 0, JSON.stringify(drawerAudit.violations, null, 2));
      await page.screenshot({ path: path.join(artifacts, "360-docs-drawer-open.png") });
      await page.keyboard.press("Escape");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    }
    // The switcher reaches the same page in another version, and the old
    // guide URL still leads to the current guide.
    await page.getByRole("navigation", { name: "Documentation versions" }).getByRole("link", { name: /^0\.2\.14/ }).click();
    assert.match(page.url(), /docs\/0\.2\.14\/$/, "0.2.14 lacks this page, so its index opens");
    await page.goto(new URL("docs/guides/first-session/", base).href, { waitUntil: "networkidle" });
    assert.match(page.url(), /docs\/current\/getting-started\/first-session\/$/);
    await page.goto(new URL("blog/", base).href, { waitUntil: "networkidle" });
    assert.match(page.url(), /\/journal\/$/, "the old journal address redirects");
    assert.equal(errors.length, 0, errors.join("\n"));
    await context.close();
  }
  // Tablet (< 1200px and >= 860px): 2-column .docs-shell with right TOC collapsed into .mobile-toc.
  {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    for (const route of ["", "docs/current/getting-started/first-session/"]) {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `Horizontal page overflow: 1024 ${route}`);
      const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const violations = audit.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map((n) => n.target) }));
      results.push({ width: 1024, route, violations });
      assert.equal(violations.length, 0, JSON.stringify(results.at(-1), null, 2));
      await page.screenshot({
        path: path.join(artifacts, `1024-${route.replaceAll("/", "-") || "home"}.png`),
        fullPage: true,
      });
    }
    const cols1024 = await page.evaluate(
      () => getComputedStyle(document.querySelector(".docs-shell")).gridTemplateColumns.trim().split(/\s+/).length,
    );
    assert.equal(cols1024, 2, "Tablet < 1200px collapses .docs-shell to 2 columns");
    assert.equal(await page.locator(".docs-sidebar-left").isVisible(), true);
    assert.equal(await page.locator(".docs-toc-right").isVisible(), false);
    assert.equal(await page.locator(".mobile-toc").isVisible(), true);
    assert.equal(await page.locator(".docs-nav-toggle").isVisible(), false);
    await context.close();
  }
  // Colour schemes: the system preference alone must pass the same audits;
  // the picker must override it, persist per browser, and return to the
  // system preference on the empty choice.
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    // The "system" scheme follows the preference; the default is Blueprint paper.
    await context.addInitScript(() => { try { if (!localStorage.getItem("palette")) localStorage.setItem("palette", "system"); } catch {} });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const violations = audit.violations.map((v) => ({
        id: v.id, impact: v.impact, description: v.description,
        nodes: v.nodes.map((n) => n.target),
      }));
      results.push({ width: 1440, scheme: "dark", route, violations });
      assert.equal(violations.length, 0, JSON.stringify(results.at(-1), null, 2));
      if (route === "")
        await page.screenshot({ path: path.join(artifacts, "1440-dark-home.png"), fullPage: true });
    }
    await page.goto(base);
    const scheme = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const dark = await scheme();
    const picker = page.getByRole("combobox", { name: "Colour scheme" });
    assert.equal(await picker.inputValue(), "system");
    await picker.selectOption("solarized-light");
    const solarized = await scheme();
    assert.equal(solarized, "rgb(253, 246, 227)", "Solarized light paper");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await scheme(), solarized, "The chosen scheme must persist across reloads");
    assert.equal(await page.evaluate(() => localStorage.getItem("palette")), "solarized-light");
    // Every scheme passes the same audits on the home page and a documentation page.
    const schemes = await picker.evaluate((el) => [...el.options].map((o) => o.value));
    for (const value of schemes) {
      for (const route of ["", "docs/current/getting-started/first-session/"]) {
        await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
        await page.getByRole("combobox", { name: "Colour scheme" }).selectOption(value);
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const violations = audit.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map((n) => n.target) }));
        results.push({ width: 1440, scheme: value, route, violations });
        assert.equal(violations.length, 0, JSON.stringify(results.at(-1), null, 2));
        if (!route) await page.screenshot({ path: path.join(artifacts, `1440-scheme-${value}.png`) });
      }
    }
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("combobox", { name: "Colour scheme" }).selectOption("system");
    assert.equal(await scheme(), dark, "The system choice follows the preference again");
    assert.equal(await page.evaluate(() => localStorage.getItem("palette")), "system");
    await page.getByRole("combobox", { name: "Colour scheme" }).selectOption("blueprint");
    assert.equal(await scheme(), "rgb(250, 250, 245)", "Blueprint paper is the default");
    assert.equal(await page.evaluate(() => localStorage.getItem("palette")), null, "The default is not stored");
    await context.close();
  }
  {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      colorScheme: "dark",
      viewport: { width: 360, height: 780 },
    });
    const page = await context.newPage();
    await page.goto(new URL("docs/", base).href);
    assert.equal(await page.getByRole("combobox", { name: "Colour scheme" }).count(), 0,
      "The picker needs JavaScript and stays hidden without it");
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(250, 250, 245)",
      "Without JavaScript the default Blueprint paper palette applies");
    await page.screenshot({ path: path.join(artifacts, "360-dark-nojs-docs.png"), fullPage: true });
    await context.close();
  }
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 780 },
  });
  const page = await context.newPage();
  await page.goto(new URL("docs/current/getting-started/first-session/", base).href);
  await page
    .getByRole("navigation", { name: /^Documentation 0/ })
    .getByRole("link", { name: /^Windows/ })
    .first()
    .click();
  assert.match(page.url(), /docs\/current\/platforms\/windows-wsl2\/$/);
  assert.equal(
    await page.locator("h1").textContent(),
    "Windows: read this before installing",
  );
  await context.close();
  console.log(
    `Browser checks passed: ${results.length} page/viewport/scheme audits, no overflow or WCAG A/AA violations, 3-col/2-col/mobile-drawer responsive layout, keyboard navigation, anchors, colour-scheme picker, every scheme's audits and persistence, and no-JavaScript navigation in both schemes.`,
  );
} finally {
  fs.writeFileSync(
    path.join(artifacts, "browser-results.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
