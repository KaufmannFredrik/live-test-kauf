# Blank Canvas

A minimal, navigable multi-page site — blank-canvas / design-tool aesthetic (graph paper backdrop, coordinate readouts, live clock), lorem ipsum placeholder content, real page-to-page navigation.

## Structure

```
blank-canvas-site-v2/
├── index.html      # Home — big "TEST" hero
├── about.html
├── work.html
├── notes.html
├── contact.html
├── css/
│   └── style.css   # shared styling for all pages
└── js/
    └── main.js     # shared: clock + mouse-coordinate readout
```

Each page is a standalone HTML file that shares the same `css/style.css` and `js/main.js`. This is a plain multi-page site (no JS routing) — links are normal `<a href="about.html">` tags, so it works exactly as-is on GitHub Pages, no build step required.

## Run locally

Open `index.html` directly in a browser, or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy on GitHub Pages

1. Push this folder's contents to a GitHub repo.
2. Go to **Settings → Pages**.
3. Under **Source**, choose the branch (e.g. `main`) and root folder (`/`).
4. Save — your site will be live at `https://<username>.github.io/<repo-name>/`.

## Add a new page

1. Copy any existing page (e.g. `about.html`) to `newpage.html`.
2. Update the `<title>`, the `ACTIVE — ...` label, and the page content inside `<main>`.
3. Add `<a href="newpage.html">New Page</a>` to the `.navlinks` block on **every** page (including the new one, marked `class="active"` there).

## Customize

- Colors, fonts, spacing: edit CSS variables at the top of `css/style.css`.
- Behavior: `js/main.js` handles the clock and mouse-coordinate readout only — no routing logic needed since navigation is native browser links.
