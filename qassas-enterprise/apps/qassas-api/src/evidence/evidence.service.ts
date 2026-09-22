import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { AuditEventWriter } from "../audit/audit-event.writer";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";
import type {
  CreateEvidenceSnapshotCommand,
  OpenDataGapCommand,
  OpenEvidenceConflictCommand,
  QualifyEvidenceCommand,
  RegisterEvidenceCommand,
} from "./evidence.types";

interface TargetScopeRow {
  target_id: string;
  enterprise_id: string;
  asset_id: string | null;
  security_class: string;
}

interface EvidenceRow {
  evidence_id: string;
  target_id: string;
  evidence_class: string;
  source_system: string;
  source_object_id: string | null;
  source_org: string | null;
  source_type: string | null;
  source_date: Date | null;
  version_label: string | null;
  observation: string | null;
  qa_qc_status: string | null;
  validation_status: string;
  decision_fitness: string;
  security_class: string;
  current_state: string;
  object_version: string;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  enterprise_id: string;
  asset_id: string | null;
  target_security_class: string;
}

interface QualificationRow {
  qualification_id: string;
  evidence_id: string;
  evidence_object_version: string;
  assessor_user_id: string;
  validation_status: string;
  decision_fitness: string;
  confidence_class: string;
  limitations: string | null;
  rationale: string;
  created_at: Date;
}

interface SnapshotEvidenceRow extends EvidenceRow {
  qualification_id: string | null;
  qualification_validation_status: string | null;
  qualification_decision_fitness: string | null;
  confidence_class: string | null;
}

interface SnapshotRow {
  snapshot_id: string;
  target_id: string;
  snapshot_status: string;
  created_by_user_id: string;
  object_version: string;
  created_at: Date;
  enterprise_id: string;
  asset_id: string | null;
  security_class: string;
}

interface SnapshotItemRow {
  evidence_id: string;
  evidence_object_version: string;
  qualification_id: string;
  validation_status: string;
  decision_fitness: string;
  confidence_class: string;
}

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

@Injectable()
export class EvidenceService {
  private readonly qualificationStates = new Set([
    "SOURCE_VERIFIED",
    "STRUCTURALLY_VALIDATED",
    "TECHNICALLY_VALIDATED",
    "DECISION_GRADE",
    "QUALIFIED_WITH_LIMITATIONS",
    "CONFLICTED",
    "REJECTED",
  ]);

