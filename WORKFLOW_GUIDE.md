# Workflow Guide

One worked change per class, T0 through T3, end to end. These show what the orchestrator actually does, where it stops, and what it wants from you at each stop.

Read `WORKFLOW.md` first for the rules. This file is the demonstration.

## How every session begins

You do not type a skill name. You describe what you want, or you say nothing and the orchestrator opens the session itself. Either way the first thing it does is read private state and ask which change this session is about.

```
> I need to add a retry to the invoice export.

Project: acme-billing

In progress:
  [1] tenant-webhook-callback   Tenant webhook callbacks   T3  stage 9/19   next stop: S8   last touched 2026-09-24
  [2] invoice-export-retry      Invoice export retry       T2  stage 4/19   next stop: S4   last touched 2026-09-19

Blocked:
  [3] rate-limit-headers        Rate limit headers         T2  waiting on: S9 stop-ship (senior review)

  [4] Start a new change

Your message looks like it may be change [2], but I am not assuming that.
Which one?
```

It asks even when only one change is open, and even when your opening message obviously matches one. A resemblance is a hypothesis; only you know whether today's retry is the same retry you were working on last week.

On resume it checks whether the world moved:

```
> 2

Resuming invoice-export-retry (T2), stage 4/19.

STALENESS: base branch moved since the last entry.
  recorded base_sha  4f2a1c9
  current base_sha   8b77e31  (merge from staging, 2026-09-26)
  change surface     src/billing/export.ts  MODIFIED since last entry

Gates marked STALE — RE-VERIFY:
  Verification          was COMPLETE   evidence observed against 4f2a1c9
  Security (design)     was COMPLETE   export.ts changed under it

I will re-run those before continuing. The old test run is a record of what
was observed then, not a claim about the code you have now.
```

---

## T0 — Trivial

**Change:** a misspelled word in a code comment.

```
> fix the typo in the comment above parseInvoice, "recieved" -> "received"

Change: comment-typo-parseinvoice  (new)
Class: T0 — comment text only, no behavioral, security, operational,
       architectural, contract, or documentation impact.

Gate matrix
  Requirements              N/A WITH REASON — no behavior is specified or changed
  Security                  N/A WITH REASON — comment text, no boundary, input,
                            privilege, secret, resource limit, or external effect
  Design challenge          N/A WITH REASON — no design surface
  Distributed correctness   N/A WITH REASON — no process or network boundary
  Implementation            REQUIRED
  Verification              REQUIRED — build only
  Senior review             N/A WITH REASON — mechanical edit, no semantics
  Engineering reasoning     N/A WITH REASON — nothing to defend
  Documentation             N/A WITH REASON — unless drift is found in passing

Stops: S12 only.

src/billing/export.ts:214  - // amount recieved from the gateway
                           + // amount received from the gateway

Build: `npm run build` — observed: exit 0.

S12 — ship?
```

T0 is the class where ceremony would be pure cost, so there is almost none. What survives is the labelling: every gate is still named and still carries a reason. You can read this six months later and see that security was considered, not forgotten.

**Where T0 stops being T0:** if that comment documents a guarantee — `// callers must hold the tenant lock` — editing it changes what the next engineer believes. That is T1 at least. When a "typo" turns out to be load-bearing, the orchestrator reclassifies rather than finishing the T0 route.

---

## T1 — Local low-risk

**Change:** invoice export currently formats currency with a hardcoded two decimal places; JPY has none.

```
> invoice export hardcodes 2dp for currency, breaks for JPY

Change: invoice-currency-precision  (new)
Class: T1 — localized formatting behavior. No public contract, persistence,
       distributed, privilege, or external-side-effect impact. One call site.

S1 — confirm scope: formatting only, or does the stored amount change too?
```

```
> formatting only. stored amount is already minor units, untouched.

Understood. S2 — state the requirement. This is yours to write; I will ask
about gaps but will not propose the requirement itself.
```

```
> exported invoices must render amounts with the decimal precision of their
> currency, per ISO 4217. JPY 0, USD 2, BHD 3.

[dispatch: requirements-architect]

Human intent (verbatim):
  "exported invoices must render amounts with the decimal precision of their
   currency, per ISO 4217. JPY 0, USD 2, BHD 3."

Approved requirements
  R1  Rendered amount precision follows ISO 4217 per currency   origin: human

Gaps — questions, not proposals:
  Q1  What should render for a currency not in your ISO table?
  Q2  Does this apply to the CSV export as well as the PDF, or PDF only?

Unaddressed dimensions: rounding direction, existing stored invoices.
```

