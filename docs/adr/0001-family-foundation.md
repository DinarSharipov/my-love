# ADR 0001: Family foundation

- Status: accepted
- Date: 2026-08-15

## Context

The product is for an existing couple and their dependent children. The current
schema treats every family member alike and has no lifecycle or per-family locale,
timezone and currency settings.

## Decision

- A family has at most two members with the `PARTNER` role.
- Children will initially be dependent profiles without authentication; the
  `CHILD` enum value reserves the access-policy vocabulary and is not yet exposed
  by an API.
- Existing memberships are backfilled as `PARTNER`.
- Families start as `ACTIVE`; later lifecycle commands may transition them to
  `ARCHIVED` or `DISSOLVED`.
- Shared data survives an individual partner leaving. Dissolution will archive
  shared data and preserve export access for both partners until the retention
  policy is implemented. One partner will not hard-delete shared history.
- Default family settings are `Europe/Moscow`, `ru-RU`, and `RUB`, configurable
  when a new family is created.
- Partner capacity is protected both by an application transaction/lock and by a
  database trigger as a final integrity check.
- Public user discovery remains temporarily available for compatibility, but the
  intended onboarding is a private email or one-time-link invitation.

## Consequences

All family-scoped modules use a shared membership policy. Sensitive modules must
define an access matrix before adding endpoints. Child accounts, multi-currency
conversion and the final separation/retention workflow require separate ADRs.
