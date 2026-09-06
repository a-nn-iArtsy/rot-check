# Dead-Man Alarm

**Prevents:** a routine that stops firing entirely and is missed for days, because the
only thing checking whether it ran was the routine itself.

Every check inside a routine shares its fate. If the process never starts — expired
credential, disabled task, host never woke, scheduler silently dropped it — none of its
internal checks run either. **A routine cannot report its own absence.**

The alarm must therefore live somewhere the monitored routine does not control, and it
must trigger on the *absence* of evidence rather than the presence of an error.

## The rule

**One separate watcher reads every routine's heartbeat and alarms on N consecutive
missed windows.** Nothing else in the fleet has that job.

```bash
# watcher.sh - its own scheduled task, running more often than anything it watches
MAX_SILENCE_H=30                      # daily routine: one miss plus slack
for hb in "$FLEET_DIR"/*/_heartbeat.md; do
  routine=$(basename "$(dirname "$hb")")
  last=$(date -r "$hb" +%s 2>/dev/null || echo 0)
  silent_h=$(( ($(date +%s) - last) / 3600 ))
  if [ "$silent_h" -ge "$MAX_SILENCE_H" ]; then
    notify "ROT: $routine silent ${silent_h}h (limit ${MAX_SILENCE_H}h)"
  fi
done
```

Set `MAX_SILENCE_H` per routine from its own cadence: one missed window plus slack. Too
tight and the alarm cries wolf until it is ignored, which is the same as no alarm.

## Where the alarm has to land

Somewhere seen without being sought: a phone push, an SMS, a desktop notification, a
pinned file opened at the start of every day. **Never a log file, never a dashboard
nobody opens, never an email folder.** An alarm that depends on remembering to look for
it is not an alarm.

## The watcher watches itself

The watcher can die too, and its death is silent by the same argument. Two cheap
options, pick one:

- **External heartbeat service.** The watcher pings a URL each run; the service alarms
  when the ping stops. Free tiers are sufficient. This is the one piece worth
  outsourcing, because it is the only piece that cannot host its own liveness proof.
- **Mutual watch.** Two watchers on different schedules check each other's heartbeat.
  Cheaper, but a host-wide outage takes out both.

## Test it

Disable a routine and wait past its window. If nothing reaches you where you actually
look, the alarm does not exist yet, whatever is configured.