Note the shape. `requirements-architect` will not write "unknown currencies should default to 2dp" for you, even though that is the obvious answer and it knows it. Proposing a functional requirement to a busy engineer is the same as deciding it, because it will be accepted. It names the gap; you fill it.

```
> unknown currency -> fail loud, don't guess. both exports. rounding: half-up.
> existing invoices re-render on view so they're covered.

R2  Unknown currency code fails the export with an explicit error   origin: human
R3  Applies to PDF and CSV export paths                             origin: human
R4  Rounding is half-up                                             origin: human

AI SUGGESTION — HUMAN DECISION REQUIRED (non-functional)
  N1  Precision lookup should not add a network call per line item
      origin: ai-proposed

S3 — accept / reject / defer N1?
```

```
> accept

N1  accepted.

Gate matrix
  Requirements              REQUIRED — complete
  Security                  OPTIONAL WITH REASON — no boundary, but R2 changes
                            an error path; checked at review rather than a
                            dedicated adversarial pass
  Design challenge          N/A WITH REASON — one function, no new component,
                            ownership, or contract
  Distributed correctness   N/A WITH REASON — pure function, in-process
  Tracing                   N/A WITH REASON — no causal boundary added
  Implementation            REQUIRED
  Verification              REQUIRED
  Senior review             REQUIRED — R2 introduces a new failure mode
  Engineering reasoning     REQUIRED
  Documentation             OPTIONAL WITH REASON — pending drift check

[dispatch: implementation-agent]

Pre-implementation declaration
  Existing modules, additive
    src/billing/currency.ts   + precisionFor(code): number   throws on unknown
  Existing modules, modifying
    src/billing/format.ts     formatAmount() gains a currency argument
                              known callers: export/pdf.ts:88, export/csv.ts:41
                              both inside approved scope

  Risk: formatAmount is exported from the billing barrel file. Callers outside
  the approved scope would make this shared-surface. I checked: there are none.

  Verification: unit tests for JPY/USD/BHD/unknown, plus both export paths.

S8 — GO?
```

The pre-implementation declaration is where T1 earns its keep. It is a short read, and it is the moment a "local" change reveals it is not local. If `formatAmount` had callers outside billing, the agent would stop here rather than change them — a shared-surface change is not something you approve by skimming a diff afterward.

```
> GO

[writes]
[dispatch: verification-engineer]

  npm test -- currency      observed: 14 passing, 0 failing
  npm test -- export        observed: 31 passing, 0 failing
  Negative path: unknown code 'XYZ' — observed: throws UnknownCurrency, export
  aborts, no partial file written.

[dispatch: senior-code-reviewer]   (isolated: diff + requirements only)

  Finding  MEDIUM  R2 fails the whole export on one bad line item. Confirm
                   that is intended — an invoice with 200 lines and one bad
                   currency now exports nothing.
                   Evidence: export/csv.ts:41, abort before write.

S9 — stop-ship decision.
```

```
> intended. a partial invoice is worse than no invoice.

Recorded. S10 — reasoning defense.

[dispatch: engineering-reasoning-reviewer]

  All requirements are origin: human. N1 is ai-proposed, so I will start there.

  1. N1 says no network call per line item. What in the implementation
     actually guarantees that, and what would break it?
  2. What does the JPY test prove, and what does it not prove?
  3. An invoice is mid-render when the unknown currency throws. What state is
     left behind?
```

Question 1 targets N1 because N1 is the one thing here you did not author. That is the whole point of tracking provenance: the defense goes where your understanding is thinnest, instead of spreading evenly over things you already own.

---

## T2 — Meaningful

**Change:** invoice export moves from synchronous request to a background job with a status endpoint.

T2 has the full shape of T3 but a smaller scope. The differences worth seeing:

**S4 is a paragraph, not an artifact.**

```
S4 — state your design. Components, ownership, contracts, state, failure
     behavior. A paragraph is fine at T2.
```

