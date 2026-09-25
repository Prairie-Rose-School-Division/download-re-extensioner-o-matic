# Privacy Policy — Download Re-Extensioner-o-Matic

_Effective date: September 25, 2026_

Download Re-Extensioner-o-Matic ("the extension") changes the file extension of downloads based on rules you set. This policy explains what the extension does with information.

## Summary

**The extension does not collect, store, sell, share, or transmit any personal information or user data.** It makes no network requests of any kind.

## What the extension accesses, and why

When a download starts, Chrome gives the extension the download's URL, final URL, referring page URL, and proposed filename. The extension uses these **only in memory, on your device**, to decide whether one of your rules applies and, if one does, to suggest the new filename to Chrome. It does not keep this information after the decision, and does not log, store, or send it anywhere.

The extension **never opens or reads the contents of downloaded files.** Downloads often contain sensitive information, such as student records. The extension works only with the filename and the web address the file came from.

## What the extension stores

- **Your rules** (domain, extensions, on/off setting, optional label) are saved with Chrome's `storage.sync` API. If Chrome sync is on, Google syncs them between your signed-in browsers under your Google account, the same way it syncs other Chrome settings. The extension's developer can't access them.
- **Organization rules**, if your administrator sets any, are delivered by your organization's device or browser management and read with Chrome's `storage.managed` API. The extension only reads them.

The extension stores no download history, filenames, URLs, or usage data.

## What the extension does not do

- No analytics, telemetry, crash reporting, or tracking.
- No advertising.
- No network requests, and no remote code: everything the extension runs ships inside it.
- No access to web page content: the extension has no content scripts and no host permissions.
- No sale or transfer of data to third parties, for any purpose.

## Permissions

- **`downloads`**: to see a download's URL and proposed filename, and to suggest a new filename.
- **`storage`**: to save your rules and read rules set by your organization.

## For schools and organizations

The extension doesn't collect or disclose personal information, so it doesn't add to what an organization must account for under privacy law, such as Alberta's *Protection of Privacy Act* (POPA). Organizations are still responsible for how they handle the downloaded files themselves.

## Changes

If this policy changes, the updated version will be published at this address with a new effective date. Any change that would allow data collection would require a new version of the extension, and would be clearly disclosed first.

## Contact

Questions about this policy: [iancooper@prrd8.ca](mailto:iancooper@prrd8.ca), Prairie Rose Public Schools, Alberta, Canada.
