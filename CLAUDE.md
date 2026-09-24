# Portfolio Project Context

## Purpose

This repository is Dylan's dependency-free static portfolio website. It contains a home page, an archive of project cards, individual project pages, and a shared animated triangular background.

Keep the site simple, accessible, responsive, and compatible with static hosting. Avoid introducing a frontend framework unless explicitly requested.

## Repository Structure

- `index.html`: home page with about/hero content and generated project cards grouped into categories (see Home Page Categories below).
- `projects/index.html`: all-project archive with generated cards and multi-tag filtering.
- `projects/*.html`: individual project pages. Each project page owns its metadata and long-form content.
- `package.json` / `scripts/generate.js`: local entry point (`npm run generate`) that runs `onPush.js`.
- `onPush.js`: GitHub-side/build-time generator. Discovers project pages, reads metadata, and regenerates marked card/filter regions.
- `scripts/projectPage.js`: browser-side project-page metadata hydrator.
- `scripts/triangularField.js`: browser-side animated canvas background.
- `styles/mainStyle.css`: shared layout, card, page, filter, and background-layer styles.
- `images/placeholder.svg`: shared placeholder image for projects without final artwork.

## Metadata Source Of Truth

Each project page stores metadata in the `<head>`. Add or edit metadata there rather than duplicating values in `index.html` or `projects/index.html`.

Required/common fields:

```html
<meta name="project-title" content="Project title">
<meta name="project-start-date" content="January 2024">
<meta name="project-end-date" content="May 2024">
<meta name="project-type" content="Class Project">
<meta name="project-featured" content="1">
<meta name="project-description" content="Short card description.">
<meta name="project-image" content="../images/project-image.png">
<meta name="project-image-alt" content="Accessible image description">
<meta name="project-tag" content="Games">
<meta name="project-tag" content="C#">
```

- `project-end-date` is optional. With it, the project page displays `start - end`; without it, it displays only the start date.
- `project-type` is metadata but is currently not displayed in the project-page eyebrow.
- Add one `project-tag` meta element per tag.
- Tags are case-insensitively counted and filtered.
- Multi-word tags are supported, for example `Machine Learning`, `Class Project`, and `In Progress`.
- `project-featured` is numeric, not boolean: `0` (or omitted/non-numeric) means not featured; `1`, `2`, `3`, ... mean featured, sorted ascending within each home-page category (lower numbers come first). A project appears in a home page category only if it has a positive `project-featured` value **and** carries that category's tag (see Home Page Categories below). The archive page (`projects/index.html`) ignores this field and always lists every project, unordered by it.

The project page visible header has `data-project-field` hooks. `scripts/projectPage.js` reads the metadata at runtime and updates the title, date eyebrow, description, tags, image, alt text, and browser title. Keep the fallback text synchronized when practical so the page is still sensible before JavaScript runs.

## Current Projects

- `CraftUp.html`: January 2024 - May 2024; Game, C#, MonoGame, Class Project; `project-featured` 1; uses `images/CraftUp.png`.
- `SelfDrivingRacecars.html`: September 2026; Machine Learning, Unity, C#, Personal Project, In Progress; `project-featured` 2; uses `images/placeholder.svg`.
- `Dadatothmo.html`: August 2025 - May 2026; Godot, GDScript, Game, Class Project; `project-featured` 0 (off the home page, still in the archive); uses `images/placeholder.svg`.
- `QuickToDrawQuickToClassify.html` ("Quick To Draw, Quick To Classify"): February 2026 - May 2026; Machine Learning, Python, Neural Network, Class Project; `project-featured` 1 (top of the Machine Learning category); uses `images/placeholder.svg`.
- `RaytracingShader.html`: January 2026 - June 2026; Computer Graphics, Shadertoy, GLSL; `project-featured` 1; uses `images/placeholder.svg`.
- `FluidSim.html`: November 2025 (no end date); Hackathon, Simulation, C++, Raylib; `project-featured` 0; uses `images/placeholder.svg`.
- `GeneticLearningRacecar.html` ("Neural Network Genetic Learning Racecar"): start date Unknown; Personal Project, Machine Learning, Unity, C#; `project-featured` 0; uses `images/placeholder.svg`.
- `FloodTheDungeon.html`: start date Unknown; Game, Unity, C#, Game Jam; `project-featured` 0; uses `images/placeholder.svg`.
- `DuckShooter.html`: start date Unknown; Hackathon, Godot, GDScript; `project-featured` 0; uses `images/placeholder.svg`.

"Unknown" is a literal `project-start-date` value for projects without a known date (no `project-end-date` is set for these). It displays as-is in the date eyebrow/card meta, and sorts as the earliest possible date on the archive page (see Project Archive Sorting below).

