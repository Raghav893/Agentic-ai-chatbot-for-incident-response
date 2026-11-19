export const themeStorageKey = "threatguard-theme";

export function toggleTheme() {
  const root = document.documentElement;
  const dark = root.classList.contains("dark") ||
    (!root.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = dark ? "light" : "dark";

  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Keep the selected theme for this page if storage is unavailable.
  }
}
