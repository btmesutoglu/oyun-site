/**
 * site.js
 * - Language selection (TR/EN) stored in localStorage
 * - Loads locales/<lang>.json relative to this script location (works on Cloudflare Pages, subpaths, and file://)
 * - Applies translations on elements with [data-i18n]
 * - Exposes window.__t(key) and window.__setLang(lang)
 */
(() => {
  const LANG_KEY = "lang";
  const SUPPORTED = ["tr", "en"];
  const DEFAULT_LANG = (() => {
    const nav = (navigator.language || "en").toLowerCase();
    return nav.startsWith("tr") ? "tr" : "en";
  })();

  /** @type {Record<string,string> | null} */
  let dict = null;

  function getLang() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    return DEFAULT_LANG;
  }

  // Determine site root relative to the loaded site.js file.
  function getRootBase() {
    const scripts = Array.from(document.scripts || []);
    const me = scripts.find(s => (s.src || "").includes("/assets/site.js")) || scripts.find(s => (s.src || "").endsWith("assets/site.js"));
    const src = me?.src || (document.currentScript && document.currentScript.src) || "";
    if (!src) return "./";
    // src like .../assets/site.js -> root is ../
    return new URL("../", src).toString();
  }

  const ROOT = getRootBase();

  async function loadDict(lang) {
    const url = new URL(`locales/${lang}.json`, ROOT).toString();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Locale load failed: ${lang}`);
    dict = await res.json();
  }

  function t(key) {
    if (!dict) return key;
    return dict[key] ?? key;
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });

    // Optional: update page title if data-title-i18n is provided on <html>
    const html = document.documentElement;
    const titleKey = html.getAttribute("data-title-i18n");
    if (titleKey) document.title = t(titleKey);

    // Update active lang UI
    const lang = getLang();
    document.querySelectorAll("[data-lang]").forEach(btn => {
      const is = btn.getAttribute("data-lang") === lang;
      btn.setAttribute("aria-pressed", is ? "true" : "false");
      btn.classList.toggle("is-active", is);
    });

    // Set <html lang="">
    document.documentElement.setAttribute("lang", lang);
  }

  async function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem(LANG_KEY, lang);
    await loadDict(lang);
    applyTranslations();
  }

  function wireLangButtons() {
    document.querySelectorAll("[data-lang]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const lang = btn.getAttribute("data-lang");
        if (!lang) return;
        try {
          await setLang(lang);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  // Boot
  (async () => {
    try {
      await loadDict(getLang());
    } catch (e) {
      console.warn("Locale load failed, continuing with keys.", e);
      dict = null;
    }
    applyTranslations();
    wireLangButtons();
  })();

  window.__t = t;
  window.__setLang = setLang;
  window.__getLang = getLang;
  window.__rootBase = ROOT;
})();
