# AGENTS.md

## Product

Backend for a family-management app: household tasks, budgets, events, reminders, relationship insights, and family psychological well-being. A family contains first-line members only (partners and their children; no grandparents).

## Stack and structure

- NestJS + TypeScript, Prisma ORM, PostgreSQL.
- Organize code by domain in `src/modules/<domain>`; keep cross-cutting infrastructure in `src/common`, `src/config`, and `src/database`.
- Keep boundaries clear: controllers handle HTTP/auth/DTOs, services implement use cases and business rules, Prisma handles persistence. Do not put business logic in controllers or Prisma models.
- Modules must expose small public APIs and depend on abstractions or exported services, not another module's internals. Avoid circular dependencies and premature generic abstractions.
- Extract shared code only when it is domain-independent and reused; prefer cohesive domain code over a generic `utils` layer.

## API and domain rules

- Validate request DTOs with `class-validator`; define explicit response DTOs and keep Swagger contracts current.
- Preserve consistent HTTP errors, authorization, logging, pagination, and date/time handling used by existing modules.
- Enforce authorization and family ownership server-side. Never trust user IDs or family IDs supplied by the client without checking access.
- Frontend repository: `/Users/dinarsaripov/projects/my-love-frontend`. Before changing an endpoint or DTO, inspect its RTK Query usage and avoid silent breaking changes; coordinate or update the contract when required.

## Database and configuration

- Treat `prisma/schema.prisma` and committed migrations as the database source of truth.
- For schema changes, add a Prisma migration and regenerate the client. Never edit an applied migration or generated Prisma client manually.
- Use transactions for multi-step writes that must be atomic; add constraints and indexes for invariants and common query paths.
- Read configuration from environment variables via Nest Config; validate it in `src/config/env.validation.ts`. Never hard-code credentials or commit secrets.

## Quality

- Keep changes scoped, backward-compatible where practical, and test business rules plus authorization/edge cases.
- Before completion run relevant checks; normally `npm run lint`, `npm test`, and `npm run build`. Run `npm run prisma:generate` after Prisma schema changes.

## Continuity

- Before substantial work, read `/Users/dinarsaripov/projects/my-love-frontend/docs/IMPLEMENTATION_STATUS.md`; the full product scope is in the adjacent `PRODUCT_ROADMAP.md`.
- After each backend slice, record migrations, API changes, tests, decisions, blockers, and the recommended next slice in that status file.
