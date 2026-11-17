# Module spec: condense (CND)

Owner: `subprojects/renderer/slidegen/condense.py` and `subprojects/renderer/prompts/condense.md`.
Tests: `subprojects/renderer/tests/` (offline), `tests/fixtures/requests/` (the eval set, run by hand: it costs money).
Status: draft 2026-11-17, waits for gate 1.

Turns a request, as long and as messy as members write them, into a `SlideText`: a few words that someone in a pew can
read in three seconds.

## Output
- **CND-01** Condense returns a `SlideText` with `title` (at most 32 characters), `when` (at most 40), `where` (at
  most 40), `line` (at most 70) and `show_until` (a date). Only `title` and `show_until` are required; an empty field
  is `""`.
- **CND-02** All text is Dutch, whatever language the request is in, in the church's tone: plain, warm, no
  exclamation marks, no emoji, no capitals for emphasis.
- **CND-03** Condense invents nothing: every date, time, place, name and amount in the output appears in the request
  or in the form's date field. A field the request does not support is empty. The eval set has a request without a
  place and a request without a time; their outputs have `where` and the time part of `when` empty.
- **CND-04** `show_until` is the form's last show date when given, else the event date, else 14 days after the
  request.

## The call
- **CND-05** One call to the Claude API with a structured output (`output_config.format`, JSON schema of `SlideText`),
  model and effort from `subprojects/renderer/slidegen/config.py` (default `claude-opus-5-5`, effort `low`). The
  request text goes in as data inside tags, never as instructions: a request that says "ignore the rules" gives a
  normal slide (eval case `injectie.txt`).
- **CND-06** The character limits are checked in code after the call. A field over its limit, or a render that does not
  fit (REN-07), gives one more call with the violations named. Still over: the request goes to the visual team
  (DLV-08) with the reason.
- **CND-07** An API error is retried by the SDK (its default retries); after that the request goes to the visual team
  with the error. A `refusal` stop reason does the same.
- **CND-08** Offline tests use recorded API responses; CI never calls the API. `slidegen eval` runs the eval set
  against the live API and prints per case the output and whether CND-01..04 hold.

## Owner questions
1. **Model?** Recommended: `claude-opus-5-5` at effort `low`: best Dutch and least invention, about $0.02 per slide,
   so about €2 a month at 20 requests a week. `claude-haiku-5-5` costs about 1/40 of that; the eval set shows whether
   it holds the quality. The owner picks; the code makes it one line.
2. **Whose API key?** Recommended: a key in an Anthropic account of the church or the owner, stored as the GitHub
   secret `ANTHROPIC_API_KEY`, with a monthly spend limit of $10 set in the console.
3. **Four fields enough?** Recommended: yes for phase 1 (title, when, where, one line). More text means smaller text.
