# PRD — phase 1: request in, approved slide in the loop

Status: draft, written 2026-11-17 from the owner's brief ("volledig automatiseren", "makkelijk voor iedereen").
Waits for gate 1: the owner approves this PRD and the module specs it names by merging their PR, or says what changes.

## Problem
Members ask for announcement slides with long texts. One volunteer turns each into a slide by hand, deciding which few
words fit, placing them inside the safe area of the centre screen of a triple-wide projection that also feeds the
livestream. That volunteer is the bottleneck, and the choice of words is work nobody wants to do.

## Outcome
- A requester fills in one form with their text and the event date. Within 5 minutes they have a slide in their mail.
- They approve it with one click, or type what should change and get a new one.
- An approved slide is in ProPresenter's announcement loop before the next service without anyone touching it, and
  out of it the day after its last date.
- The visual team only hears about requests that failed or that come from unknown senders.

## Modules and their criteria
| Module | Spec | Ids |
| --- | --- | --- |
| Intake: the form and the dispatch | `specs/modules/intake.md` | INT |
| Condense: long text to slide text | `specs/modules/condense.md` | CND |
| Render: slide text to PNG | `specs/modules/render.md` | REN |
| Deliver: mail, approval, folders, expiry | `specs/modules/deliver.md` | DLV |
| Tracking: the handoff stays true | `specs/modules/tracking.md` | TRK |
| Autoreview: review and risk gate on PRs | `specs/modules/autoreview.md` | ARV |

## Done for phase 1
The first real request from a member goes from the form to the loop at the church without the visual team touching
it, and a slide of last week has left the loop by itself (VS3-02, gate 3).

## Not in phase 1
See `PROJECT.md` (Out of scope) and `IDEAS.md`.
