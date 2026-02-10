/*!
 * site.js (shared)
 * - ES5 compatible (mobile-safe)
 * - Embedded locales (no fetch / no CORS issues)
 * - data-i18n + data-title-i18n support
 */
(function () {
  'use strict';

  var LOCALES = {
    tr: {"site.title": "Mini Oyunlar", "nav.home": "Ana Sayfa", "nav.games": "Oyunlar", "nav.language": "Dil", "home.headline": "Mini Oyun Sitesi", "home.sub": "Basit, hızlı, tarayıcıda çalışan mini oyunlar.", "home.choose": "Bir oyun seç:", "game.snake.name": "Snake", "game.snake.desc": "Klasik yılan oyunu — puan topla, duvara çarpma.", "game.basketball.name": "Basketbol", "game.basketball.desc": "Yakında — farklı konseptte bir mini oyun.", "badge.coming": "Yakında", "snake.title": "Snake", "snake.hint": "Başlamak için ok tuşları / WASD / kaydırma kullan", "snake.pause": "Duraklatıldı", "snake.resume": "Devam etmek için boşluk", "snake.gameover": "Oyun bitti", "snake.restart": "Tekrar başlat: Enter", "snake.score": "Skor", "snake.best": "En iyi", "basket.title": "Basketbol", "basket.subtitle": "Yakında", "basket.body": "Bu oyun için farklı bir arayüz ve kurallar tasarlanacak. Altyapı hazır — sadece içerik gelecek.", "snake.pauseLabel": "Duraklat", "snake.restartLabel": "Yeniden", "snake.touchhint": "Telefon: sahada kaydır veya yön tuşlarına dokun.", "snake.pauseBtn": "Duraklat", "snake.restartBtn": "Yeniden başlat", "btn.play": "Oyna", "btn.open": "Aç"},
    en: {"site.title": "Mini Games", "nav.home": "Home", "nav.games": "Games", "nav.language": "Language", "home.headline": "Mini Game Site", "home.sub": "Simple, fast mini games that run in your browser.", "home.choose": "Pick a game:", "game.snake.name": "Snake", "game.snake.desc": "Classic snake — collect points, don't hit the walls.", "game.basketball.name": "Basketball", "game.basketball.desc": "Coming soon — a mini game with a different concept.", "badge.coming": "Coming soon", "snake.title": "Snake", "snake.hint": "Use Arrow keys / WASD / swipe to start", "snake.pause": "Paused", "snake.resume": "Press Space to resume", "snake.gameover": "Game over", "snake.restart": "Restart: Enter", "snake.score": "Score", "snake.best": "Best", "basket.title": "Basketball", "basket.subtitle": "Coming soon", "basket.body": "This game will have a different UI and ruleset. The foundation is ready — content will follow.", "snake.pauseLabel": "Pause", "snake.restartLabel": "Restart", "snake.touchhint": "Mobile: swipe on the board or tap the D‑pad.", "snake.pauseBtn": "Pause", "snake.restartBtn": "Restart", "btn.play": "Play", "btn.open": "Open"}
  };

  function getStoredLang() {
    try {
      var v = window.localStorage.getItem('lang');
      return (v === 'tr' || v === 'en') ? v : null;
    } catch (e) { return null; }
  }

  function setStoredLang(lang) {
    try { window.localStorage.setItem('lang', lang); } catch (e) {}
  }

  function detectLang() {
    var stored = getStoredLang();
    if (stored) return stored;

    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang === 'en' || htmlLang === 'tr') return htmlLang;

    var nav = (navigator.language || navigator.userLanguage || 'tr').toLowerCase();
    return nav.indexOf('tr') === 0 ? 'tr' : 'en';
  }

  function t(lang, key) {
    var dict = LOCALES[lang] || {};
    return dict[key];
  }

  function applyLang(lang) {
    var dict = LOCALES[lang] || {};
    document.documentElement.setAttribute('lang', lang);

    // Title
    var titleKey = document.documentElement.getAttribute('data-title-i18n');
    if (titleKey) {
      var titleVal = dict[titleKey];
      if (titleVal) document.title = titleVal;
    }

    // Text nodes
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var val = dict[key];
      if (val) el.textContent = val;
    }

    // Active lang UI
    var btns = document.querySelectorAll('[data-lang]');
    for (var j = 0; j < btns.length; j++) {
      var b = btns[j];
      var isActive = b.getAttribute('data-lang') === lang;
      // Keep both class and aria-pressed in sync.
      // (CSS uses aria-pressed, some pages may use the class.)
      if (isActive) {
        b.classList.add('is-active');
        b.setAttribute('aria-pressed', 'true');
      } else {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      }
    }
  }

  function wireLangButtons() {
    var btns = document.querySelectorAll('[data-lang]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var lang = btn.getAttribute('data-lang');
          if (lang !== 'tr' && lang !== 'en') return;
          setStoredLang(lang);
          applyLang(lang);
        }, { passive: false });
      })(btns[i]);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var lang = detectLang();
    wireLangButtons();
    applyLang(lang);
  });
})();
