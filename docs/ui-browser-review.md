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
