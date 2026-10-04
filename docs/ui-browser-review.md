# User interface browser review

The regular frontend was reviewed in Chromium against the configured development backend using the requested test student. Public pages, account pages and all five onboarding steps were captured at 1440px and 390px, with client-loaded records allowed to settle before screenshots. The review covered empty and unavailable-record states without adding financial records to the real database.

Populated details are reviewed against the existing isolated HTTP integration fixture. Its normal journeys create provider profiles, services, requests, quotes, jobs, conversations, payments and disputes in memory. The optional browser review visits their actual frontend pages, checks page errors, overflow and visible request failures, and exercises mobile navigation. It does not send real messages, email, transfers or refunds.

After building the frontend and installing Playwright Chromium, run from `konet-frontend`:

```sh
npm run test:ui
npm run test:admin
```

The first command saves screenshots, a browsable `index.html` gallery and its JSON report in `/tmp/konet-user-ui`. The second includes public/authentication and discovery layouts at 1440px, 1024px, 768px and 390px, in addition to the admin regression checks. These checks are complementary: passing overflow checks alone is not a design review.

The UI fixes restore readable workspace headings, active mobile navigation, an accessible menu on narrower headers, explicit empty states, profile spacing, styled registration selectors and compact onboarding steps. Provider navigation shows all six sections on smaller screens. User-facing date helpers use an explicit locale and Lagos timezone to keep server and client formatting consistent. The realtime provider now retains the same child component tree while connecting, rather than remounting forms when the account query finishes. Its account query starts with the server-rendered user, preventing account data from changing the verification page before hydration completes.

Desktop navigation is text-only and centered between equal left and right columns. Browser checks measure its center and separation from the logo/account actions at 1152px, 1280px, 1440px and 1920px. Account and mobile dropdowns have grouped links, active states, and dismissal by Escape, outside click, and navigation. Application lists, conversations, profiles and provider workspaces use the desktop viewport with consistent 48px side gutters; reading and transaction forms retain a narrower width. The mobile page layout stays unchanged.

Expired credentials must not redirect the public homepage into recovery. HTTP checks cover public access, missing/invalid refresh credentials, and origin-protected session cleanup. Browser checks cover recovery failures from both rejected credentials and unavailable refresh services: cleanup removes session cookies and the development token, then opens the sign-in form. Background network failures do not log out an otherwise valid session. Development browser requests still use the local-storage bearer token; production does not expose or persist tokens in browser storage.

If Playwright's downloaded Chromium is unavailable, `test:ui` accepts an installed Chrome executable through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Additional header/dropdown screenshots are saved beside the page gallery.

The public landing page treats provider, university and public-header backend outages as unavailable optional content. It retains its static sections, labels temporary failures separately from an empty marketplace, and retries server data through a refresh button. Integration checks simulate each directory outage and a combined directory/account outage; browser checks cover desktop/mobile fallback rendering and recovery after clicking retry. Other backend errors still propagate normally.
