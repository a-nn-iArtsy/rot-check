# Catch-Up-Safe Dispatch

**Prevents:** runs that silently never fire because the host was asleep, plus the
inverted-order chaos catch-up dispatch causes in routines assuming clock order.

## The failure

A task is scheduled for 07:00. The machine sleeps until 09:00. Depending on the
scheduler's configuration the run is either **dropped entirely** — nothing runs, nothing
errors, the heartbeat has a gap nobody reads — or **fired late**, so two runs land close
together, or yesterday's catch-up lands after today's scheduled run. Anything comparing
"now" against a calendar name then gets a slot it did not expect.

## Windows Task Scheduler

```powershell
$s = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `                            # run the miss once the host is up
    -ExecutionTimeLimit (New-TimeSpan -Hours 4) `    # MUST exceed the wake window
    -MultipleInstances IgnoreNew `                   # a slow run must not stack on itself
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries
```

- **`StartWhenAvailable`** — without it, a missed window is simply gone.
- **`ExecutionTimeLimit`** — the classic silent killer. If it is shorter than the gap
  between the scheduled time and the host waking, the deferred run is terminated on
  arrival: it fires, it is killed, and the history shows an ordinary completion. In the
  XML this is an ISO-8601 duration — `PT4H` is four hours, `P3D` is three days, and
  **`PT0S` means no limit at all**, not zero.
- **`MultipleInstances`** — after an outage several catch-ups can be released together.
  `IgnoreNew` keeps them from trampling each other.
- **Battery settings** — `DisallowStartIfOnBatteries` skips the run with no error on a
  laptop that woke unplugged.


### The same thing as Task Scheduler XML

Save as `catch-up-safe.xml`, edit the `<Arguments>` line, then import it:

```
schtasks /create /TN "\YourRoutine" /XML catch-up-safe.xml /F
```

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Catch-up-safe daily dispatch. A window missed while the host slept
    runs on wake instead of vanishing.</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T07:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT4H</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <WakeToRun>false</WakeToRun>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -File "C:\path\to\your-routine.ps1"</Arguments>
    </Exec>
  </Actions>
</Task>
```

**Verified, not asserted.** This file was imported with the command above on
Windows 11 (build 26200), read back with `Get-ScheduledTask`, and every setting
survived: `StartWhenAvailable True`, `ExecutionTimeLimit PT4H`,
`MultipleInstances IgnoreNew`, both battery flags `False`. Then it was deleted.
Run the same three steps yourself before trusting it with a real routine —
`schtasks /create`, `Get-ScheduledTask`, `schtasks /delete /F`.

**`WakeToRun` is deliberately `false`.** `StartWhenAvailable` runs the miss once
the machine is already awake. `WakeToRun` wakes the machine to hit the slot — a
different decision, and rarely the one you want on a laptop.

## cron / anacron / launchd

- Plain `cron` **drops** missed jobs. On a machine that sleeps, use `anacron` semantics,
  a `@reboot` catch-up entry, or run the elapsed-time gate on every invocation and
  schedule far more often than the cadence.
- `launchd` with `StartInterval` fires once on wake after a missed interval; it does not
  queue every miss. Design for exactly one catch-up, not N.
- Cloud runners defer differently per provider and can release a backlog all at once.

## Make the ROUTINE catch-up-safe, not just the scheduler

1. **Gate on elapsed time**, never on a weekday or an expected hour.
2. **Be idempotent.** Running twice in ten minutes must not double-post or corrupt
   state. A same-window second run gates closed and says so.
3. **Never assume the previous run happened.** Read state from disk; treat missing state
   as first-run, not as an error.
4. **Schedule the watcher more often than anything it watches** (`deadman-alarm.md`), so
   an outage is caught by something that also survived it.

## Test it

Sleep the host past a scheduled window and wake it. Exactly one run should fire, do real
work, and leave one heartbeat line. Anything else is a bug you would otherwise only
discover during an outage.
