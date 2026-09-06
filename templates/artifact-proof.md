# Artifact Proof

**Prevents:** a self-report being accepted as evidence — a flag file, a checkbox, a
"done" line, a 0-byte output — and downstream decisions being built on top of it.

A routine reporting its own success is the least reliable evidence available, because
the failure being guarded against is precisely the routine being wrong about itself. A
0-byte file can pass as proof that a business email was sent, and every decision made
afterwards inherits that hole silently.

## The rule

**Proof is an external artifact, re-read from disk after writing, with its path and
byte size recorded.**

```bash
produce "$OUT"                                   # do the work
[ -s "$OUT" ] || { alarm "0-byte output: $OUT"; exit 1; }
BYTES=$(wc -c < "$OUT")
[ "$BYTES" -ge "$MIN_BYTES" ] || { alarm "stub output: $OUT ($BYTES b)"; exit 1; }
head -c 200 "$OUT" > /dev/null || { alarm "unreadable: $OUT"; exit 1; }
record "produced $OUT ($BYTES bytes)"
```

```powershell
if (-not (Test-Path $Out))      { Alarm "missing: $Out";       exit 1 }
$bytes = (Get-Item $Out).Length
if ($bytes -lt $MinBytes)       { Alarm "stub: $Out ($bytes b)"; exit 1 }
$null = Get-Content $Out -TotalCount 5      # prove it reads back
Record "produced $Out ($bytes bytes)"
```

**A file that has not been re-read after writing does not exist.** Write buffering, a
full disk, a permission failure and a path typo all produce a confident success and no
usable file.

## Tiers of evidence, strongest first

| tier | example | trust |
|---|---|---|
| **External record** | a live URL, an order record, an inbound reply, a provider transaction | proof |
| **Artifact on disk** | a re-read file above a minimum plausible size | strong |
| **Log line** | "wrote output" | weak — the routine's own opinion |
| **Flag file / checkbox** | `SENT.flag`, `status: done` | **none — never accept** |

Set a **minimum plausible size** per output type, not merely non-zero. An HTML report
under a few kilobytes is almost certainly a stub or an error page that happened to save.

## For anything sent outward

Nothing a routine writes about itself proves an outbound action occurred. Require the
counterparty's record: the message ID, the listing URL, the transaction, the reply. If
none can be captured, the routine may *prepare* the action but may not claim it
happened — leave the send to a human and record the evidence when it comes back.
