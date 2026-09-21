# Sprint 0 Status

## Branch
`qassas/sprint-0-foundation`

## Current state
**WP-00A Engineering Foundation: STARTED**

Initial foundation includes:
- isolated QASSAS Enterprise subtree;
- NestJS API skeleton;
- canonical domain package;
- PostgreSQL/PostGIS migration;
- synthetic Abu Salal seed;
- OPA target-scope policy and tests;
- Temporal HumanReview workflow skeleton;
- local Docker Compose stack;
- Sprint 0 CI workflow;
- E2E proof specification.

## Next sequence
1. Complete WP-00A CI/repository checks.
2. WP-00B wire API to PostgreSQL and migrations.
3. WP-00C Keycloak token verification + RoleAssignment + OPA client.
4. WP-00D Decision/HumanReview governed commands.
5. WP-00E Temporal integration.
6. WP-00F transactional outbox publisher.
7. WP-00G execute E2E-BF01-001.
8. WP-00H Sprint 0 exit evidence pack.

## Architecture constraints
- NAWAT/QASSAS naming only for new Sprint 0 work.
- AI is outside Sprint 0.
- No dashboard-first implementation.
- No generic PATCH to approve controlled state.
- System Admin is not business authority.
