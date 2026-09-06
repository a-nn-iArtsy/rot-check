# Rot Check

**14 ways an unattended routine dies quietly — and how to check for them.**

Your job says it ran. Nothing checked whether it *did* anything.

That is the whole category this covers. Not crashes — crashes are loud and you already
handle those. This is the routine that fires on time, exits clean, writes a timestamp,
and has been doing nothing for nine days.

**[Try the checker →](https://a-nn-iartsy.github.io/rot-check/)** · no install, no account,
no upload. It reports **signals, not verdicts** — see *Known limits* below, which you should
read before trusting anything it says. Paste a cron line, a Task Scheduler XML export, a systemd unit, an
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

> *Seen in the wild. You can check it yourself in ten seconds.*
>
> ```
> AUTOMATIC1111/stable-diffusion-webui   164,836 stars, not archived
>   pushed_at            2026-03-02
>   master last commit   2024-07-27      gap: 582 days
> ```
>
> One of the most-used tools in its category reads as recently active, and its default
> branch has not received a commit in nineteen months. **Nothing is wrong with the project
> or its maintainers** — `pushed_at` bumps on pushes to *any* branch, so it answers a
> different question than the one people read it as. That is this failure mode exactly:
> **the field the system writes is not the field you meant.**
>
> Check any repo:
> ```bash
> gh api repos/OWNER/REPO --jq .pushed_at
> gh api repos/OWNER/REPO/commits/HEAD --jq .commit.committer.date
> ```
>
> Measured 2026-09-06 across the 300 most-starred non-archived repos: **3.0%** had a
> `pushed_at` at least 180 days newer than their last default-branch commit, **1.7%** at
> least a year. Uncommon — and the two timestamps are still not the same claim.

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

**Signals over text, not a verdict, and not a proof of reliability.** Whether a token is still valid, whether
the host woke up, whether a file was actually written — those are runtime properties, and
no amount of reading a config reveals them.

So it reports four states, deliberately:

| signal | meaning |
|---|---|
| `DEFECT SIGNAL` | wording associated with this failure appears somewhere in the text |
| `GUARD SIGNAL` | wording associated with the fix appears — a phrase match, **not** a verification |
| `NO SIGNAL` | this input type could carry the evidence; none was found |
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
| `good-routine.md` | **nothing wrong with it.** Any defect signal here is a checker bug — please open an issue |

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

## The fixes — included, free

`templates/` has six drop-in remediation files, each opening with the exact failure it prevents,
then working snippets for the platforms that failure actually occurs on:

| template | covers | platforms |
|---|---|---|
| `heartbeat-guard.md` | 3, 4 | bash + PowerShell |
| `produce-or-alarm.md` | 5, 11, 12, 13 | design rule, no snippet |
| `elapsed-time-gate.md` | 1, 2 | bash |
| `deadman-alarm.md` | 8, 9 | bash |
| `artifact-proof.md` | 6, 7, 14 | bash + PowerShell |
| `catch-up-safe-dispatch.md` | 10 | PowerShell + Task Scheduler XML |

Coverage is listed per template because not every failure happens on every platform. The Task
Scheduler XML was import-tested with `schtasks /create`, read back with `Get-ScheduledTask`, and
confirmed setting by setting, then deleted.

---

## Known limits

Written down because a tool about silent failure should not have any of its own.

**1 · Mention vs use is unsolved.** The checker matches wording across the whole document. It
cannot tell a live instruction from a quoted counterexample or a rule forbidding it. **The six
templates in this repo trigger defect signals** — they have to, because a remediation doc quotes
the anti-pattern in order to teach it. That is the tool working as built, and the reason it
reports signals instead of verdicts.

**2 · Three checks can never report a defect.** Checks 7, 8 and 9 have no defect patterns at all.
They can only report a guard signal or no signal. Fourteen modes are catalogued; eleven can
currently surface a defect signal.

**3 · Seven of fourteen checks have no test case.** Checks 4, 5, 7, 8, 9, 12 and 13 have nothing
in `fixtures/` that exercises their defect path. They are unproven, not proven-good.

**4 · Input type is guessed from the whole file, first match wins.** A document containing a
`<Task>` block is treated as Task Scheduler XML in its entirety, and up to 13 of 14 checks go
`NOT VISIBLE`. **A clean result can mean "not scored", not "not broken."** Watch the detected type.

**5 · There is no held-out corpus.** Every fixture was written by the same person who wrote the
patterns. Passing them proves in-sample consistency and nothing about a stranger's config.

These came out of a blind three-way review — two other models audited the engine independently,
without seeing each other or the author's diagnosis, and the findings above are theirs as much as
mine. Issues and counterexamples very welcome; a file that produces a wrong signal is the single
most useful thing you can send.

---

## Licence

MIT (see `LICENSE`). Checker, templates and docs. Use them anywhere, commercial or not.