  private readonly decisionFitness = new Set([
    "VALIDATED",
    "DECISION_GRADE",
    "QUALIFIED_WITH_LIMITATIONS",
    "NOT_FIT",
    "SUPERSEDED",
  ]);

  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly events: AuditEventWriter,
  ) {}

  async getEvidence(evidenceId: string, actor: AuthenticatedActor) {
    const evidence = await this.loadEvidence(evidenceId);
    if (!evidence?.asset_id) throw new NotFoundException();

    await this.authorizeRead(actor, evidence);
    const qualifications = await this.database.query<QualificationRow>(
      `SELECT qualification_id, evidence_id, evidence_object_version,
              assessor_user_id, validation_status, decision_fitness,
              confidence_class, limitations, rationale, created_at
         FROM qassas_core.evidence_qualification
        WHERE evidence_id = $1
        ORDER BY created_at, qualification_id`,
      [evidenceId],
    );

    return {
      ...this.evidenceView(evidence),
      qualifications: qualifications.rows.map((row) => ({
        qualification_id: row.qualification_id,
        evidence_object_version: Number(row.evidence_object_version),
        assessor_user_id: row.assessor_user_id,
        validation_status: row.validation_status,
        decision_fitness: row.decision_fitness,
        confidence_class: row.confidence_class,
        limitations: row.limitations,
        rationale: row.rationale,
        created_at: row.created_at.toISOString(),
      })),
    };
  }

  async registerEvidence(
    actor: AuthenticatedActor,
    command: RegisterEvidenceCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.target_id, "target_id");
    this.requireText(command.evidence_class, "evidence_class");
    this.requireText(command.source_system, "source_system");

    const target = await this.requireTarget(command.target_id);
    await this.authorizeEvidenceAction(
      actor,
      "register",
      target,
      correlationId,
    );

    const requestHash = this.hash(command);
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "RegisterEvidence",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const evidenceId = `EVD-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.evidence_object (
           evidence_id, target_id, evidence_class, source_system,
           source_object_id, source_org, source_type, source_date,
           version_label, observation, qa_qc_status, validation_status,
           decision_fitness, security_class, current_state,
           created_by_user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
           'REGISTERED','NOT_ASSESSED',$12,'CURRENT',$13
         )`,
        [
          evidenceId,
          command.target_id,
          command.evidence_class,
          command.source_system,
          command.source_object_id ?? null,
          command.source_org ?? null,
          command.source_type ?? null,
          command.source_date ? new Date(command.source_date) : null,
          command.version_label ?? null,
          command.observation ?? null,
          command.qa_qc_status ?? null,
          target.security_class,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "EvidenceRegistered",
        objectType: "EvidenceObject",
        objectId: evidenceId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: target.enterprise_id,
        correlationId,
        previousState: null,
        newState: "REGISTERED",
        payload: {
          target_id: command.target_id,
          evidence_class: command.evidence_class,
          source_system: command.source_system,
          source_object_id: command.source_object_id ?? null,
        },
      });

      const result = {
        evidence_id: evidenceId,
        target_id: command.target_id,
        evidence_class: command.evidence_class,
        validation_status: "REGISTERED",
        decision_fitness: "NOT_ASSESSED",
        security_class: target.security_class,
        current_state: "CURRENT",
        object_version: 1,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "RegisterEvidence",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async qualifyEvidence(
    evidenceId: string,
    actor: AuthenticatedActor,
    command: QualifyEvidenceCommand,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.validateQualification(command);
    const evidence = await this.requireEvidence(evidenceId);
    await this.authorizeEvidenceAction(
      actor,
      "qualify",
      this.scopeFromEvidence(evidence),
      correlationId,
      evidenceId,
    );

    const requestHash = this.hash({ evidenceId, expectedVersion, ...command });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "QualifyEvidence",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const locked = await this.lockEvidence(client, evidenceId);
      this.ensureVersion(locked.object_version, expectedVersion);

      const nextVersion = Number(locked.object_version) + 1;
      const qualificationId = `EVQ-${randomUUID()}`;

      await client.query(
        `INSERT INTO qassas_core.evidence_qualification (
           qualification_id, evidence_id, evidence_object_version,
           assessor_user_id, validation_status, decision_fitness,
           confidence_class, limitations, rationale
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          qualificationId,
          evidenceId,
          nextVersion,
          actor.userId,
          command.validation_status,
          command.decision_fitness,
          command.confidence_class,
          command.limitations ?? null,
          command.rationale,
        ],
      );

      await client.query(
        `UPDATE qassas_core.evidence_object
            SET validation_status = $2,
                decision_fitness = $3,
                object_version = $4,
                updated_at = now()
          WHERE evidence_id = $1`,
        [
          evidenceId,
          command.validation_status,
          command.decision_fitness,
          nextVersion,
        ],
      );

      await this.events.write(client, {
        eventType: "EvidenceQualified",
        objectType: "EvidenceObject",
        objectId: evidenceId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: locked.enterprise_id,
        correlationId,
        previousState: locked.validation_status,
        newState: command.validation_status,
        payload: {
          qualification_id: qualificationId,
          decision_fitness: command.decision_fitness,
          confidence_class: command.confidence_class,
          limitations: command.limitations ?? null,
          rationale: command.rationale,
        },
      });

      const result = {
        evidence_id: evidenceId,
        qualification_id: qualificationId,
        validation_status: command.validation_status,
        decision_fitness: command.decision_fitness,
        confidence_class: command.confidence_class,
        object_version: nextVersion,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "QualifyEvidence",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async createSnapshot(
    actor: AuthenticatedActor,
    command: CreateEvidenceSnapshotCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const evidenceIds = [...new Set(command.evidence_ids ?? [])];
    if (!evidenceIds.length) {
      throw new BadRequestException("evidence_ids must contain at least one evidence object");
    }

    const target = await this.requireTarget(command.target_id);
    await this.authorizeEvidenceAction(
      actor,
      "create_snapshot",
      target,
      correlationId,
    );

    const evidence = await this.loadSnapshotEvidence(
      command.target_id,
      evidenceIds,
    );
    if (evidence.length !== evidenceIds.length) {
      throw new BadRequestException("All evidence IDs must exist and belong to the target");
    }
    for (const item of evidence) {
      if (!item.qualification_id) {
        throw new ConflictException({
          code: "QAS-EVIDENCE-NOT-QUALIFIED",
          evidence_id: item.evidence_id,
        });
      }
    }

    const requestHash = this.hash({
      target_id: command.target_id,
      evidence_ids: evidenceIds.sort(),
    });

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "CreateEvidenceSnapshot",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const snapshotId = `EVS-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.evidence_snapshot (
           snapshot_id, target_id, snapshot_status, created_by_user_id
         ) VALUES ($1,$2,'LOCKED',$3)`,
        [snapshotId, command.target_id, actor.userId],
      );

      for (const item of evidence) {
        await client.query(
          `INSERT INTO qassas_core.evidence_snapshot_item (
             snapshot_id, evidence_id, evidence_object_version,
             qualification_id, validation_status, decision_fitness,
             confidence_class
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            snapshotId,
            item.evidence_id,
            Number(item.object_version),
            item.qualification_id,
            item.qualification_validation_status,
            item.qualification_decision_fitness,
            item.confidence_class,
          ],
        );
      }

      await this.events.write(client, {
        eventType: "EvidenceSnapshotLocked",
        objectType: "EvidenceSnapshot",
        objectId: snapshotId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: target.enterprise_id,
        correlationId,
        previousState: null,
        newState: "LOCKED",
        payload: {
          target_id: command.target_id,
          evidence_ids: evidence.map((item) => item.evidence_id),
        },
      });

      const result = {
        snapshot_id: snapshotId,
        target_id: command.target_id,
        snapshot_status: "LOCKED",
        evidence_count: evidence.length,
        object_version: 1,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "CreateEvidenceSnapshot",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async getSnapshot(snapshotId: string, actor: AuthenticatedActor) {
    const snapshot = await this.database.query<SnapshotRow>(
      `SELECT s.snapshot_id, s.target_id, s.snapshot_status,
              s.created_by_user_id, s.object_version, s.created_at,
              t.enterprise_id, t.asset_id, t.security_class
         FROM qassas_core.evidence_snapshot s
         JOIN qassas_core.target t ON t.target_id = s.target_id
        WHERE s.snapshot_id = $1
        LIMIT 1`,
      [snapshotId],
    );
    const row = snapshot.rows[0];
    if (!row?.asset_id) throw new NotFoundException();

    const access = await this.policy.canReadTarget(actor, {
      targetId: row.target_id,
      assetId: row.asset_id,
      securityClass: row.security_class,
    });
    if (!access.allow) throw new NotFoundException();

    const items = await this.database.query<SnapshotItemRow>(
      `SELECT evidence_id, evidence_object_version, qualification_id,
              validation_status, decision_fitness, confidence_class
         FROM qassas_core.evidence_snapshot_item
        WHERE snapshot_id = $1
        ORDER BY evidence_id`,
      [snapshotId],
    );

    return {
      snapshot_id: row.snapshot_id,
      target_id: row.target_id,
      snapshot_status: row.snapshot_status,
      created_by_user_id: row.created_by_user_id,
      object_version: Number(row.object_version),
      created_at: row.created_at.toISOString(),
      items: items.rows.map((item) => ({
        evidence_id: item.evidence_id,
        evidence_object_version: Number(item.evidence_object_version),
        qualification_id: item.qualification_id,
        validation_status: item.validation_status,
        decision_fitness: item.decision_fitness,
        confidence_class: item.confidence_class,
      })),
    };
  }

  async openDataGap(
    actor: AuthenticatedActor,
    command: OpenDataGapCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.required_information, "required_information");
    this.requireText(command.why_required, "why_required");
    this.requireText(command.decision_impact, "decision_impact");
    if (!["BLOCKING", "ADVISORY"].includes(command.blocking_status)) {
      throw new BadRequestException("blocking_status must be BLOCKING or ADVISORY");
    }

    const target = await this.requireTarget(command.target_id);
    await this.authorizeEvidenceAction(
      actor,
      "open_gap",
      target,
      correlationId,
    );
    await this.validateOptionalDecision(command.decision_id, command.target_id);

    const requestHash = this.hash(command);
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "OpenDataGap",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const gapId = `GAP-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.data_gap (
           gap_id, target_id, decision_id, required_information,
           why_required, potential_source, cost_class, decision_impact,
           blocking_status, status, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN',$10)`,
        [
          gapId,
          command.target_id,
          command.decision_id ?? null,
          command.required_information,
          command.why_required,
          command.potential_source ?? null,
          command.cost_class ?? null,
          command.decision_impact,
          command.blocking_status,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "DataGapOpened",
        objectType: "DataGap",
        objectId: gapId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: target.enterprise_id,
        correlationId,
        previousState: null,
        newState: "OPEN",
        payload: {
          target_id: command.target_id,
          decision_id: command.decision_id ?? null,
          blocking_status: command.blocking_status,
          decision_impact: command.decision_impact,
        },
      });

      const result = {
        gap_id: gapId,
        target_id: command.target_id,
        decision_id: command.decision_id ?? null,
        blocking_status: command.blocking_status,
        status: "OPEN",
        object_version: 1,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "OpenDataGap",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async openConflict(
    actor: AuthenticatedActor,
    command: OpenEvidenceConflictCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const evidenceIds = [...new Set(command.evidence_ids ?? [])];
    if (evidenceIds.length < 2) {
      throw new BadRequestException("A conflict requires at least two evidence objects");
    }
    if (!["CF-1", "CF-2", "CF-3", "CF-4", "CF-5"].includes(command.severity)) {
      throw new BadRequestException("Invalid conflict severity");
    }
    this.requireText(command.conflict_type, "conflict_type");
    this.requireText(command.technical_interpretation, "technical_interpretation");
    this.requireText(command.decision_impact, "decision_impact");

    const target = await this.requireTarget(command.target_id);
    await this.authorizeEvidenceAction(
      actor,
      "open_conflict",
      target,
      correlationId,
    );
    await this.validateOptionalDecision(command.decision_id, command.target_id);

    const evidence = await this.database.query<{ evidence_id: string }>(
      `SELECT evidence_id
         FROM qassas_core.evidence_object
        WHERE target_id = $1
          AND evidence_id = ANY($2::text[])`,
      [command.target_id, evidenceIds],
    );
    if (evidence.rows.length !== evidenceIds.length) {
      throw new BadRequestException("All conflict evidence must belong to the target");
    }

    const requestHash = this.hash({
      ...command,
      evidence_ids: evidenceIds.sort(),
    });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "OpenEvidenceConflict",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const conflictId = `ECF-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.evidence_conflict (
           conflict_id, target_id, decision_id, conflict_type, severity,
           technical_interpretation, decision_impact, resolution_method,
           status, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'OPEN',$9)`,
        [
          conflictId,
          command.target_id,
          command.decision_id ?? null,
          command.conflict_type,
          command.severity,
          command.technical_interpretation,
          command.decision_impact,
          command.resolution_method ?? null,
          actor.userId,
        ],
      );

      for (const evidenceId of evidenceIds) {
        await client.query(
          `INSERT INTO qassas_core.evidence_conflict_item (
             conflict_id, evidence_id
           ) VALUES ($1,$2)`,
          [conflictId, evidenceId],
        );
      }

      await this.events.write(client, {
        eventType: "EvidenceConflictOpened",
        objectType: "EvidenceConflict",
        objectId: conflictId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: target.enterprise_id,
        correlationId,
        previousState: null,
        newState: "OPEN",
        payload: {
          target_id: command.target_id,
          decision_id: command.decision_id ?? null,
          evidence_ids: evidenceIds,
          conflict_type: command.conflict_type,
          severity: command.severity,
          decision_impact: command.decision_impact,
        },
      });

      const result = {
        conflict_id: conflictId,
        target_id: command.target_id,
        decision_id: command.decision_id ?? null,
        evidence_ids: evidenceIds,
        severity: command.severity,
        status: "OPEN",
        object_version: 1,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "OpenEvidenceConflict",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  private async requireTarget(targetId: string): Promise<TargetScopeRow> {
    const result = await this.database.query<TargetScopeRow>(
      `SELECT target_id, enterprise_id, asset_id, security_class
         FROM qassas_core.target
        WHERE target_id = $1
        LIMIT 1`,
      [targetId],
    );
    const target = result.rows[0];
    if (!target?.asset_id) throw new NotFoundException();
    return target;
  }

  private async loadEvidence(evidenceId: string): Promise<EvidenceRow | null> {
    const result = await this.database.query<EvidenceRow>(
      this.evidenceSql(false),
      [evidenceId],
    );
    return result.rows[0] ?? null;
  }

  private async requireEvidence(evidenceId: string): Promise<EvidenceRow> {
    const evidence = await this.loadEvidence(evidenceId);
    if (!evidence) throw new NotFoundException();
    return evidence;
  }

  private async lockEvidence(
    client: PoolClient,
    evidenceId: string,
  ): Promise<EvidenceRow> {
    const result = await client.query<EvidenceRow>(
      this.evidenceSql(true),
      [evidenceId],
    );
    const evidence = result.rows[0];
    if (!evidence) throw new NotFoundException();
    return evidence;
  }

  private evidenceSql(forUpdate: boolean) {
    return `SELECT e.evidence_id, e.target_id, e.evidence_class,
                   e.source_system, e.source_object_id, e.source_org,
                   e.source_type, e.source_date, e.version_label,
                   e.observation, e.qa_qc_status, e.validation_status,
                   e.decision_fitness, e.security_class, e.current_state,
                   e.object_version, e.created_by_user_id, e.created_at,
                   e.updated_at, t.enterprise_id, t.asset_id,
                   t.security_class AS target_security_class
              FROM qassas_core.evidence_object e
              JOIN qassas_core.target t ON t.target_id = e.target_id
             WHERE e.evidence_id = $1
             LIMIT 1
             ${forUpdate ? "FOR UPDATE OF e" : ""}`;
  }

  private async loadSnapshotEvidence(
    targetId: string,
    evidenceIds: string[],
  ): Promise<SnapshotEvidenceRow[]> {
    const result = await this.database.query<SnapshotEvidenceRow>(
      `SELECT e.evidence_id, e.target_id, e.evidence_class,
              e.source_system, e.source_object_id, e.source_org,
              e.source_type, e.source_date, e.version_label,
              e.observation, e.qa_qc_status, e.validation_status,
              e.decision_fitness, e.security_class, e.current_state,
              e.object_version, e.created_by_user_id, e.created_at,
              e.updated_at, t.enterprise_id, t.asset_id,
              t.security_class AS target_security_class,
              q.qualification_id,
              q.validation_status AS qualification_validation_status,
              q.decision_fitness AS qualification_decision_fitness,
              q.confidence_class
         FROM qassas_core.evidence_object e
         JOIN qassas_core.target t ON t.target_id = e.target_id
         LEFT JOIN LATERAL (
           SELECT qualification_id, validation_status,
                  decision_fitness, confidence_class
             FROM qassas_core.evidence_qualification q
            WHERE q.evidence_id = e.evidence_id
            ORDER BY q.created_at DESC, q.qualification_id DESC
            LIMIT 1
         ) q ON true
        WHERE e.target_id = $1
          AND e.evidence_id = ANY($2::text[])
          AND e.current_state = 'CURRENT'`,
      [targetId, evidenceIds],
    );
    return result.rows;
  }

  private async authorizeRead(
    actor: AuthenticatedActor,
    evidence: EvidenceRow,
  ) {
    if (!evidence.asset_id) throw new NotFoundException();
    const allowed = await this.policy.canReadTarget(actor, {
      targetId: evidence.target_id,
      assetId: evidence.asset_id,
      securityClass: evidence.security_class,
    });
    if (!allowed.allow) throw new NotFoundException();
  }

  private async authorizeEvidenceAction(
    actor: AuthenticatedActor,
    action:
      | "register"
      | "qualify"
      | "create_snapshot"
      | "open_gap"
      | "open_conflict",
    target: TargetScopeRow,
    correlationId: string,
    evidenceId?: string,
  ) {
    if (!target.asset_id) throw new NotFoundException();
    const allowed = await this.policy.canActOnEvidence(actor, action, {
      targetId: target.target_id,
      assetId: target.asset_id,
      securityClass: target.security_class,
      evidenceId,
    });
    if (!allowed.allow) {
      await this.recordDenied(
        actor,
        target.enterprise_id,
        evidenceId ? "EvidenceObject" : "Target",
        evidenceId ?? target.target_id,
        correlationId,
        action,
        allowed.reason,
      );
      throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });
    }
  }

  private scopeFromEvidence(evidence: EvidenceRow): TargetScopeRow {
    return {
      target_id: evidence.target_id,
      enterprise_id: evidence.enterprise_id,
      asset_id: evidence.asset_id,
      security_class: evidence.target_security_class,
    };
  }

  private async validateOptionalDecision(
    decisionId: string | null | undefined,
    targetId: string,
  ) {
    if (!decisionId) return;
    const result = await this.database.query<{ decision_id: string }>(
      `SELECT decision_id
         FROM qassas_core.decision_object
        WHERE decision_id = $1
          AND target_id = $2
        LIMIT 1`,
      [decisionId, targetId],
    );
    if (!result.rowCount) {
      throw new BadRequestException("decision_id must belong to the same target");
    }
  }

  private validateQualification(command: QualifyEvidenceCommand) {
    if (!this.qualificationStates.has(command.validation_status)) {
      throw new BadRequestException("Invalid validation_status");
    }
    if (!this.decisionFitness.has(command.decision_fitness)) {
      throw new BadRequestException("Invalid decision_fitness");
    }
    if (!["A", "B", "C"].includes(command.confidence_class)) {
      throw new BadRequestException("confidence_class must be A, B or C");
    }
    this.requireText(command.rationale, "rationale");
  }

  private ensureVersion(current: string, expected: number) {
    const version = Number(current);
    if (version !== expected) {
      throw new ConflictException({
        code: "QAS-VERSION-CONFLICT",
        requested_version: expected,
        current_version: version,
      });
    }
  }

  private async recordDenied(
    actor: AuthenticatedActor,
    tenantId: string,
    objectType: string,
    objectId: string,
    correlationId: string,
    attemptedAction: string,
    reason: string,
  ) {
    await this.database.transaction((client) =>
      this.events.write(client, {
        eventType: "AccessDenied",
        objectType,
        objectId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId,
        correlationId,
        payload: {
          attempted_action: attemptedAction,
          reason,
        },
      }),
    );
  }

  private async idempotentResult(
    client: PoolClient,
    actorId: string,
    commandType: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await client.query<IdempotencyRow>(
      `SELECT request_hash, result_payload
         FROM qassas_core.command_idempotency
        WHERE actor_id = $1
          AND command_type = $2
          AND idempotency_key = $3`,
      [actorId, commandType, idempotencyKey],
    );
    const existing = result.rows[0];
    if (!existing) return null;
    if (existing.request_hash !== requestHash) {
      throw new ConflictException({ code: "QAS-IDEMPOTENCY-CONFLICT" });
    }
    return existing.result_payload;
  }

  private async storeIdempotency(
    client: PoolClient,
    actorId: string,
    commandType: string,
    idempotencyKey: string,
    requestHash: string,
    resultPayload: Record<string, unknown>,
  ) {
    await client.query(
      `INSERT INTO qassas_core.command_idempotency (
         actor_id, command_type, idempotency_key, request_hash, result_payload
       ) VALUES ($1,$2,$3,$4,$5)`,
      [actorId, commandType, idempotencyKey, requestHash, resultPayload],
    );
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private requireText(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
  }

  private actorRole(actor: AuthenticatedActor) {
    return actor.roleAssignments[0]?.roleType ?? null;
  }

  private evidenceView(evidence: EvidenceRow) {
    return {
      evidence_id: evidence.evidence_id,
      target_id: evidence.target_id,
      evidence_class: evidence.evidence_class,
      source_system: evidence.source_system,
      source_object_id: evidence.source_object_id,
      source_org: evidence.source_org,
      source_type: evidence.source_type,
      source_date: evidence.source_date?.toISOString() ?? null,
      version_label: evidence.version_label,
      observation: evidence.observation,
      qa_qc_status: evidence.qa_qc_status,
      validation_status: evidence.validation_status,
      decision_fitness: evidence.decision_fitness,
      security_class: evidence.security_class,
      current_state: evidence.current_state,
      object_version: Number(evidence.object_version),
      created_by_user_id: evidence.created_by_user_id,
      created_at: evidence.created_at.toISOString(),
      updated_at: evidence.updated_at.toISOString(),
    };
  }
}
