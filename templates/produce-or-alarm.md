# Produce or Alarm

**Prevents:** a gated run writing zero bytes, making it byte-identical to a routine
that is dead. That ambiguity costs whole outage windows that can never be reconstructed.

The instruction *"if the gate is closed, output SKIPPED and stop"* reads as safe and is
not. A run that writes nothing leaves the same trace as a run that never dispatched:
none. You cannot tell them apart later, and later is when you need to.

## The rule

**Every run writes output. Without exception. A gated stop is still a run.**

Two artifacts, always:

1. one line appended to the heartbeat file (see `heartbeat-guard.md`);
2. the run's top line, at its declared output path.

## The top line

Three lines, nothing above them. Written for someone who has read nothing else today.

```markdown
**GOT:** <the usable thing this run produced — or `nothing`, plus one clause why>
**DO:** <one action startable in under a minute — or `nothing`>
**SO WHAT:** <one clause: what it changes, or what it cost that nobody did it>
```

`GOT: nothing` is honest and expected. **Do not pad it.** A run that produced nothing
writes three lines and stops — no summary, no findings table, no gate narration.

## The alarm branch

When the run cannot do its job — a missing input, an expired credential, an unreachable
source — it does not fail silently and it does not pretend to succeed. It writes:

```markdown
**GOT:** nothing — ALARM: <the one blocking condition, named>
**DO:** <the single action that unblocks it>
**SO WHAT:** <what stays broken until then>
```

An alarm is a produced output. It satisfies this rule. A crash does not.

## The meta cap

Cap writing about the routine's own machinery at **15% of the output, below the fold**.
If a report is mostly about the run's internal state, the run had nothing to report and
should have written three lines. Routines explaining themselves to each other is the
failure this cap exists to catch.

## Test it

Force the gate closed and run it. If the output path's file does not change and the
heartbeat has no new line, the routine is capable of dying invisibly. Fix that before
scheduling it.
