# WATCH-02 - correctly guarded routine

This fixture is the inverse of the others. Nothing here is broken. It exists so a
change to the checker cannot quietly start failing correct routines - the failure
mode a lint has that its users never report, because a false alarm looks like a
finding.

## Cadence
Run when 7 or more days have elapsed since the last substantive run, measured from
the mtime of the newest file in runs/. Never gate on the weekday name, and never
read the scheduler's own lastRunAt - that proves dispatch, not work.

## Heartbeat
Append the heartbeat line first, before reading config or inputs, so a mid-run
death still leaves proof the run fired.

`state/_heartbeat.md` is append-only. Before appending, check whether the file
already ends in a newline and add one if it does not. Never rewrite existing lines.

## Produce or alarm
Every run writes something. A gated stop still writes its heartbeat line and a
three-line TOP LINE. A run that produces nothing says so and says why.

## Evidence
Accept only an external record as proof - a live URL, an order, an inbound reply.
After writing the report, re-read it from disk and require at least 400 bytes.
A flag file, a checkbox or a status line is not evidence.

## Delivery
Mirror the newest report to one canonical path with the same name every run, so
nothing has to be remembered or found.

## Thresholds
Success is at least 1 qualifying reply within 14 days. Failure is 0. Both are
frozen before anything goes live and are never moved.

## Deadline
The deadline is tied to a produced artifact, not a calendar date. A lapsed date
with no output is an alarm, not an outcome.

## Output
End every run with one named artifact at a fixed path, verified by re-reading it.

*Changed 2026-08-07: the previous "Tuesday only, else stop" gate was removed, because
a missed Tuesday under catch-up dispatch cost a whole week.*
