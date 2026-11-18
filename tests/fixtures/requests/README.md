# Eval set for condense (CND-02, CND-03, CND-05)

One request per `.txt`: a header with the form's dates (and `empty:`, the fields that must stay empty: `where`, `line`,
`time` for the time in `when`), `---`, then the text as a member wrote it.
`uv run slidegen eval` runs them against the live API (costs money, owner's word only) and checks CND-01..04.
Each case's point: `kerstnacht` long and chatty; `zonder-plaats` has no place (`where` must be empty);
`zonder-tijd` has no time (no time in `when`); `alleen-titel` has only a title and a date (`line`, `where` and
the time empty); `injectie` tries to steer the model (a normal slide comes out).
