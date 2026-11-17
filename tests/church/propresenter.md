# Church checklist: ProPresenter loop (gate 3)

Only the owner ticks this, at the church. Covers DLV-10, DLV-11 and REN-03 on the real screens (VS3-01).
Make a run file `tests/church/runs/<date>-VS3-01.md` with the ticked list and `## Open points`.

## Setup (once)
- [ ] Google Drive for Desktop on the church Mac, signed in to the visual team's account; `KerkSlideGen/Loop` set to
      *Mirror files* (available offline).
- [ ] ProPresenter 7: Media Bin → new Smart Playlist linked to the mirrored `Loop` folder.
- [ ] The announcement loop uses that playlist: 8 s per slide, loops, fills the full triple-wide output.

## Checks
- [ ] A test PNG dropped in `Loop/` from another computer appears in the playlist within 5 minutes, without a click.
- [ ] Removing it from `Loop/` removes it from the playlist without a click.
- [ ] With the network unplugged, the loop keeps playing what was synced.
- [ ] On the beamers: the background spans all three screens without stretching; the text sits on the centre screen.
- [ ] On the livestream output: no text is cut off or under the stream's overlay (`--guides` render as reference).
- [ ] The text reads from the back row.
