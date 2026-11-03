# Chrome Web Store Listing (draft)

## Name

Download Re-Extensioner-o-Matic

## Short description

_116 of 132 characters_

> Automatically change the file extension of downloads from sites you choose, such as turning .text exports into .csv.

## Full description

> Some websites save files with the wrong extension. A spreadsheet export arrives as ".text", or a report comes down as ".dat", and it won't open in the right app until you rename it by hand, every time.
>
> Download Re-Extensioner-o-Matic fixes that automatically. Tell it which site and which extension to change, and every matching download gets the right extension as it saves.
>
> HOW IT WORKS
> • Create a rule: a domain (like example.com), the extension to replace (like .text), and the new extension (like .csv).
> • A rule for example.com also covers its subdomains, such as reports.example.com.
> • Only the final extension changes: "grades.2026.09.text" becomes "grades.2026.09.csv".
> • Turn rules on and off, add labels, and edit them at any time.
> • "Test a download" shows which rule would apply to a URL and filename, without downloading anything.
> • Your rules sync to your other devices through Chrome sync.
>
> BUILT FOR SCHOOLS AND ORGANIZATIONS
> • Administrators can deploy rules through the Google Admin console or other Chrome policy tools. Organization rules appear read-only and are checked before personal rules.
> • Administrators can turn off personal rules entirely.
> • Works on Chromebooks and in Chrome on Windows, macOS and Linux.
>
> PRIVATE BY DESIGN
> • Never opens or reads the contents of your files.
> • Collects nothing, tracks nothing, and makes no network requests.
> • Uses only two permissions: "downloads" and "storage". No access to the websites you visit.
>
> Note: Chrome lets only one extension choose a download's filename. If another installed extension also renames downloads, the two may conflict.

## Category

Tools (Productivity)

## Single purpose

> Download Re-Extensioner-o-Matic has a single purpose: to change the file extension of downloaded files according to rules set by the user or their organization. Each rule is a domain, the extension to replace, and the new extension. The options page exists only to manage and test these rules.

## Permission justifications

### `downloads`

> Required to do the extension's single purpose. The extension listens to chrome.downloads.onDeterminingFilename to see each download's URL, referrer, and proposed filename, and, when a rule matches, suggests the same filename with a different extension. This information is used only in memory to evaluate rules. It is never stored or transmitted, and file contents are never read.

### `storage`

> Used to save the user's rename rules with chrome.storage.sync, so they persist and follow the user across their signed-in browsers, and to read rules an organization deploys through Chrome policy (chrome.storage.managed, defined by the extension's managed_schema.json). Only the rules are stored. No browsing data, filenames, URLs, or download history is ever saved.

### Host permissions

> None requested.

### Remote code

> No, the extension does not use remote code. All JavaScript is packaged with the extension; there are no external scripts, eval, or network requests.

## Data usage disclosures (Privacy practices tab)

- **Data collected:** none. Leave every data category unchecked.
- **Certifications:** check all three:
  - I do not sell or transfer user data to third parties, outside of the approved use cases.
  - I do not use or transfer user data for purposes unrelated to my item's single purpose.
  - I do not use or transfer user data to determine creditworthiness or for lending purposes.
- **Privacy policy URL:** must be publicly reachable. The GitHub repo is private, so either host `PRIVACY.md` on the division website or make the repo public and link to the file.

## Images

All in `store/`, rendered by `npm run assets`. Screenshots are 1280×800 PNGs without transparency, as the Web Store requires.

| File | Upload as | Shows |
| --- | --- | --- |
| `icons/icon128.png` | Store icon | 96×96 artwork with 16px padding, per Web Store guidelines |
| `store/screenshot-1-overview.png` | Screenshot 1 | `student_export.text` becoming `student_export.csv` |
| `store/screenshot-2-rules.png` | Screenshot 2 | Settings page with organization and personal rules |
| `store/screenshot-3-test.png` | Screenshot 3 | "Test a download" with a match |
| `store/screenshot-4-admin.png` | Screenshot 4 | Admin console policy JSON next to what staff see |
| `store/promo-small-440x280.png` | Small promo tile | Name, tagline, and `.text → .csv` |

The screenshots use example domains (`example.org`, `example.com`, `example.net`), not real division hosts.

## Still to do

- [ ] Host the privacy policy at a public URL
- [ ] If the repo is made public, consider adding "Open source under the MIT license" to the full description
