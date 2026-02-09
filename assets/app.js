(function () {
  // Aktif dili işaretle + localStorage'a yaz
  const htmlLang = document.documentElement.getAttribute("lang") || "en";
  const lang = htmlLang.toLowerCase().startsWith("tr") ? "tr" : "en";
  localStorage.setItem("lang", lang);

  const trBtn = document.querySelector('[data-lang="tr"]');
  const enBtn = document.querySelector('[data-lang="en"]');
  if (lang === "tr" && trBtn) trBtn.classList.add("active");
  if (lang === "en" && enBtn) enBtn.classList.add("active");
})();