## Home Page Categories

The home page (`index.html`) is split into fixed categories, each a `<section class="project-category">` with its own `<h3>` heading and a "See all &lt;Category&gt; Projects" link into the archive with that tag pre-selected (`projects/index.html?tag=<tag>`). Categories are defined in `onPush.js` as `homeCategories` (slug + matching tag), currently in this order:

- Machine Learning → tag `machine learning`
- Games → tag `game`
- Computer Graphics → tag `computer graphics`

A project appears under a category if and only if its `project-featured` value is a positive number **and** it carries that category's tag (case-insensitive); within a category, matching projects are sorted by `project-featured` ascending (1 first, then 2, etc.), independent of the archive's alphabetical-by-filename order. A project with multiple matching tags and a positive `project-featured` value can appear in multiple categories - its order number applies within each. A category with no matching projects still renders its heading and "See all" link, with an empty card grid. To add, remove, reorder, or rename a category, edit `homeCategories` in `onPush.js` **and** manually update the corresponding `<section class="project-category">` block (heading, `?tag=` link, and `<!-- project-cards:<slug>:start/end -->` markers) in `index.html` to match, since the generator only fills existing marker pairs, it does not create or remove category sections.

The archive page's tag-filter script (`projects/index.html`) reads a `?tag=` query parameter on load and pre-selects it if it matches an existing filter button, so the home page's "See all" links land with the right filter already applied.

## Build-Time Generation

`onPush.js` discovers every `.html` file in `projects/` except `projects/index.html`. It reads project metadata and regenerates content between marker comment pairs.

The home page has one marker pair per category:

```html
<!-- project-cards:machine-learning:start -->
...
<!-- project-cards:machine-learning:end -->
```

(similarly for `games` and `computer-graphics` — see Home Page Categories above). The archive page has a single, unqualified marker pair covering every project:

```html
<!-- project-cards:start -->
...
<!-- project-cards:end -->
```

and also regenerates the filter buttons between:

```html
<!-- project-filters:start -->
...
<!-- project-filters:end -->
```

Home cards receive alternating layout classes (`project-card--reverse` on every second card, restarting per category); archive cards stay consistent for scanning.

Important: the generator runs only if the repository's GitHub workflow invokes `onPush.js`. Check `.github/workflows/` before assuming a push automatically regenerates pages. Node.js is installed locally: run `npm run generate` (which runs `scripts/generate.js`, a thin wrapper that calls `onPush.js` with null `github`/`context`) to regenerate `index.html` and `projects/index.html` before committing, and commit the generated files together with the source changes so the workflow's "Regenerate project cards and filters" commit has nothing left to do. `onPush.js` must keep working without `github`/`context`. If `node` isn't found in a fresh shell, refresh PATH (`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`) or restart VS Code. The generator writes LF line endings; with `core.autocrlf=true` git may report the pages as modified when only line endings differ, so check `git diff --ignore-cr-at-eol` before assuming a real change.

## Project Archive Filtering

`projects/index.html` supports selecting multiple tags:

- Selected tags are combined with AND/intersection logic.
- Cards must contain every selected tag to remain visible.
- Clicking an active tag removes it.
- `All projects` clears the selection.
- Every tag button displays a count.
- Counts are recalculated against the current selection.
- Unselected buttons with zero possible results are disabled.
- Buttons use `data-filter`, `data-label`, `aria-pressed`, and disabled state.
- `.project-card[hidden] { display: none; }` is required because cards use `display: grid`.

When changing filtering behavior, preserve multi-word tag handling and normalized lowercase comparisons.

## Project Archive Sorting

`projects/index.html` has a `.project-sort` control with two `<select>` elements, `#sort-field` (`end-date` | `alphabetical`) and `#sort-direction` (`desc` | `asc`), defaulting to end date descending (most recent first). Sorting reorders the actual card DOM nodes (via `appendChild`) rather than using CSS `order`, so it composes independently of tag filtering (which only toggles `hidden`) - a hidden card still moves with the sort and reappears in the right place when unhidden.

Each archive card carries `data-end-sort="YYYY-MM"`, generated by `onPush.js` from the project's end date (or start date if there is no end date). Unparseable or unknown dates (e.g. `project-start-date` of `Unknown`) get the key `0000-00`, so they always sort as the oldest/earliest. Alphabetical sorting reads each card's `<h2>` text directly rather than a separate data attribute. `data-end-sort` is only emitted for archive (`variant: 'archive'`) cards, not featured/home cards.

## Card Layout

There are two card variants, generated by `onPush.js` with a `variant` of `'featured'` (home) or `'archive'` (archive page).

**Featured cards** (home page) are horizontal:

