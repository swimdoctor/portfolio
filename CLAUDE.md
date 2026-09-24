# Portfolio Project Context

## Purpose

This repository is Dylan's dependency-free static portfolio website. It contains a home page, an archive of project cards, individual project pages, and a shared animated triangular background.

Keep the site simple, accessible, responsive, and compatible with static hosting. Avoid introducing a frontend framework unless explicitly requested.

## Repository Structure

- `index.html`: home page with about/hero content and generated featured project cards.
- `projects/index.html`: all-project archive with generated cards and multi-tag filtering.
- `projects/*.html`: individual project pages. Each project page owns its metadata and long-form content.
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

The project page visible header has `data-project-field` hooks. `scripts/projectPage.js` reads the metadata at runtime and updates the title, date eyebrow, description, tags, image, alt text, and browser title. Keep the fallback text synchronized when practical so the page is still sensible before JavaScript runs.

## Current Projects

- `CraftUp.html`: January 2024 - May 2024; Game, C#, MonoGame, Class Project; uses `images/CraftUp.png`.
- `SelfDrivingRacecars.html`: September 2026; Machine Learning, Unity, C#, Personal Project, In Progress; uses `images/placeholder.svg`.
- `Dadatothmo.html`: August 2025 - May 2026; Godot, GDScript, Game, Class Project; uses `images/placeholder.svg`.

## Build-Time Generation

`onPush.js` discovers every `.html` file in `projects/` except `projects/index.html`. It reads project metadata and regenerates content between these markers:

```html
<!-- project-cards:start -->
...
<!-- project-cards:end -->
```

On the archive page it also regenerates:

```html
<!-- project-filters:start -->
...
<!-- project-filters:end -->
```

The generator creates cards for both the home page and archive page. Home cards receive alternating layout classes (`project-card--reverse` on every second card); archive cards stay consistent for scanning.

Important: the generator runs only if the repository's GitHub workflow invokes `onPush.js`. Check `.github/workflows/` before assuming a push automatically regenerates pages. Node.js was unavailable in the local environment during earlier work, so validate the GitHub-side runtime when possible.

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

## Card Layout

Cards are horizontal by default:

- Square image on the left.
- Title, description, and tags on the right.
- On the home page, every second card reverses the image/content columns on desktop.
- On mobile, reversed cards return to image-left for consistent narrow-screen scanning.

Relevant classes include `project-card`, `project-card--reverse`, `project-card__image`, `project-card__content`, `tag-list`, and `filter-button`.

## Animated Background

`scripts/triangularField.js` creates a canvas behind the content:

- Moving points are independently animated.
- A Delaunay-style triangulation is recomputed every frame.
- Triangle fills are solid colors, not per-triangle gradients.
- Color is selected from a global vertical multi-stage gradient using the triangle centroid Y-position.
- `gradientStops` is an ordered array with normalized positions from `0` at the top to `1` at the bottom.
- Four exact fixed points anchor the document corners.
- Canvas height follows the full document height.
- Canvas width uses `document.documentElement.clientWidth` to avoid scrollbar-width horizontal overflow.
- Reduced-motion preference stops point movement while preserving the static mesh.
- The canvas is loaded by all pages and styled as `.point-field`.
- `html { overflow-x: hidden; }` prevents residual horizontal overflow.

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

Editor diagnostics have passed for the affected HTML, CSS, and JavaScript files during prior changes. Local Node.js was unavailable, so the GitHub/build-time `onPush.js` execution has not been verified locally. Browser-level validation is useful for checking:

- Full-page background coverage while scrolling.
- No horizontal scrollbar.
- Corner coverage.
- Home card alternation.
- Multi-tag intersection counts and disabled options.
- Responsive card behavior.
