# PWA + Swimming Pool Icon

## Summary

Make the Pasienky 50m frontend installable as a PWA with a custom swimming/pool-themed icon used as app icon and favicon.

## Icon Design

- SVG, dark circular background (#1a1c22)
- 3-4 horizontal lane lines in graduating blues (#3a7bd5 to #6a9fff)
- Subtle wave pattern across the top
- Sizes: SVG master, 192x192 PNG, 512x512 PNG
- Used as: PWA manifest icons, favicon, apple-touch-icon

## PWA Manifest

File: `client/public/manifest.webmanifest`

- `name`: "Pasienky 50 m – Volne plavecke drahy"
- `short_name`: "Pasienky 50 m"
- `lang`: "sk"
- `start_url`: "/"
- `display`: "standalone"
- `theme_color`: "#0f1117"
- `background_color`: "#0f1117"
- `icons`: 192x192 and 512x512 PNGs, plus SVG

## HTML Changes (index.html)

- Add `<link rel="manifest" href="manifest.webmanifest">`
- Add `<meta name="theme-color" content="#0f1117">`
- Add `<link rel="apple-touch-icon" href="icon-192.png">`
- Update favicon link to new SVG icon

## Scope

- No service worker
- No offline support
- Basic installable PWA only

## Files

- Create: `client/public/icon.svg`
- Create: `client/public/icon-192.png`
- Create: `client/public/icon-512.png`
- Create: `client/public/manifest.webmanifest`
- Modify: `client/src/index.html`
