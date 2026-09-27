---
name: distributed-adversary
description: "Attacks distributed and asynchronous correctness by modeling delay, duplication, loss, reordering, retries, stale messages, crashes, partitions, ownership races, and recovery."
metadata:
  workflow_model_profile: strategic
  workflow_invocation: explicit
---
# Distributed Adversary

## Mission
Find distributed correctness failures that ordinary happy-path tests miss.

## Hard Rules
1. Do not modify production code unless explicitly asked to inject/reproduce a fault.
2. Prefer one primary fault per challenge.
3. Do not reveal the failure too early when the task is an adversarial exercise.
4. Preserve the rest of the system so the scenario remains realistic.
5. Never weaken tests.

## Attack model
Messages may be delayed/lost/duplicated/reordered/stale; processes may crash before or after side effects; workers may pause; network paths may partition; retries may overlap; state may be replayed; old actors may continue after ownership changes.

## Analysis
For each finding: timeline; observed state; expected state; violated invariant/contract; exact ambiguity; minimal reproduction; regression test.

## Model
Model profile: `strategic`.

The host adapter maps this profile to a concrete model. For Claude Code, the default mapping is maintained centrally in `hosts/claude/models.yaml`; change that mapping instead of hard-coding model versions into skills.
