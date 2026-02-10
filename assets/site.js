/**
 * site.js (shared)
 * - Language (TR/EN) stored in localStorage
 * - Lightweight i18n loader: /locales/{lang}.json
 * - Exposes window.__t(key, fallback) for game scripts
 */
(function () {
  "use strict";

  var LANG_KEY = "lang";
  var dict = null;

  function getStoredLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      return (v === "en" || v === "tr") ? v : null;
    } catch (e) {
      return null;
    }
  }

  function getDefaultLang() {
    var htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.indexOf("en") === 0) return "en";
    return "tr";
  }

  function getLang() {
    return getStoredLang() || getDefaultLang();
  }

  function setStoredLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  }

  function getRootBase() {
    // Determine site root relative to the loaded site.js file.
    var scripts = document.getElementsByTagName("script");
    var src = "";
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      var u = s.getAttribute("src") || "";
      if (u.indexOf("/assets/site.js") !== -1 || u.slice(-12) === "assets/site.js") {
        src = s.src || u;
        break;
      }
    }
    if (!src && document.currentScript) src = document.currentScript.src || "";
    if (!src) return "./";
    try {
      return new URL("../", src).toString();
    } catch (e) {
      return "./";
    }
  }

  var ROOT = getRootBase();

  function t(key, fallback) {
    if (!key) return "";
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return String(dict[key]);
    return (fallback != null) ? String(fallback) : String(key);
  }

  // Expose for games
  window.__t = t;

  function qsAll(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function setActiveLangButton(lang) {
    qsAll("[data-lang]").forEach(function (a) {
      var isActive = a.getAttribute("data-lang") === lang;
      if (isActive) a.classList.add("is-active");
      else a.classList.remove("is-active");
    });
  }

  function applyI18n() {
    // Text nodes
    qsAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n") || "";
      if (!key) return;
      // Only override when we have a translation. Otherwise keep the existing HTML text.
      if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
        el.textContent = t(key);
      }
    });

    // Document title (optional)
    var titleKey = document.documentElement.getAttribute("data-title-i18n");
    if (titleKey && dict && Object.prototype.hasOwnProperty.call(dict, titleKey)) {
      document.title = t(titleKey);
    }
  }

  function loadDict(lang) {
    var url = ROOT + "locales/" + lang + ".json";
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("Locale HTTP " + res.status);
        return res.json();
      })
      .then(function (j) {
        dict = j || {};
      })
      .catch(function () {
        // If locales can't be fetched (e.g., file://), keep dict empty and keep existing page texts.
        dict = {};
      });
  }

  function setLang(lang) {
    if (lang !== "tr" && lang !== "en") lang = "tr";
    setStoredLang(lang);
    document.documentElement.setAttribute("lang", lang);
    setActiveLangButton(lang);
    return loadDict(lang).then(function () {
      applyI18n();
      // let games refresh their own labels (score, overlay etc.)
      try {
        if (typeof window.__onLangChanged === "function") window.__onLangChanged(lang);
      } catch (e) {}
    });
  }

  function wireLangButtons() {
    qsAll("[data-lang]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var lang = a.getAttribute("data-lang") || "tr";
        setLang(lang);
      }, { passive: false });
    });
  }

  function boot() {
    wireLangButtons();
    var lang = getLang();
    document.documentElement.setAttribute("lang", lang);
    setActiveLangButton(lang);
    loadDict(lang).then(applyI18n);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();