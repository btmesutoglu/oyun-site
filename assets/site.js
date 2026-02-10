/**
 * site.js
 * - Language selection (TR/EN) stored in localStorage
 * - Loads /locales/<lang>.json and applies translations on elements with [data-i18n]
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

  async function loadDict(lang) {
    // Using absolute path works best on Cloudflare Pages.
    const res = await fetch(`/locales/${lang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Locale load failed: ${lang}`);
    return await res.json();
  }

  function t(key) {
    if (!dict) return key;
    return dict[key] ?? key;
  }

  function applyTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });
    root.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = t(key);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", t(key));
    });
    // Title
    const titleKey = document.documentElement.getAttribute("data-title-i18n");
    if (titleKey) document.title = t(titleKey);
  }

  function updateLangButtons(lang) {
    document.querySelectorAll("[data-lang]").forEach(btn => {
      const v = btn.getAttribute("data-lang");
      const pressed = v === lang;
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    });
  }

  async function setLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;

    dict = await loadDict(lang);
    applyTranslations(document);
    updateLangButtons(lang);

    // Let games/pages react after translations load:
    window.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }

  function wireLangButtons() {
    document.querySelectorAll("[data-lang]").forEach(btn => {
      btn.addEventListener("click", () => {
        const lang = btn.getAttribute("data-lang") || DEFAULT_LANG;
        setLang(lang).catch(console.error);
      });
    });
  }

  // Expose helpers for game scripts
  window.__t = t;
  window.__getLang = getLang;
  window.__setLang = setLang;

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    wireLangButtons();
    setLang(getLang()).catch(console.error);
  });
})();
