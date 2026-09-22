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
  AddLicencePartyRoleCommand,
  CreateWorkCommitmentCommand,
  DefineJVConstraintCommand,
  RecordJVConsentCommand,
  RegisterLicenceCommand,
  UpdateWorkCommitmentCommand,
} from "./rights.types";

interface AssetContextRow {
  enterprise_id: string;
  asset_id: string;
  security_class: string;
}

interface LicenceRow {
  licence_id: string;
  enterprise_id: string;
  licence_number: string;
  licence_type: string;
  licence_status: string;
  issue_date: Date | null;
  expiry_date: Date | null;
  transfer_status: string | null;
  validation_status: string;
  source_instrument: string | null;
  security_class: string;
  object_version: string;
  created_at: Date;
}

interface PartyRoleRow {
  party_role_id: string;
  party_name: string;
  role_type: string;
  economic_interest_percentage: string | null;
  source_instrument: string | null;
  created_at: Date;
}

interface JVConstraintRow {
  constraint_id: string;
  jv_id: string;
  licence_id: string;
  decision_class: string | null;
  partner_name: string;
  reserved_matter: string;
  consent_required: boolean;
  voting_threshold: string | null;
  source_instrument: string | null;
  created_at: Date;
}

interface ConsentRow {
  consent_event_id: string;
  constraint_id: string;
  consent_status: string;
  effective_until: Date | null;
  rationale: string;
  recorded_by_user_id: string;
  recorded_at: Date;
}

interface CommitmentRow {
  commitment_id: string;
  licence_id: string;
  description: string;
  due_date: Date;
  mandatory: boolean;
  cost_class: string | null;
  status: string;
  object_version: string;
  created_at: Date;
  updated_at: Date;
}

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

