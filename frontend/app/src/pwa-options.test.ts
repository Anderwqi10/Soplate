import { pwaOptions } from "./pwa-options";

test("manifest describes an installable standalone app", () => {
  expect(pwaOptions.manifest).toMatchObject({
    name: "Soplate",
    short_name: "Soplate",
    display: "standalone",
    theme_color: "#0f2742",
    background_color: "#0f2742",
    start_url: "/",
  });
});

test("manifest has a maskable icon", () => {
  const icons = pwaOptions.manifest ? pwaOptions.manifest.icons : undefined;
  expect(Array.isArray(icons) && icons.some((icon) => icon.purpose === "maskable")).toBe(true);
});

test("service worker never serves the API or admin from the app shell", () => {
  const denylist = pwaOptions.workbox?.navigateFallbackDenylist ?? [];
  expect(denylist.some((re) => re.test("/api/accounts/"))).toBe(true);
  expect(denylist.some((re) => re.test("/admin/"))).toBe(true);
});

test("nothing outside the precache list is cached at runtime", () => {
  expect(pwaOptions.workbox?.runtimeCaching).toBeUndefined();
});
