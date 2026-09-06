# Heartbeat Guard

**Prevents:** two runs fusing onto one physical line, so the only file that can tell
"gated correctly" apart from "never fired" quietly stops being readable.

A heartbeat file is append-only evidence that a run *started*. It is the last thing
left when everything else fails. Two rules make it trustworthy.

## Rule 1 — write it FIRST, before reading anything else

Not after the work. Not at the end. First. A run that dies while loading its config
must still leave a line proving it fired. If the heartbeat is written last, every
mid-run death looks identical to a run that never dispatched.

## Rule 2 — guard the newline before every append

Most append helpers do not add a trailing newline, and most log lines do not end with
one. Two appends then land on one line. The file still grows, so nothing looks broken;
the line count silently stops matching the run count.

```bash
HB="$STATE_DIR/_heartbeat.md"
[ -n "$(tail -c 1 "$HB")" ] && printf '\n' >> "$HB"
printf '%s | %s | %s | produced=%s | %s\n' \
  "$(date +%Y-%m-%dT%H:%M:%S%z)" "$ROUTINE" "$RUN_TYPE" "$PRODUCED" "$NOTE" >> "$HB"
```

```powershell
$hb = Join-Path $StateDir '_heartbeat.md'
if ((Get-Content $hb -Raw -ErrorAction SilentlyContinue) -notmatch "`n$") {
    Add-Content $hb ''
}
Add-Content $hb ("{0} | {1} | {2} | produced={3} | {4}" -f `
    (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'), $Routine, $RunType, $Produced, $Note)
```

## Format

One line, fixed columns, machine-greppable:

```
<ISO local timestamp> | <ROUTINE> | <RUN_TYPE> | produced=<yes|no> | <=12-word note
```

`produced=` is rewritten truthfully at the end of the run. The timestamp is never
rewritten.

## Non-negotiables

- **Append-only.** Never rewritten, never rotated, never cleaned. Rotation destroys
  exactly the gap you need to see.
- **Local timestamps with an offset.** A fleet split across UTC and local time cannot
  be read as one sequence.
- **A gated stop still writes a line.** "Skipped" is a run. Silence is not.

## How to read it

Gaps are the signal. Sort the file and look for a date jump. A fleet-wide jump across
several routines on the same days is an infrastructure outage, not a bug in any one
routine — and it is invisible without this file.