@Injectable()
export class RightsRegistryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly events: AuditEventWriter,
  ) {}

  async registerLicence(
    actor: AuthenticatedActor,
    command: RegisterLicenceCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.licence_id, "licence_id");
    this.requireText(command.licence_number, "licence_number");
    this.requireText(command.licence_type, "licence_type");

    const context = await this.requireKnownAsset(command.licence_id);
    await this.authorize(
      actor,
      "register_licence",
      command.licence_id,
      null,
      context,
      correlationId,
    );

    const requestHash = this.hash(command);
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "RegisterLicence",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const duplicate = await client.query<{ licence_id: string }>(
        `SELECT licence_id
           FROM qassas_core.licence_register
          WHERE licence_id = $1
          LIMIT 1`,
        [command.licence_id],
      );
      if (duplicate.rowCount) {
        throw new ConflictException({
          code: "QAS-LICENCE-ALREADY-REGISTERED",
          licence_id: command.licence_id,
        });
      }

      await client.query(
        `INSERT INTO qassas_core.licence_register (
           licence_id, enterprise_id, licence_number, licence_type,
           licence_status, issue_date, expiry_date, transfer_status,
           validation_status, source_instrument, security_class,
           created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          command.licence_id,
          context.enterprise_id,
          command.licence_number,
          command.licence_type,
          command.licence_status,
          command.issue_date ?? null,
          command.expiry_date ?? null,
          command.transfer_status ?? null,
          command.validation_status,
          command.source_instrument ?? null,
          context.security_class,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "LicenceRegistered",
        objectType: "Licence",
        objectId: command.licence_id,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        previousState: null,
        newState: command.licence_status,
        payload: {
          licence_number: command.licence_number,
          licence_type: command.licence_type,
          validation_status: command.validation_status,
          transfer_status: command.transfer_status ?? null,
        },
      });

      const result = {
        licence_id: command.licence_id,
        enterprise_id: context.enterprise_id,
        licence_number: command.licence_number,
        licence_status: command.licence_status,
        validation_status: command.validation_status,
        object_version: 1,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "RegisterLicence",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async getLicence(
    licenceId: string,
    actor: AuthenticatedActor,
    jvId?: string | null,
  ) {
    const licence = await this.requireLicence(licenceId);
    const context = await this.requireKnownAsset(licenceId);
    await this.authorize(
      actor,
      "read_rights",
      licenceId,
      jvId ?? null,
      context,
      `CORR-READ-${randomUUID()}`,
      false,
    );

    const [roles, constraints, commitments] = await Promise.all([
      this.database.query<PartyRoleRow>(
        `SELECT party_role_id, party_name, role_type,
                economic_interest_percentage, source_instrument, created_at
           FROM qassas_core.licence_party_role
          WHERE licence_id = $1
          ORDER BY created_at, party_role_id`,
        [licenceId],
      ),
      this.database.query<JVConstraintRow>(
        `SELECT constraint_id, jv_id, licence_id, decision_class,
                partner_name, reserved_matter, consent_required,
                voting_threshold, source_instrument, created_at
           FROM qassas_core.jv_constraint
          WHERE licence_id = $1
          ORDER BY created_at, constraint_id`,
        [licenceId],
      ),
      this.database.query<CommitmentRow>(
        `SELECT commitment_id, licence_id, description, due_date,
                mandatory, cost_class, status, object_version,
                created_at, updated_at
           FROM qassas_core.work_commitment
          WHERE licence_id = $1
          ORDER BY due_date, commitment_id`,
        [licenceId],
      ),
    ]);

    const constraintViews = [];
    for (const constraint of constraints.rows) {
      if (
        actor.roleAssignments.some((role) => role.roleType === "PARTNER_USER") &&
        constraint.jv_id !== jvId
      ) {
        continue;
      }

      const latest = await this.latestConsent(constraint.constraint_id);
      constraintViews.push({
        constraint_id: constraint.constraint_id,
        jv_id: constraint.jv_id,
        decision_class: constraint.decision_class,
        partner_name: constraint.partner_name,
        reserved_matter: constraint.reserved_matter,
        consent_required: constraint.consent_required,
        voting_threshold: constraint.voting_threshold,
        source_instrument: constraint.source_instrument,
        latest_consent: latest
          ? {
              consent_event_id: latest.consent_event_id,
              consent_status: this.effectiveConsentStatus(latest),
              effective_until: latest.effective_until?.toISOString() ?? null,
              rationale: latest.rationale,
              recorded_by_user_id: latest.recorded_by_user_id,
              recorded_at: latest.recorded_at.toISOString(),
            }
          : null,
      });
    }

    return {
      licence_id: licence.licence_id,
      enterprise_id: licence.enterprise_id,
      licence_number: licence.licence_number,
      licence_type: licence.licence_type,
      licence_status: licence.licence_status,
      issue_date: licence.issue_date?.toISOString().slice(0, 10) ?? null,
      expiry_date: licence.expiry_date?.toISOString().slice(0, 10) ?? null,
      transfer_status: licence.transfer_status,
      validation_status: licence.validation_status,
      source_instrument: licence.source_instrument,
      security_class: licence.security_class,
      object_version: Number(licence.object_version),
      party_roles: roles.rows.map((row) => ({
        party_role_id: row.party_role_id,
        party_name: row.party_name,
        role_type: row.role_type,
        economic_interest_percentage:
          row.economic_interest_percentage === null
            ? null
            : Number(row.economic_interest_percentage),
        source_instrument: row.source_instrument,
      })),
      jv_constraints: constraintViews,
      work_commitments: commitments.rows.map((row) =>
        this.commitmentView(row),
      ),
    };
  }

  async addPartyRole(
    licenceId: string,
    actor: AuthenticatedActor,
    command: AddLicencePartyRoleCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.party_name, "party_name");
    const context = await this.requireKnownAsset(licenceId);
    await this.requireLicence(licenceId);
    await this.authorize(
      actor,
      "add_party_role",
      licenceId,
      null,
      context,
      correlationId,
    );

    if (
      command.economic_interest_percentage != null &&
      (command.economic_interest_percentage < 0 ||
        command.economic_interest_percentage > 100)
    ) {
      throw new BadRequestException(
        "economic_interest_percentage must be between 0 and 100",
      );
    }

    const requestHash = this.hash({ licenceId, ...command });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "AddLicencePartyRole",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const partyRoleId = `LPR-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.licence_party_role (
           party_role_id, licence_id, party_name, role_type,
           economic_interest_percentage, source_instrument,
           created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          partyRoleId,
          licenceId,
          command.party_name,
          command.role_type,
          command.economic_interest_percentage ?? null,
          command.source_instrument ?? null,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "LicencePartyRoleAdded",
        objectType: "Licence",
        objectId: licenceId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          party_role_id: partyRoleId,
          party_name: command.party_name,
          role_type: command.role_type,
          economic_interest_percentage:
            command.economic_interest_percentage ?? null,
        },
      });

      const result = {
        party_role_id: partyRoleId,
        licence_id: licenceId,
        party_name: command.party_name,
        role_type: command.role_type,
        economic_interest_percentage:
          command.economic_interest_percentage ?? null,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "AddLicencePartyRole",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async defineJVConstraint(
    licenceId: string,
    actor: AuthenticatedActor,
    command: DefineJVConstraintCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.jv_id, "jv_id");
    this.requireText(command.partner_name, "partner_name");
    this.requireText(command.reserved_matter, "reserved_matter");
    const context = await this.requireKnownAsset(licenceId);
    await this.requireLicence(licenceId);
    await this.authorize(
      actor,
      "define_jv_constraint",
      licenceId,
      command.jv_id,
      context,
      correlationId,
    );

    const requestHash = this.hash({ licenceId, ...command });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "DefineJVConstraint",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const constraintId = `JVC-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.jv_constraint (
           constraint_id, jv_id, licence_id, decision_class,
           partner_name, reserved_matter, consent_required,
           voting_threshold, source_instrument, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          constraintId,
          command.jv_id,
          licenceId,
          command.decision_class ?? null,
          command.partner_name,
          command.reserved_matter,
          command.consent_required ?? true,
          command.voting_threshold ?? null,
          command.source_instrument ?? null,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "JVConstraintDefined",
        objectType: "JVConstraint",
        objectId: constraintId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          licence_id: licenceId,
          jv_id: command.jv_id,
          decision_class: command.decision_class ?? null,
          reserved_matter: command.reserved_matter,
          consent_required: command.consent_required ?? true,
        },
      });

      const result = {
        constraint_id: constraintId,
        licence_id: licenceId,
        jv_id: command.jv_id,
        consent_required: command.consent_required ?? true,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "DefineJVConstraint",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async recordConsent(
    constraintId: string,
    actor: AuthenticatedActor,
    command: RecordJVConsentCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.rationale, "rationale");
    const constraint = await this.requireConstraint(constraintId);
    const context = await this.requireKnownAsset(constraint.licence_id);

    await this.authorize(
      actor,
      "record_consent",
      constraint.licence_id,
      constraint.jv_id,
      context,
      correlationId,
    );

    const requestHash = this.hash({ constraintId, ...command });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "RecordJVConsent",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const consentEventId = `JCE-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.jv_consent_event (
           consent_event_id, constraint_id, consent_status,
           effective_until, rationale, recorded_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          consentEventId,
          constraintId,
          command.consent_status,
          command.effective_until ?? null,
          command.rationale,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "JVConsentRecorded",
        objectType: "JVConstraint",
        objectId: constraintId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          consent_event_id: consentEventId,
          licence_id: constraint.licence_id,
          jv_id: constraint.jv_id,
          consent_status: command.consent_status,
          effective_until: command.effective_until ?? null,
        },
      });

      const result = {
        consent_event_id: consentEventId,
        constraint_id: constraintId,
        jv_id: constraint.jv_id,
        consent_status: command.consent_status,
        effective_until: command.effective_until ?? null,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "RecordJVConsent",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async createWorkCommitment(
    licenceId: string,
    actor: AuthenticatedActor,
    command: CreateWorkCommitmentCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.description, "description");
    this.requireText(command.due_date, "due_date");
    const context = await this.requireKnownAsset(licenceId);
    await this.requireLicence(licenceId);
    await this.authorize(
      actor,
      "create_work_commitment",
      licenceId,
      null,
      context,
      correlationId,
    );

    const requestHash = this.hash({ licenceId, ...command });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "CreateWorkCommitment",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const commitmentId = `WCM-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.work_commitment (
           commitment_id, licence_id, description, due_date,
           mandatory, cost_class, status, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          commitmentId,
          licenceId,
          command.description,
          command.due_date,
          command.mandatory ?? true,
          command.cost_class ?? null,
          command.status ?? "OPEN",
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "WorkCommitmentCreated",
        objectType: "WorkCommitment",
        objectId: commitmentId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        previousState: null,
        newState: command.status ?? "OPEN",
        payload: {
          licence_id: licenceId,
          due_date: command.due_date,
          mandatory: command.mandatory ?? true,
          cost_class: command.cost_class ?? null,
        },
      });

      const result = {
        commitment_id: commitmentId,
        licence_id: licenceId,
        due_date: command.due_date,
        mandatory: command.mandatory ?? true,
        status: command.status ?? "OPEN",
        object_version: 1,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "CreateWorkCommitment",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async updateWorkCommitment(
    commitmentId: string,
    actor: AuthenticatedActor,
    command: UpdateWorkCommitmentCommand,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.rationale, "rationale");
    const current = await this.requireCommitment(commitmentId);
    const context = await this.requireKnownAsset(current.licence_id);

    await this.authorize(
      actor,
      "update_work_commitment",
      current.licence_id,
      null,
      context,
      correlationId,
    );

    const requestHash = this.hash({
      commitmentId,
      expectedVersion,
      ...command,
    });

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "UpdateWorkCommitment",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const locked = await client.query<CommitmentRow>(
        `SELECT commitment_id, licence_id, description, due_date,
                mandatory, cost_class, status, object_version,
                created_at, updated_at
           FROM qassas_core.work_commitment
          WHERE commitment_id = $1
          FOR UPDATE`,
        [commitmentId],
      );
      const row = locked.rows[0];
      if (!row) throw new NotFoundException();
      if (Number(row.object_version) !== expectedVersion) {
        throw new ConflictException({
          code: "QAS-VERSION-CONFLICT",
          requested_version: expectedVersion,
          current_version: Number(row.object_version),
        });
      }

      const nextVersion = expectedVersion + 1;
      await client.query(
        `UPDATE qassas_core.work_commitment
            SET status = $2,
                object_version = $3,
                updated_at = now()
          WHERE commitment_id = $1`,
        [commitmentId, command.status, nextVersion],
      );

      await this.events.write(client, {
        eventType: "WorkCommitmentStatusChanged",
        objectType: "WorkCommitment",
        objectId: commitmentId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        previousState: row.status,
        newState: command.status,
        payload: {
          licence_id: row.licence_id,
          rationale: command.rationale,
        },
      });

      const result = {
        commitment_id: commitmentId,
        licence_id: row.licence_id,
        status: command.status,
        object_version: nextVersion,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "UpdateWorkCommitment",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  private async requireKnownAsset(assetId: string): Promise<AssetContextRow> {
    const result = await this.database.query<AssetContextRow>(
      `SELECT enterprise_id, asset_id, security_class
         FROM qassas_core.target
        WHERE asset_id = $1
        ORDER BY target_id
        LIMIT 1`,
      [assetId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return row;
  }

  private async requireLicence(licenceId: string): Promise<LicenceRow> {
    const result = await this.database.query<LicenceRow>(
      `SELECT licence_id, enterprise_id, licence_number, licence_type,
              licence_status, issue_date, expiry_date, transfer_status,
              validation_status, source_instrument, security_class,
              object_version, created_at
         FROM qassas_core.licence_register
        WHERE licence_id = $1
        LIMIT 1`,
      [licenceId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return row;
  }

  private async requireConstraint(constraintId: string): Promise<JVConstraintRow> {
    const result = await this.database.query<JVConstraintRow>(
      `SELECT constraint_id, jv_id, licence_id, decision_class,
              partner_name, reserved_matter, consent_required,
              voting_threshold, source_instrument, created_at
         FROM qassas_core.jv_constraint
        WHERE constraint_id = $1
        LIMIT 1`,
      [constraintId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return row;
  }

  private async requireCommitment(commitmentId: string): Promise<CommitmentRow> {
    const result = await this.database.query<CommitmentRow>(
      `SELECT commitment_id, licence_id, description, due_date,
              mandatory, cost_class, status, object_version,
              created_at, updated_at
         FROM qassas_core.work_commitment
        WHERE commitment_id = $1
        LIMIT 1`,
      [commitmentId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return row;
  }

  private async latestConsent(constraintId: string): Promise<ConsentRow | null> {
    const result = await this.database.query<ConsentRow>(
      `SELECT consent_event_id, constraint_id, consent_status,
              effective_until, rationale, recorded_by_user_id, recorded_at
         FROM qassas_core.jv_consent_event
        WHERE constraint_id = $1
        ORDER BY recorded_at DESC, consent_event_id DESC
        LIMIT 1`,
      [constraintId],
    );
    return result.rows[0] ?? null;
  }

  private effectiveConsentStatus(consent: ConsentRow): string {
    if (
      consent.effective_until &&
      consent.effective_until.getTime() < Date.now() &&
      consent.consent_status === "APPROVED"
    ) {
      return "EXPIRED";
    }
    return consent.consent_status;
  }

  private commitmentView(row: CommitmentRow) {
    return {
      commitment_id: row.commitment_id,
      description: row.description,
      due_date: row.due_date.toISOString().slice(0, 10),
      mandatory: row.mandatory,
      cost_class: row.cost_class,
      status: row.status,
      object_version: Number(row.object_version),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  private async authorize(
    actor: AuthenticatedActor,
    action:
      | "register_licence"
      | "add_party_role"
      | "define_jv_constraint"
      | "record_consent"
      | "create_work_commitment"
      | "update_work_commitment"
      | "read_rights",
    assetId: string,
    jvId: string | null,
    context: AssetContextRow,
    correlationId: string,
    auditDenied = true,
  ) {
    const decision = await this.policy.canActOnRights(actor, action, {
      assetId,
      jvId,
    });
    if (decision.allow) return;

    if (auditDenied) {
      await this.database.transaction((client) =>
        this.events.write(client, {
          eventType: "AccessDenied",
          objectType: "Licence",
          objectId: assetId,
          objectVersion: 1,
          actorId: actor.userId,
          actorRole: this.actorRole(actor),
          tenantId: context.enterprise_id,
          correlationId,
          payload: {
            attempted_action: action,
            jv_id: jvId,
            reason: decision.reason,
          },
        }),
      );
    }
    throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });
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
}
