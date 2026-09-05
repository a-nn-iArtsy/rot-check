# Rot Check

**Find the scheduled agent that quietly stopped working.**

Your job says it ran. Nothing checked whether it *did* anything.

That is the whole category this covers. Not crashes — crashes are loud and you already
handle those. This is the routine that fires on time, exits clean, writes a timestamp,
and has been doing nothing for nine days.

**[Try it in your browser →](https://a-nn-iartsy.github.io/rot-check/)** · no install, no
account, no upload. Paste a cron line, a Task Scheduler XML export, a systemd unit, an
agent prompt, or the script your scheduler calls.

Everything runs locally in the page. Nothing is sent anywhere — open DevTools and watch
the network tab if you want to check, which you should.

---

## The 14 ways an unattended routine dies quietly

These are not hypothetical. Every one is drawn from a real seven-routine fleet that
stopped for three days while every heartbeat file recorded success.

### Liveness — can you tell a dead routine from a quiet one?

**1 · Weekday gate**
Cadence is decided by a weekday name. Under catch-up dispatch a missed Monday fires on
Tuesday, the gate closes, and the routine becomes *structurally unable to run* while
reporting success every time.

**2 · lastRunAt gate**
Cadence reads a field the scheduler writes. That proves the run was **dispatched**, not
that it did any work — a run that started and died still stamps it.

**3 · Heartbeat written last**
The heartbeat is written after the work. A run that dies mid-work leaves no trace it ever
fired, so a mid-run death is indistinguishable from a run that never dispatched.

**4 · Unguarded heartbeat append**
An append with no trailing-newline guard. Two runs fuse onto one physical line, the file
keeps growing so nothing looks broken, and the line count silently stops matching the run
count — in an append-only log whose entire purpose is being parseable line by line.

**9 · No dead-man alarm**
Nothing notices N consecutive missed runs. **A routine cannot report its own absence** —
if the process never starts, none of its internal checks run either.

**10 · Host-asleep dispatch**
Plain `cron` drops jobs missed while the host was asleep. No run, no error, no record. On
a machine that sleeps you need anacron semantics, a `@reboot` catch-up, or
`StartWhenAvailable`.

### Evidence — is the proof of work real, or the routine's own opinion?

**5 · No produce-or-alarm**
A gated run can exit without writing anything. **Zero bytes written is byte-identical to a
routine that is dead**, and the outage window can never be reconstructed afterwards.

**6 · Self-report as proof**
A flag file, checkbox or status line is treated as evidence. The thing being guarded
against is the routine being wrong about itself — so its own report is the weakest
evidence available.

**7 · No byte-size or re-read check**
Nothing re-reads the output or checks its size. Write buffering, a full disk, a permission
failure and a path typo all produce a confident success and no usable file.

**12 · Output written where nobody reads**
Output lands somewhere nobody opens. Delivery works once; re-delivery never happens and the
surface goes stale without anyone noticing.

### Continuity — what happens across days, tokens and deadlines?

**8 · Headless auth expiry unhandled**
A headless invocation with no auth-validity check. An expired token kills **every**
scheduled routine at once, and each one fails the same silent way on the same morning.

**11 · Date-gated deadline**
A deadline that lapses on a calendar date rather than on delivery. If nothing was produced,
silence gets scored as a decision and the lapse looks like a result.

**13 · Threshold not frozen before going live**
The success bar is decided after the results are in. **A test whose threshold moves is not
a test.**

**14 · No single shippable unit**
The declared output is a report *about* work rather than the work. Routines that produce
instruments instead of outputs accumulate documents and never a deliverable.

---

## First — get your routine out

The most common reason people bounce off a linter is having nothing to paste.

**Windows Task Scheduler**
```powershell
Get-ScheduledTask | Where-Object {$_.TaskPath -notlike "\Microsoft*"} |
  Select-Object TaskName,TaskPath

schtasks /query /TN "\YourTaskName" /XML
```
Copy straight from the console, or add `> task.xml`. The file is UTF-16 — normal, pastes fine.

**cron — Linux, macOS, WSL**
```bash
crontab -l
cat /etc/crontab
ls -la /etc/cron.d/
```

**systemd timers**
```bash
systemctl list-timers --all
systemctl cat NAME.timer NAME.service
```
Paste both units together — `Persistent=true` is the catch-up setting this looks for.

**launchd — macOS**
```bash
launchctl list | grep -v com.apple
cat ~/Library/LaunchAgents/LABEL.plist
```

**An agent prompt or a script** — no command needed. These carry the most evidence, so they
answer the most checks.

Paste your worst one first: the routine you would be most upset to lose silently.

---

## What this is, exactly

**A lint over text, not a proof of reliability.** Whether a token is still valid, whether
the host woke up, whether a file was actually written — those are runtime properties, and
no amount of reading a config reveals them.

So it reports four states, deliberately:

| state | meaning |
|---|---|
| `FAIL` | the defect is present in the text |
| `PASS` | guard language is present — a text match, **not** a verification |
| `UNKNOWN` | this input type could carry the evidence; none was found |
| `NOT VISIBLE` | this input type structurally *cannot* answer this check |

**`NOT VISIBLE` is excluded from the score entirely** rather than counted as a pass. A cron
line can only answer 2 of the 14 checks, and it says so instead of handing you a fake 12/14.

Every row prints the text that made it fire. If the reason is wrong, the result is wrong,
and overruling it is the intended way to use it. **The 14 named failure modes are the
product; the regexes are only how they get surfaced.**

### Try it on the fixtures

`fixtures/` has three deliberately broken routines and one correct one:

| file | what it is |
|---|---|
| `broken-cron.txt` | a cron line with a host-asleep defect and an unguarded headless call |
| `broken-task.xml` | a Task Scheduler export with the classic `ExecutionTimeLimit` killer |
| `broken-skill.md` | an agent prompt with a weekday gate and a self-reporting proof |
| `good-routine.md` | **nothing wrong with it.** Any `FAIL` here is a checker bug — please open an issue |

That last one matters. A linter's worst failure mode is reddening correct config, because
users read a false alarm as a finding and never report it.

---

## Where these came from

Not from imagining failures — from watching them.

A seven-routine fleet stopped for three days and no routine noticed; every heartbeat file
jumped straight across the gap. Separately, a zero-byte flag file was accepted as proof that
a business email had been sent, and a market test was built on top of it for six days.

Neither was a crash. Both were routines that looked fine because the only thing checking them
was themselves.

---

## The fixes — $9

The checker above is free and always will be. What it doesn't ship is the remediation work.

The paid pack is this page offline plus **six drop-in fix templates**, each opening with the
exact failure it prevents, then working snippets for the platforms that failure actually
occurs on:

| template | covers | platforms |
|---|---|---|
| `heartbeat-guard.md` | 3, 4 | bash + PowerShell |
| `produce-or-alarm.md` | 5, 11, 12, 13 | design rule, no snippet |
| `elapsed-time-gate.md` | 1, 2 | bash |
| `deadman-alarm.md` | 8, 9 | bash |
| `artifact-proof.md` | 6, 7, 14 | bash + PowerShell |
| `catch-up-safe-dispatch.md` | 10 | PowerShell + Task Scheduler XML |

Coverage is listed per template because not every failure happens on every platform. The
Task Scheduler XML was import-tested with `schtasks /create`, read back with
`Get-ScheduledTask`, and confirmed setting by setting.

Plus `EXPECTED-OUTPUT.md` — what the checker should say about each fixture, so you can verify
your copy — and `RUNTIME-VERIFICATION.md`, eight tests for the things static text can never
see. **That last file is the part that actually proves anything.**

<!-- TODO: replace this block with the Gumroad link once the listing is live -->
**The pack is $9.** The listing goes up shortly — watch this repo, or open an issue
and I'll point you at it.

If it finds nothing useful in your setup, I refund it. No argument, no form.

---

## Licence

The checker and these docs: MIT (see `LICENSE`). Use them anywhere, commercial or not.

The one ask: don't redistribute the paid pack as a product.
