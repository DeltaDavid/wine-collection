# Wine Collection — Project Rules

## What This Is
Personal wine collection browser. Single-file vanilla JS PWA deployed to Cloudflare Pages.

## Architecture
- **Main file:** `wine_collection.html` contains all HTML, CSS, and JS (the deployed app)
- **Legacy:** `index.html` exists but may be an older version — `wine_collection.html` is canonical
- **Hosting:** Cloudflare Pages (`david-wine`), deploy via `npx wrangler pages deploy . --project-name=david-wine`
- **PWA:** `wine_manifest.json`, `wine_sw.js`, SVG and PNG icons

## Coding Standards
- Follow Airy Pastel design system (soft blues, pastels, generous spacing, rounded corners)
- All CSS uses custom properties defined in `:root`
- Mobile-first responsive design (iPhone, iPad, Mac)
- No external JS frameworks or build tools
- No npm, no bundler — this is a single HTML file with embedded `<script>` and `<style>`

## Quality Gates (mandatory before reporting complete)
1. **Lint the JS:** Extract `<script>` content and verify no syntax errors, no `var` usage, no console.log left in production
2. **Test in browser:** Open the HTML locally or deploy to preview — verify the feature works visually
3. **Check mobile:** Verify layout doesn't break at 375px width
4. **Validate HTML:** No duplicate IDs, no unclosed tags, no inline styles outside the `<style>` block
5. **Data integrity:** Wine data renders correctly, filters and search work

## Common Mistakes to Avoid
- Don't split into multiple files — this is intentionally a single-file app
- Don't add npm/package.json — there is no build step
- Don't use `var` — use `const` and `let`
- Don't leave `console.log` in production code
- Don't break the service worker cache versioning — increment SW version on every change
- Don't change the Airy Pastel color variables without checking all apps for consistency
- Don't confuse `index.html` with `wine_collection.html` — the latter is the current app

## Deploy Workflow
1. Make all changes locally
2. Test by opening wine_collection.html in browser
3. Report changes to David with numbered summary
4. Wait for David's approval
5. Deploy: `npx wrangler pages deploy . --project-name=david-wine`
