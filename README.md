# Mini Oyun Sitesi (Cloudflare Pages)

## Yapı
- /assets → site kabuğu (genel CSS/JS, bayraklar)
- /locales → çeviri dosyaları (tr/en)
- /games/<oyun> → her oyun bağımsız mini-app (index.html + game.css + game.js)

## Dil
- TR/EN seçimi localStorage'da `lang` olarak tutulur.
- Çeviriler `data-i18n="key"` ile uygulanır.

## Deploy
Cloudflare Pages:
- Framework: None
- Build: yok
- Output: repo root
