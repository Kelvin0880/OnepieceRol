// Shared Playwright helpers for the crew panel (2026-09-24: the crew UI moved from the sidebar to its own panel).
export async function openCrewPanel(page) {
  await page.click('[data-testid="crew-open"]');
  await page.waitForSelector('[data-testid="crew-panel"]');
}

export async function closeCrewPanel(page) {
  await page.click('[data-testid="crew-panel"] button:has-text("Cerrar")');
  await page.waitForSelector('[data-testid="crew-panel"]', { state: "detached" });
}

/** Founds a crew from the panel and returns its invite code. */
export async function foundCrew(page, name, flag) {
  await openCrewPanel(page);
  await page.click('[data-testid="crew-tab-invite"]');
  await page.fill('[data-testid="new-crew-name"]', name);
  await page.fill('input[placeholder="Emblema / descripción"]', flag);
  await page.click('[data-testid="new-crew-go"]');
  await page.click('[data-testid="crew-tab-crew"]');
  await page.waitForSelector('[data-testid="crew-code"]');
  const code = (await page.textContent('[data-testid="crew-code"]')).trim();
  await closeCrewPanel(page);
  return code;
}

/** Joins a crew with its invite code from the panel. */
export async function joinCrewByCode(page, code) {
  await openCrewPanel(page);
  await page.click('[data-testid="crew-tab-invite"]');
  await page.fill('[data-testid="join-code"]', code);
  await page.click('[data-testid="join-go"]');
  await page.click('[data-testid="crew-tab-crew"]');
  await page.waitForSelector('[data-testid="crew-members"]');
  await closeCrewPanel(page);
}
