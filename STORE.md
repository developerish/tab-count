# Chrome Web Store release

Update the existing item **cfokcacdaonnckdmopmcgeanhkebeaio** rather than creating a new extension. This retains its identity and upgrade path.

## Build and upload

1. Run `npm run package` (Node 22 or later, plus `zip`). Upload `dist/tab-count-3.0.0.zip` using **Package → Upload new package** in the Chrome Web Store developer dashboard.
2. Check that version 3.0.0 is newer than every previously uploaded package. If necessary, increment both `manifest.json` and `package.json`, then regenerate the ZIP.
3. Update the store listing and privacy practices using the accurate, source-backed text below. Replace legacy screenshots with `store-assets/popup.jpg` (640×400) and `store-assets/settings.jpg` (1280×800), captured from the packaged extension in a clean Chrome for Testing profile. Both show disposable tabs. Keep the existing icon and promo tile.
4. Resolve any dashboard violations, account verification, contact-email, two-step verification, or developer/trader declarations. The account owner must supply personal or business identity facts and accept new legal terms.
5. Submit the existing item for review with public distribution and automatic publication after approval. Upload acceptance and review submission do not mean the item is live; verify the dashboard and public listing separately.

## Listing description

Tab Count shows how many tabs you have open and gives you a compact list for switching to or closing them.

- Choose whether the toolbar badge counts the current window or all windows.
- List tabs from the current window or all windows.
- Switch to a tab or close it from the popup.
- Optionally get notified when you open a page that is already open.
- Optionally close tabs unused for 1–30 days, with an hourly check. Active, pinned, playing, loading, incognito, and browser-internal tabs are kept.

Your tab information stays in your browser. No accounts, analytics, advertising, tracking, remote code, or data transmission. Duplicate detection and automatic closing are off by default. Automatic closing can lose unsaved work in otherwise eligible tabs.

Requires Chrome 121 or later.

## Single purpose

Count and manage open browser tabs, including listing, switching, closing, and optional duplicate and unused-tab management.

## Permission justifications

- **tabs:** Read open-tab titles and URLs for the tab list and exact duplicate detection. Read tab state and last-accessed timestamps to protect active, pinned, playing, and loading tabs during opt-in unused-tab closing. No page content or browsing-history access.
- **storage:** Save preferences locally and keep pending duplicate-notification actions in session storage so actions work after the Manifest V3 service worker stops. No sync or remote storage.
- **alarms:** Run the optional unused-tab check hourly using a wakeable Chrome alarm instead of a background timer.
- **notifications:** Show the optional duplicate-tab prompt. No page titles or URLs appear in notification text. Clicking switches to the existing tab and closes the unchanged duplicate; dismissing keeps both.
- **Host permissions:** None.
- **Remote code:** No. All executable code is bundled in the extension.

## Privacy policy URL

https://github.com/developerish/tab-count/blob/master/PRIVACY.md

Verify this URL is publicly accessible after pushing the release. The bundled `privacy.html` is the same policy for offline access from settings.

## Data-use disclosures

Disclose **Web history** to cover open-tab URLs/titles processed locally; the extension does not read the Chrome History database. Google requires disclosure of local-only data handling too. Other data categories are not used. No user data is transmitted, sold, or transferred to third parties. Confirm the limited-use statements only after verifying they remain true for the uploaded package.

## Reviewer test instructions

1. Load the extension with several disposable tabs in two normal Chrome windows. The badge initially shows the total count; the popup initially lists the current window.
2. Open Settings. Change the popup and badge scope. Both changes apply without reloading the extension. Switch windows and move a tab between them to verify the current-window count.
3. Use keyboard navigation to switch to a tab and close a disposable tab. Titles containing HTML markup must appear as literal text.
4. Enable duplicate notifications and open the same HTTP(S) URL twice. Clicking the notification or its first button switches to the existing tab and closes the duplicate. Dismiss it or choose Keep both to retain both. Three or more matching tabs are supported. OS notification settings can suppress visual prompts.
5. Close or navigate one tab before acting on a duplicate prompt: the other tab must be retained. Stop the service worker before clicking a still-pending prompt: the action must still work.
6. Enable unused-tab closing and inspect the `tabJanitor` hourly alarm. Disable it and confirm the alarm is removed. Run `npm test` for controlled stale-tab, navigation, and worker-restart cases without risking real work.

## Release notes: 3.0.0

Completed the Manifest V3 migration with reliable service-worker events, hourly alarms, safe duplicate actions, validated settings, keyboard-accessible tab controls, safe text rendering, and a local-only privacy policy. Uses Chrome's built-in tab last-accessed times instead of maintaining an activity-history database. Protects active, pinned, playing, loading, incognito, and browser-internal tabs from automatic closing.

## Release verification

- `npm run package`: 13 behavioral/package tests and syntax checks pass; upload archive contains only extension assets.
- Chrome for Testing 149: package loads without extension errors; current/all-window badge and list, switching across windows, closing a disposable tab, immediate preference changes, persisted settings, and invalid-day validation checked in the actual extension.
- Settings layout checked at 320 pixels, screenshots captured at store sizes, and extension-page console showed no messages. This is a desktop Chrome extension; Chrome on phones does not load it.
- Worker restart, pending notification actions, stale-tab safeguards, and legacy migration have deterministic regression coverage. OS notification presentation and action buttons vary by platform and remain subject to the user's notification settings.
