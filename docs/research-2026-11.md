# Research: automating announcement slides (2026-11-17)

Desk research by a Claude subagent on 2026-11-17. Sources are linked; claims marked *unverified* were not confirmed for
late 2026. The decision that follows from it is ADR-001.

## Intake
- **Google Forms + Apps Script:** an `onFormSubmit` trigger is free and standard. A file-upload question forces
  respondents to sign in with a Google account ([Google Help](https://support.google.com/docs/answer/7322334)), so
  phase 1 has no upload.
- **Microsoft Forms + Power Automate:** uploads only for people inside the organisation's tenant (forum answers).
- **Tally:** no login, free webhooks and 10 MB uploads ([Tally](https://tally.so/help/file-uploads)); needs an
  endpoint to receive the webhook. Payload format for files *unverified*.
- **Mail / WhatsApp:** most familiar, messiest to parse; WhatsApp needs a Meta business account. Later (IDEA-02).

## Condensing
- Claude structured outputs (`output_config.format`) guarantee schema-valid JSON, but `maxLength` is not enforced by
  the API: the SDK checks it client-side ([docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).
  Hence: budgets in the prompt and schema, a check in code, one retry, then shrink-to-fit, then a human (CND-06).
- Cost at 20 requests a week: well under €1 a month on Haiku 5.5, about €2 on Opus 5.5 at low effort.

## Rendering
- **HTML/CSS → PNG with Playwright/Chromium:** real fonts, Dutch hyphenation, shrink-to-fit in a few lines of JS,
  safe area as padding. Free on GitHub Actions.
- **Satori/resvg, Typst, Pillow:** lighter, but fitting text needs extra packages or own code.
- **Canva Connect autofill:** the API reference now names Pro/Teams/Nonprofit plans, older pages say Enterprise only;
  limits "introduced in the future" ([ref](https://www.canva.dev/docs/connect/api-reference/autofills/create-design-autofill-job/)). *Unverified*.
- **Placid / Bannerbear / Templated / APITemplate:** €20–50 a month, lock-in (aggregator prices).
- **Google Slides API:** `getThumbnail` LARGE is 1600 px wide, not 1920
  ([ref](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/getThumbnail)).

## ProPresenter 7
- The public API (since 7.9) can create and fill playlists but cannot import media.
- A **Smart Playlist** links a Media Bin playlist to a folder and reflects what is in it
  ([Renewed Vision](https://support.renewedvision.com/hc/en-us/articles/54346597579027-What-Is-A-Smart-Playlist)).
  Refresh speed and timed looping of images *unverified*: VS3-01 tests it at the church.
- Generating `.pro` files is possible via reverse-engineered protobufs, fragile across versions.
- Common practice: an "Announcements" presentation with a ~10 s auto-advance timer, looping.

## Orchestration
- GitHub Actions (`repository_dispatch`, cron): free on public repos, an allowance on private ones (2026 pricing
  changes, sources conflict). ~20 runs of a minute a week is negligible.
- Apps Script: free glue for form, Drive, Sheet and mail. n8n Cloud ~€20/month; Make free tier 1000 credits.

## Off-the-shelf
Nothing found that does request → condensed text → custom triple-wide template → ProPresenter. Planning Center and
church tutorials still end in a manual import; AI deck generators ignore a fixed template and safe area.
