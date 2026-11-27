# MegaDrum Studio

Modern TypeScript + React + Web MIDI rewrite of MegaDrum Manager FX (`MDMFX`). Runs directly in Chromium-based browsers (Chrome, Edge, Opera, Brave) with Web MIDI SysEx support, encrypted `.bin` firmware flashing, offline PWA installation, and multi-theme support.

## Run Directly from GitHub Pages (No Local Install)

1. Push this repository to GitHub (e.g. `https://github.com/kajuk/MegaDrumStudio`).
2. In the GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push to `main` (or trigger the **Deploy MegaDrum Studio to GitHub Pages** workflow under **Actions**).
5. Once deployed, open `https://<your-username>.github.io/<repo-name>/` in Chrome or Edge.
   - GitHub Pages serves over HTTPS, which enables **Web MIDI (with SysEx)** and **Install as Offline App (PWA)** out of the box.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

To build a production bundle (`dist/`):

```bash
npm run build
npm run preview
```
