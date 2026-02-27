import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Core Flow: Create workspace → Upload source → Ask question → Get answer", () => {
  test("end-to-end knowledge notebook flow", async ({ page }) => {
    // 1. Navigate to landing page
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "AI Knowledge Notebook" })).toBeVisible();

    // 2. Create a new workspace
    await page.getByRole("button", { name: "Create Workspace" }).click();
    await expect(page.getByRole("button", { name: "New Notebook" })).toBeVisible({ timeout: 10_000 });

    // 3. Create a notebook
    await page.getByRole("button", { name: "New Notebook" }).click();

    // 4. Click into the first notebook to open it
    const notebook = page.locator("button").filter({ hasText: /Notebook/i }).first();
    await expect(notebook).toBeVisible({ timeout: 5_000 });
    await notebook.click();

    // 5. Verify we're in the three-pane layout (sources pane visible)
    const uploadLabel = page.getByText("Upload file");
    await expect(uploadLabel).toBeVisible({ timeout: 10_000 });

    // 6. Upload a VTT source file
    const fileInput = page.locator('input[type="file"]');
    const fixturePath = path.resolve(__dirname, "fixtures", "test-source.vtt");
    await fileInput.setInputFiles(fixturePath);

    // 7. Wait for the source to appear in the sources pane
    await expect(page.getByText("test-source.vtt")).toBeVisible({ timeout: 30_000 });

    // 8. Ask a question about the uploaded source
    const chatInput = page.getByPlaceholder(/Ask about your sources/);
    await chatInput.fill("How many active users did Project Aurora reach?");
    await chatInput.press("Enter");

    // 9. Wait for AI response (generous timeout for LLM)
    const assistantMessage = page.locator('[class*="prose"]').last();
    await expect(assistantMessage).toBeVisible({ timeout: 90_000 });

    // 10. Verify the response contains relevant content
    const responseText = await assistantMessage.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(10);
    // The source mentions 5,000 active users — check the response references this
    expect(responseText!.toLowerCase()).toMatch(/5[,.]?000|five thousand/);
  });
});
