# Elapsed-Time Gate

**Prevents:** a cadence gate that can never fire, and a missed slot destroying a whole
cycle instead of delaying it.

## The failure

A routine meant to run three times a week is gated like this:

```
if today is not Monday, Wednesday, or Friday: exit
```

The scheduler then misses Monday — the host was asleep, the dispatcher was backed up —
and fires the catch-up on Tuesday. The gate says Tuesday, exits, and produces nothing.
Wednesday's slot is also missed; the catch-up lands Thursday; the gate exits again.
**The routine is now structurally incapable of running, and it reports success every
time.** No error is ever raised, because exiting on a closed gate is the intended path.

Weekday gates and catch-up dispatch are incompatible. Any scheduler that can defer a
run — Windows Task Scheduler `StartWhenAvailable`, anacron, a cloud runner with a
backlog — will eventually invert the order.

## The rule

**Gate on elapsed time since the last real output. Never on a calendar name.**

```bash
MIN_HOURS=44                      # 3x/week ≈ every 48h, minus a 4h slack window
LAST=$(date -r "$LAST_ARTIFACT" +%s 2>/dev/null || echo 0)
ELAPSED_H=$(( ($(date +%s) - LAST) / 3600 ))
[ "$ELAPSED_H" -lt "$MIN_HOURS" ] && { write_heartbeat "gated: ${ELAPSED_H}h elapsed"; exit 0; }
```

Set the interval slightly **below** the nominal cadence. A 48-hour gate on a 48-hour
schedule drifts closed: the run that fires four minutes late pushes the next one a full
cycle. Slack absorbs jitter.

## Measure elapsed from the ARTIFACT, not from the scheduler

`lastRunAt`, `LastRunTime`, and every field the scheduler maintains prove **dispatch**,
not **work**. A routine that dispatched and died still stamps them. Read the mtime of
the newest real output instead — the file a human would open. Then a run that produced
nothing correctly reads as "no work has happened", and the next run does the work.

## Catch-up behaviour

A missed slot should **delay** work, never destroy a cycle. With an elapsed-time gate
this is automatic: the late run sees a long elapsed time, opens the gate, and runs. No
catch-up logic is needed, and none should be written.
