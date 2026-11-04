# Download Re-Extensioner-o-Matic

A Chrome extension (Manifest V3) that changes the file extension of downloads from sites you choose.

Some web apps save files with the wrong extension. PowerSchool's Quick Export, for example, saves delimited data as `.text`, so it won't open in a spreadsheet until someone renames it. With a rule like "on `example.com`, change `.text` to `.csv`", `student_export.text` downloads as `student_export.csv`.

- Only the final extension changes. `grades.2026.09.text` becomes `grades.2026.09.csv`.
- Nothing else about the download changes. The extension never reads file contents and never sends anything anywhere. See [PRIVACY.md](PRIVACY.md).
- Works on Chromebooks and in Chrome on Windows, macOS and Linux.

> **On Chromebooks**, a renamed PowerSchool export still opens badly. As `.csv` it lands in the Basic Editor with the tabs ignored, and ChromeOS has no app for `.tsv` at all. The companion extension [PowerSchool Export Opener](https://github.com/Prairie-Rose-School-Division/powerschool-export-opener) fixes this. Use this extension to rename `.text` to `.tsv`, and the opener sends `.tsv` files straight into Google Sheets. It's a separate extension because, unlike this one, it reads the file and uploads it to the user's Google Drive.

## How rules work

Each rule has:

| Field | Example | Notes |
| --- | --- | --- |
| Domain | `example.com` | Matches `example.com` and any subdomain, such as `ps.example.com`. Case doesn't matter. If you paste a full URL, it's reduced to its hostname. |
| Change extension | `.text` | Case doesn't matter, and the leading dot is optional. |
| To extension | `.csv` | Must be different from the one it replaces. |
| Enabled | on/off | Turned-off rules are skipped. |
| Label | `PowerSchool Quick Export` | Optional description. |

For each download, the extension collects the host of the download's final URL (after redirects), its original URL, and the referring page:

- `blob:` URLs, which sites create in JavaScript, use the origin embedded in the URL. For example, `blob:https://ps.example.com/…` counts as `ps.example.com`.
- `data:` URLs have no host, so only the referring page is used.

Rules are checked in order and **the first enabled rule that matches wins**. Organization (managed) rules are always checked before personal rules. If no rule matches, the download is left alone. If a file with the new name already exists, Chrome adds a number (`student_export (1).csv`).

## Install

**From the Chrome Web Store:** [Download Re-Extensioner-o-Matic](https://chromewebstore.google.com/detail/download-re-extensioner-o/hfekcbakhgaklckochhdcpohfehbfdfh) (extension ID `hfekcbakhgaklckochhdcpohfehbfdfh`). Use this ID when force-installing it from the Google Admin console.

## Install unpacked (for development)

1. Download or clone this repository.
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the repository folder (the one that contains `manifest.json`).
5. Optional: pin the extension. Clicking its icon opens the settings page.

There's no build step. After editing a file, click the reload icon on the extension's card.

## Add a rule

1. Open the settings page: click the extension's icon, or go to `chrome://extensions` → **Details** → **Extension options**.
2. Under **Your rules**, choose **Add rule**.
3. Enter the domain the file downloads from, the extension to change, and the new extension.
4. Choose **Save rule**.

To check a rule without downloading anything, use **Test a download** at the bottom of the page. Enter a download URL and a filename, and it shows which rule matches and what the file would be called.

> **Which domain?** Use the host the download comes from, not necessarily your organization's main website. For PowerSchool, that's your PowerSchool server's hostname (for example `ps.example.org`, or `example.powerschool.com` if it's hosted). Entering the parent domain also covers every subdomain under it.

Personal rules are stored in `chrome.storage.sync`, so they follow you to any device where you're signed in to Chrome with sync turned on. Sync storage allows roughly 60 rules. The settings page will tell you if you reach the limit.

## Deploy to an organization (Google Admin console)

Admins can push rules to managed users and Chromebooks. The extension reads them from `chrome.storage.managed`, defined by [`managed_schema.json`](managed_schema.json).

| Policy key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `managedRules` | array of rules | `[]` | Organization rules. They appear read-only on the settings page, marked "Set by your organization", and are checked before personal rules. |
| `allowUserRules` | boolean | `true` | Set to `false` to ignore and hide personal rules, so only organization rules apply. |

Each item in `managedRules` has the same fields as a personal rule: `domain`, `sourceExtension`, `targetExtension`, and the optional `enabled` (default `true`) and `label`. Extensions may include or omit the leading dot. Invalid rules are ignored and shown as "Invalid, ignored" on the settings page.

**To apply:**

1. In the Admin console, go to **Devices → Chrome → Apps & extensions → Users & browsers**, and select the organizational unit.
2. Add the extension by ID and set it to **Force install** (or **Force install + pin**).
3. With the extension selected, paste the JSON below into **Policy for extensions** and save.

The Admin console expects each policy key to wrap its value in `{"Value": …}`:

```json
{
  "managedRules": {
    "Value": [
      {
        "domain": "prsd8.ca",
        "sourceExtension": "text",
        "targetExtension": "csv",
        "enabled": true,
        "label": "PowerSchool Quick Export"
      }
    ]
  },
  "allowUserRules": {
    "Value": true
  }
}
```

To confirm the policy reached a device, open `chrome://policy`, choose **Reload policies**, and look for the extension's ID. The settings page updates automatically when the policy changes.

## Known limitations

- **Conflicts with other download extensions.** Chrome lets only one extension decide a download's filename. If another installed extension also uses `chrome.downloads.onDeterminingFilename` (some download managers and file organizers do), Chrome uses the most recently installed one's suggestion, and this extension's rename may not apply. If renames stop working, check `chrome://extensions` for other download-related extensions.
- If Chrome is set to **Ask where to save each file**, the renamed filename is pre-filled in the Save dialog, and the user can still change it.
- Only the final extension is considered, so a rule can't target a compound extension like `.tar.gz`.

## Development

Requires Node.js 20 or later. There are no npm dependencies.

```bash
npm test
```

```bash
npm run package
```

```bash
npm run assets
```

- `npm test` runs the unit tests with Node's built-in test runner (`node --test`).
- `npm run package` writes `dist/download-re-extensioner-o-matic-<version>.zip` for Web Store upload. It includes only `manifest.json`, `managed_schema.json`, `LICENSE`, `src/` and `icons/`.
- `npm run assets` renders the icons (`icons/`) and the Web Store images (`store/`) with headless Chrome. The icon artwork is `tools/assets/icon.svg`, and the store images are HTML pages in `tools/assets/` that embed the real settings page with demo data. Run `npm run assets icons` or `npm run assets store` to render only one set. Set `CHROME_PATH` if Chrome isn't found.

When releasing, bump `version` in both `manifest.json` and `package.json`. The package script refuses to run if they don't match.

### Layout

```
manifest.json          MV3 manifest: "downloads" and "storage" permissions only
managed_schema.json    Schema for admin-deployed policy
src/background.js      Service worker: registers the download listener
src/settings.js        Reads and writes chrome.storage
src/lib/rules.js       Pure matching and renaming logic (no chrome.* calls)
src/lib/handler.js     onDeterminingFilename listener; always calls suggest() exactly once
src/options/           Settings page (HTML/CSS/JS, no external resources)
test/                  Unit tests (node --test)
scripts/package.js     Builds the Web Store zip
tools/                 Icon and store image renderer (headless Chrome)
store/                 Web Store screenshots and promo tile
```

### How the download listener works

The listener is registered at the top level of the service worker, so Chrome can wake the worker for a download. It returns `true` so it can respond asynchronously, loads rules from storage, and then calls `suggest()`. `suggest()` is called **exactly once** on every path: a match, no match, a storage error, or a 3-second timeout. A download can never be left waiting.

## License

[MIT](LICENSE)
