# Readeck Highlights Overlay

A userscript that adds Readwise Reader-style highlights to [Readeck](https://readeck.io/): highlight text on the live article page, and the highlight is stored on your Readeck bookmark and shown again on your next visit, on any saved copy of the page.

## What it does

- Shows your existing Readeck highlights directly on the live page.
- Lets you create highlights with a popup menu cloned from Readeck's own in-app highlight menu.
- If the article isn't in your Readeck yet, the script saves it first.
- Local-first: highlights work offline and replicate to your Readeck server in the background.

## Install

1. Install a userscript manager (Tampermonkey or Violentmonkey) in your desktop browser.
2. Open the raw script and the manager will offer to install it:
   https://raw.githubusercontent.com/atvirokodosprendimai/readeck-highlights-overlay/main/readeck-highlights-overlay.user.js
3. On any page, open the script manager menu and pick "Readeck: set server and token", then enter:
   - your Readeck server URL (e.g. `https://readeck.example.com`),
   - an API token from Readeck → Profile → API tokens, with the **bookmarks write** scope (needed to save articles and create highlights).

The server URL and token are kept in the userscript manager's storage, not in this file, so script updates never wipe them and no personal data is published here.

## Highlight mode (off by default)

Highlight mode is **off** on every site until you turn it on, so selecting text to copy or paste is never interrupted by the highlight popup.

- Click the round button in the bottom-right corner to toggle highlight mode for the current site. The choice is remembered per site.
- The button is dimmed while highlight mode is off.
- Shift+click the button forces a full sync (this also turns highlight mode on).
- The same toggle is in the script manager menu: "Readeck: highlight mode on/off (this site)".

## Language

The UI is in **English by default**. To switch, open the script manager menu and pick "Readeck: language / kalba", then enter a language code (currently `en` and `lt`). The choice is kept in manager storage.

To add a language, copy the `en` block in the `LANGS` table at the top of the script under a new key (e.g. `de`) and translate the values. The new code works in the language prompt right away; any missing string falls back to English.

## Limits

- Desktop browsers only (needs a userscript manager).
- If the same article is saved in Readeck more than once, a new highlight attaches to the first matching copy; merging existing duplicates is a separate step.
- The script runs on all sites (`*://*/*`) but only talks to the Readeck server you configure.

## License

MIT, see [LICENSE](LICENSE).