- Square image on the left.
- Title, description, and tags on the right.
- Every second card reverses the image/content columns on desktop.
- On mobile, reversed cards return to image-left for consistent narrow-screen scanning.

**Archive cards** (`projects/index.html`) are compact and stacked, three per row on desktop:

- Square image on top.
- Title, then date (`project-card__meta`), then tags, then the summary underneath.
- The archive grid (`project-grid--archive`) collapses to 2 columns at 960px and 1 column at 620px; cards stay stacked (never revert to a side-by-side image/content layout) at every width.

Relevant classes include `project-card`, `project-card--reverse`, `project-card--compact`, `project-card__image`, `project-card__content`, `project-card__meta`, `tag-list`, and `filter-button`.

## Animated Background

`scripts/triangularField.js` creates a canvas behind the content:

- Moving points are independently animated.
- Points sit on a jittered grid (row-major in `points`), and each grid cell is split into two triangles. Each cell independently picks the Delaunay diagonal (incircle test, with hysteresis and a convexity guard) when it is drawn, so triangulation changes are naturally desynchronized and cost ~0.03 ms/frame (the previous full Bowyer-Watson pass cost 8-13 ms/frame on tall pages and produced identical triangles).
- Only the band within 20% of the viewport height above/below the viewport is animated and repainted (clipped `clearRect` + cell redraw); points and pixels outside it stay frozen until scrolled into range. Reduced-motion mode repaints only on resize/scroll.
- Edge points are locked to their edge (left/right column keep x, top/bottom row keep y) so the mesh always fills the page rectangle; corners are fully fixed.
- Triangle fills are solid colors, not per-triangle gradients.
- Color is selected from a global vertical multi-stage gradient using the triangle centroid Y-position, via a precomputed 1024-step lookup table built from `gradientStops`.
- `gradientStops` is an ordered array with normalized positions from `0` at the top to `1` at the bottom.
- Four exact fixed points anchor the document corners.
- Canvas height follows the full document height.
- Canvas width uses `document.documentElement.clientWidth` to avoid scrollbar-width horizontal overflow.
- Reduced-motion preference stops point movement while preserving the static mesh.
- The canvas is loaded by all pages and styled as `.point-field`.
- `html { overflow-x: hidden; }` prevents residual horizontal overflow.

Known limit (not currently a problem): the canvas is sized to the full document at up to 2x pixel ratio. Browsers cap canvas size (roughly 32,767 px per side on desktop Chrome/Firefox, so ~16,000 CSS px of page height at 2x; iOS Safari's ~16.7M px area limit means ~10,000 CSS px on a 390px-wide phone), and memory grows well before that (~370 MB at 1440x16000, 2x). Past the limit the canvas goes blank silently. If pages ever get that tall, the planned fix is: make the canvas viewport-sized and `position: fixed`, and in `drawField` translate the context by `-scrollY` (`context.translate(0, -window.scrollY)`, with the clip/clear band expressed in viewport coordinates) so only the visible slice is ever backed by pixels. `drawField` already computes the visible band (`bandTop`/`bandBottom`), so the change is mostly sizing in `resizeCanvas` plus the translate; the mesh, gradient (still keyed to `pageHeight`), and edge locking stay as they are. Redraw every frame or on scroll, since pixels outside the viewport are no longer retained.

When modifying this script, preserve corner anchors, full-page sizing, multi-stage gradient interpolation, and no-horizontal-scroll behavior.

## Editing Workflow

1. Edit project metadata in the relevant `projects/*.html` file.
2. Edit the project page body content in that same file.
3. Do not manually maintain duplicate metadata in home/archive cards except as a temporary generated fallback.
4. Push or run the configured generator to update `index.html` and `projects/index.html`.
5. Validate editor diagnostics and run `git diff --check`.
6. Commit related source and generated changes together.

Useful commands:

```powershell
npm run generate
git status
git diff --check
git add <files>
git commit -m "Describe the focused change"
git push origin main
```

Do not commit or push automatically without explicit user confirmation. Never discard unrelated user changes.

## Design Direction

The visual direction is still being refined. The current CSS uses CSS variables and a green/orange/blue palette, but the user is redesigning the palette. Keep colors centralized where possible, especially `:root` values and the `gradientStops` array.

The user wants an intentional, more advanced visual system rather than a generic static pattern. Preserve the dynamic point-field background unless explicitly asked to remove or replace it.

## Validation Notes

Editor diagnostics have passed for the affected HTML, CSS, and JavaScript files during prior changes. `npm run generate` has been verified locally (output identical to the committed pages). Browser-level validation is useful for checking:

- Full-page background coverage while scrolling.
- No horizontal scrollbar.
- Corner coverage.
- Home card alternation.
- Multi-tag intersection counts and disabled options.
- Responsive card behavior.
