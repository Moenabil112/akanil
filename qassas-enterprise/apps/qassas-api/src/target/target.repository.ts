import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

export interface TargetRecord {
  targetId: string;
  enterpriseId: string;
  prospectId: string | null;
  assetId: string;
  name: string;
  currentGate: string;
  operationalState: string;
  targetStatus: string;
  securityClass: string;
  version: number;
}

interface TargetRow {
  target_id: string;
  enterprise_id: string;
  prospect_id: string | null;
  asset_id: string | null;
  name: string;
  current_gate: string;
  operational_state: string;
  target_status: string;
  security_class: string;
  version: string;
}

@Injectable()
export class TargetRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(targetId: string): Promise<TargetRecord | null> {
    const result = await this.database.query<TargetRow>(
      `SELECT target_id, enterprise_id, prospect_id, asset_id, name,
              current_gate, operational_state, target_status,
              security_class, version
         FROM qassas_core.target
        WHERE target_id = $1
        LIMIT 1`,
      [targetId],
    );

    if (!result.rowCount || !result.rows[0].asset_id) {
      return null;
    }

    const row = result.rows[0];
    return {
      targetId: row.target_id,
      enterpriseId: row.enterprise_id,
      prospectId: row.prospect_id,
      assetId: row.asset_id,
      name: row.name,
      currentGate: row.current_gate,
      operationalState: row.operational_state,
      targetStatus: row.target_status,
      securityClass: row.security_class,
      version: Number(row.version),
    };
  }
}