```
> POST /exports enqueues a job row (pending) and returns 202 + job id. A worker
> picks it up, writes to S3, flips the row to done with the url. GET
> /exports/:id returns status. Job row owns the state, worker never writes
> anywhere else. On worker crash the row stays pending and a sweeper retries
> after 15m.

[dispatch: system-design-challenger]   (isolated: your design + source pointers)

  Sound: single writer for the job row, state machine is small and explicit.

  Hidden assumption — "on worker crash the row stays pending"
    Failure sequence: worker writes the S3 object, then crashes before the
    row update. Sweeper retries after 15m. Second worker writes a second S3
    object. Row flips to done pointing at the second. First object is orphaned
    and billable, and if the export is non-deterministic the two differ.
    Your design does not say which one is the invoice.

  Weak invariant — "worker never writes anywhere else"
    It writes to S3. S3 is state with ownership. The invariant is true of the
    database and false of the system.

  Alternative (ai-proposed): make the S3 key a function of the job id so a
    retry overwrites rather than orphans. Trade-off: loses the ability to
    diff two attempts when debugging.

  Question you must answer: is the export deterministic for a fixed invoice
  set, or does it embed a generation timestamp?
```

Read what happened there. It did not redesign your job system. It took your sentence — "the row stays pending" — and walked it forward until it broke, then handed you a question only you can answer. The alternative is offered, tagged `ai-proposed`, and goes nowhere until you dispose of it at S7.

**Tracing is conditional and often N/A.**

```
  Tracing   N/A WITH REASON — the job crosses a process boundary, but the
            existing worker already propagates trace context at the queue
            boundary and this change adds no new causal edge. Revisit if the
            sweeper becomes a separate service.
```

That is what `N/A WITH REASON` should look like: a concrete architectural claim you can disagree with, not "not applicable."

**The distributed stage is required here and was not at T1.**

```
[dispatch: distributed-adversary]   (isolated)

  Attack: duplicate delivery.
    Timeline  t0 queue delivers job 41 to worker A
              t1 A begins export
              t2 visibility timeout expires, queue redelivers 41 to worker B
              t3 A and B both write, both flip the row to done
    Observed state   row done, url from whichever wrote last
    Expected state   one export, one url
    Violated         "job row has a single writer"
    Minimal repro    set visibility timeout below export p99
    Regression test  assert a second concurrent claim of the same job is
                     rejected by a conditional update on the pending state
```

---

## T3 — Critical

**Change:** tenant-scoped outbound webhook callbacks — a security boundary, an external side effect, and async delivery at once.

Full route, every stop. Showing the ones that differ from T2.

**S4 is an artifact, and the challenge is proportionally harder.**

**S5, the threat model, is yours — and this is where the escalation ladder matters.**

```
S5 — state your threat model: assets, actors, attacker capabilities, entry
     points, trust boundaries, abuse cases.
```

```
> honestly I haven't done threat modeling on outbound webhooks before. I know
> SSRF is a thing here. not sure what else.

You have a real gap, which is the normal case on an unfamiliar surface. I can
help along a ladder. Each rung is recorded, because help that leaves no trace
becomes authorship nobody noticed.

  Rung 3 — I name the dimensions you have not addressed, and supply no content.
  Rung 4 — I write candidate threat model entries, tagged ai-proposed, which
           you accept or reject with a reason.

Starting at rung 3. Unaddressed:
  - destination control: who chooses the callback URL, and when
  - tenant isolation: what stops tenant A receiving tenant B's payload
  - payload contents: what leaves your boundary
  - authentication: how the receiver knows it is you
  - replay: what a receiver can do with a captured request
  - resource limits: what a slow or hostile receiver costs you
  - internal network reachability: what the egress path can reach

Which of these can you fill in? Say the word and I go to rung 4 on the rest.
```

```
> ok I can do destination control, tenant isolation, payload. go rung 4 on
> auth, replay, limits, egress.

Recorded: four entries origin: human, four origin: ai-proposed pending your
disposition at S7.
```

Three things happened. You were not left stranded on a surface you have not worked before. You were not handed a finished threat model to nod at. And the record now says precisely which half you authored — which is what the reasoning defense will use later.

**S7 disposes of every proposed element, with reasons.**

