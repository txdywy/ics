# ICS Static Calendar Gallery Design

## Goal

Build a pure frontend static website for this repository that showcases all `.ics` calendar files in the directory. The site should automatically discover calendars during deployment, classify them by theme, present them in a cute polished gallery, and provide reliable ways to preview, download, and subscribe to each calendar.

## Current Repository Context

The repository currently contains several root-level `.ics` files and a `CNAME` file. The root-level calendar file locations should remain stable so existing direct links and future subscription links do not break.

## Chosen Approach

Use a static site with a small build-time indexing step:

- Keep `.ics` files at the repository root.
- Add a framework-free frontend: `index.html`, `assets/styles.css`, and `assets/app.js`.
- Add `scripts/generate-calendars.mjs` to scan root-level `.ics` files and generate `calendars.json`.
- Use GitHub Actions to run the indexing script on pushes to `main` and deploy the generated static files to GitHub Pages.
- Preserve `CNAME` in the deployed artifact.

This avoids a frontend framework while still making calendar discovery automatic.

## Architecture

### Static Frontend

`index.html` defines the page shell and loads the stylesheet and application script.

`assets/styles.css` implements a cute themed calendar showcase with responsive cards, polished spacing, category tags, soft colors, and graceful fallback visuals.

`assets/app.js` loads `calendars.json`, renders calendars, and handles browser-only interactions: search, category filtering, sorting, view toggles, detail expansion, download links, subscription links, and copy-to-clipboard.

### Build-Time Indexer

`scripts/generate-calendars.mjs` scans the repository root for `.ics` files. For each file it extracts:

- file name and relative URL
- display title
- inferred category
- event count
- date range when available
- representative upcoming or sample events
- theme keywords
- image candidate or fallback visual configuration
- parse warning if the file cannot be fully parsed

The script writes the final public data file to `calendars.json`.

### GitHub Pages Deployment

`.github/workflows/pages.yml` runs on pushes to `main`. It checks out the repository, sets up Node, runs the calendar indexing script, uploads the static site artifact, and deploys it through GitHub Pages.

The project should continue to treat `main` as the source branch. The deployment path changes from direct branch publishing to Actions-generated Pages artifacts so `calendars.json` is always current.

## Calendar Classification

Classification is automatic. The indexer infers categories from file names and ICS content using keyword rules.

Initial categories:

- character / cute themes
- film / fantasy / magic
- music / concerts
- birthdays / anniversaries
- other

Examples from the current files:

- Chiikawa-themed calendar → character / cute themes
- HP birthday calendar → film / fantasy / magic or birthdays / anniversaries depending on detected content
- Mayday calendar → music / concerts

The first implementation should prefer simple transparent keyword rules over opaque machine-generated classification.

## Image and Visual Strategy

The selected strategy is hybrid:

- The build step may generate theme image candidates or image metadata from detected calendar themes.
- The frontend must always support a local visual fallback when a remote image is missing or unsuitable.
- Fallback cards use theme colors, gradients, decorative shapes, and small icon-like elements so the page stays attractive without external images.

Pure frontend runtime image scraping is out of scope because it is unreliable on GitHub Pages, may hit cross-origin restrictions, and can introduce copyright or availability problems.

## Page Experience

### Hero

The top section introduces the calendar shelf, explains that calendars can be previewed, downloaded, or subscribed to, and summarizes:

- number of calendars
- total event count
- latest generated date

### Filters and Display Controls

The page includes:

- search by calendar name, category, theme keywords, and event text
- category filter chips
- card view and compact list view
- option to show or hide event previews
- sorting by theme, name, or event count

All filtering and display changes happen client-side.

### Calendar Cards

Each calendar card shows:

- cover image or fallback themed visual
- title
- category tag
- event count
- date range
- representative event preview
- download `.ics` action
- `webcal://` subscription action
- copy link action
- expandable local detail preview

### Subscription and Import Guidance

The page includes short guidance for Apple Calendar, Google Calendar, and Outlook. It explains that downloading an `.ics` file is typically a one-time import, while `webcal://` is intended for subscription where supported.

## Data Flow

1. A maintainer adds or updates root-level `.ics` files.
2. The maintainer pushes to `main`.
3. GitHub Actions runs `scripts/generate-calendars.mjs`.
4. The script writes `calendars.json`.
5. GitHub Actions deploys the static site artifact to GitHub Pages.
6. A browser loads `index.html`.
7. `assets/app.js` fetches `calendars.json` and renders the gallery.
8. Users filter, preview, download, subscribe, or copy links entirely in the browser.

## Error Handling

- If `calendars.json` fails to load, the page shows a friendly empty state explaining that the calendar index is unavailable.
- If an individual `.ics` file fails to parse, the indexer records a `parseWarning` for that calendar rather than failing the whole site.
- If a cover image fails to load, the card uses its generated fallback visual.
- If clipboard access is unavailable, the page displays the link so users can copy it manually.
- If no calendars are found, the generated index contains an empty list and the page shows an empty gallery state.

## Testing and Verification

Implementation should verify:

- the generator detects the current root-level `.ics` files
- generated `calendars.json` contains the expected fields
- the static page renders all calendars locally
- search, category filters, sorting, view toggle, and event preview toggle work
- `.ics` download links resolve to root-level files
- `webcal://` subscription links are generated from the deployed HTTP(S) URL
- copy link works or shows a manual fallback
- missing images use fallback visuals
- GitHub Actions includes `CNAME` in the deployed artifact

For frontend completion, run a local static server and test the page in a browser before claiming the implementation is complete.

## Out of Scope

- Backend service or database
- User accounts or saved preferences across devices
- Runtime web scraping from the browser
- Full recurring event expansion beyond the lightweight preview needed for display
- Reorganizing existing `.ics` files into subdirectories