```
S7 — disposition required.

  ai-proposed  A1  HMAC-SHA256 signature over body + timestamp, tenant-scoped key
  ai-proposed  A2  Reject timestamps older than 5 minutes (replay window)
  ai-proposed  A3  Per-tenant concurrent delivery cap and per-destination circuit breaker
  ai-proposed  A4  Egress allowlist; deny RFC1918, link-local, and metadata endpoints

  Design: 2 of 6 core structural elements are ai-proposed (A1, A4). Stating
  that plainly is not an objection — it is a fact worth holding while you
  decide, and the reasoning reviewer will come back to exactly these.
```

**The implementation agent refuses a shared-surface change mid-flight.**

```
[dispatch: implementation-agent]

  STOPPED — shared surface.

  Symbol      HttpClient.post(url, body)            src/net/client.ts:31
  Callers     14 outside the approved scope
  Proposed    post(url, body, { egressPolicy })
  Why         A4 needs the egress allowlist enforced in the client, not at the
              call site, or the next caller silently opts out.

  Compatibility options
    additive   post() unchanged; new postExternal() carries the policy.
               Existing callers keep today's behavior, including the ones that
               arguably should not.
    versioned  policy defaults to internal-only; opt out explicitly.
               Touches 14 call sites, all of which must be re-reviewed.
    breaking   required argument. Compiler finds every caller. Largest diff,
               no silent misses.

  This is beyond the approved scope. Awaiting instruction.
```

This is the rule doing exactly what it exists for. A security control that is easy to bypass by calling the other function is not a control, and the fix touches 14 call sites in code nobody scoped. The agent will not make that call and will not quietly pick the smallest diff.

**Adversarial stages run isolated, and a stop-ship halts dispatch immediately.**

```
[dispatch: security-adversary — implementation pass]
  (receives: your threat model, the diff, source pointers.
   does NOT receive: the implementation agent's rationale, the design
   challenger's findings, or my summary of either.)

  STOP-SHIP

  Finding      Signature covers body + timestamp, not the destination URL.
  Precondition Attacker controls any one tenant's callback destination.
  Path         Capture a signed delivery to their own endpoint, replay the
               body verbatim to a different tenant's destination inside the
               5-minute window. A2 does not help; the timestamp is still fresh.
               A1 verifies, because nothing binds the signature to a recipient.
  Violated     Tenant isolation (your threat model, entry 2 — origin: human)
  Direction    Bind destination and tenant id into the signed payload.

  Halting dispatch. S9.
```

The isolation is load-bearing here. Had this pass been handed the design challenger's conclusions and the implementer's reasoning, it would have been reading an account in which A1 already solved authentication. It read the diff instead.

**The reasoning defense goes straight at what you did not author.**

```
[dispatch: engineering-reasoning-reviewer]

  Provenance: A1 and A4 are ai-proposed. Threat model entries for auth,
  replay, limits, and egress are ai-proposed. Starting there.

  1. A4 denies RFC1918 and the metadata endpoint. A tenant registers a
     destination that resolves publicly at registration and to 169.254.169.254
     at delivery. Walk me through what your implementation does. If it stops
     it, name the line. If it does not, say so.
  2. You accepted the 5-minute replay window. Why five? What breaks at sixty
     seconds, and what does an attacker gain at thirty minutes?
  3. The signature now binds destination and tenant. What does that NOT
     protect against?
  4. A3 caps concurrency per tenant. One tenant registers 500 destinations.
     What is your actual blast radius?

  Answer from your own understanding. Do not re-read the diff, and I will not
  help you assemble an answer. "I don't know" is a real outcome and is
  recorded as one.
```

Question 1 is the DNS rebinding case, and it is asked because A4 is `ai-proposed` — you accepted an egress allowlist without necessarily knowing that resolve-then-connect is where allowlists leak. If you cannot answer it, the workflow has done its job: you have found the gap now, holding a diff you can still change, rather than during an incident.

That is the trade the whole system makes. Everything upstream got faster. This gate got harder. You still have to know the system.

---

## What never gets waived

Above T0, four stops are always present regardless of class, urgency, or how well the change is going:

- **S2** you state the requirements
- **S8** you authorize the write
- **S10** you defend the change
- **S12** you approve the ship

Everything else is risk-proportional. These four are the workflow's identity.
