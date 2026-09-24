import { Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface PortfolioRow {
  portfolio_id: string;
  portfolio_name: string;
  portfolio_kind: string;
  public_asset_count: number | null;
  asset_count_basis: string | null;
  scale_class: string;
  portfolio_status: string;
  institution_id: string;
  enterprise_id: string;
  legal_name: string;
  display_name: string;
  country_code: string;
  institution_kind: string;
  public_identity_status: string;
  account_id: string | null;
  account_name: string | null;
  iam_binding_status: string | null;
  account_status: string | null;
  public_source_count: number;
  private_source_count: number;
  term_sheet_required_count: number;
}

interface SourceRow {
  source_id: string;
  source_name: string;
  source_authority: string;
  source_class: string;
  acquisition_mode: string;
  source_url: string | null;
  data_domains: string[];
  connector_status: string;
  access_basis: string;
  access_status: string;
  allowed_domains: string[];
  provenance_requirement: string;
}

@Injectable()
export class InstitutionalPortfolioService {
  constructor(private readonly database: DatabaseService) {}

  async list(actor: AuthenticatedActor) {
    const visible = await this.visibleEnterpriseIds(actor);
    const rows = await this.directoryRows(visible);

    return {
      interface: "INSTITUTIONAL_PORTFOLIO_DIRECTORY",
      tenancy_model: "INSTITUTION_ISOLATED",
      institution_count: rows.length,
      portfolios: rows.map((row) => this.view(row)),
    };
  }

  async get(portfolioId: string, actor: AuthenticatedActor) {
    const visible = await this.visibleEnterpriseIds(actor);
    const rows = await this.directoryRows(visible, portfolioId);
    if (rows.length === 0) throw new NotFoundException();
    return this.view(rows[0]);
  }

  async dataSources(portfolioId: string, actor: AuthenticatedActor) {
    const portfolio = await this.get(portfolioId, actor);
    const result = await this.database.query<SourceRow>(
      `SELECT
         r.source_id,
         r.source_name,
         r.source_authority,
         r.source_class,
         r.acquisition_mode,
         r.source_url,
         r.data_domains,
         r.connector_status,
         s.access_basis,
         s.access_status,
         s.allowed_domains,
         s.provenance_requirement
       FROM qassas_core.portfolio_data_source s
       JOIN qassas_core.data_source_registry r
         ON r.source_id = s.source_id
       WHERE s.portfolio_id = $1
       ORDER BY
         CASE r.source_class
           WHEN 'PUBLIC_SOVEREIGN' THEN 1
           WHEN 'PUBLIC_REGULATORY' THEN 2
           ELSE 3
         END,
         r.source_id`,
      [portfolioId],
    );

    return {
      portfolio_id: portfolioId,
      institution_id: portfolio.institution.institution_id,
      pipeline_policy: {
        public_sources_may_feed_qassas: true,
        private_sources_require_contractual_basis: true,
        source_provenance_required: true,
        automated_decision_authority: false,
      },
      sources: result.rows,
    };
  }

  private async visibleEnterpriseIds(actor: AuthenticatedActor): Promise<string[] | null> {
    if (actor.roleAssignments.some((role) => role.roleType === "SYSTEM_ADMIN")) {
      return null;
    }

    const result = await this.database.query<{ enterprise_id: string }>(
      `SELECT DISTINCT i.enterprise_id
       FROM qassas_security.institution_membership m
       JOIN qassas_core.institution i
         ON i.institution_id = m.institution_id
       WHERE m.user_id = $1
         AND m.status = 'ACTIVE'
         AND m.effective_from <= now()
         AND (m.effective_to IS NULL OR m.effective_to > now())
       ORDER BY i.enterprise_id`,
      [actor.userId],
    );

    return result.rows.map((row) => row.enterprise_id);
  }

  private async directoryRows(
    enterpriseIds: string[] | null,
    portfolioId?: string,
  ): Promise<PortfolioRow[]> {
    const clauses: string[] = ["portfolio_status IN ('ONBOARDING','ACTIVE')"];
    const values: unknown[] = [];

    if (enterpriseIds !== null) {
      values.push(enterpriseIds);
      clauses.push(`enterprise_id = ANY($${values.length}::text[])`);
    }

    if (portfolioId) {
      values.push(portfolioId);
      clauses.push(`portfolio_id = $${values.length}`);
    }

    const result = await this.database.query<PortfolioRow>(
      `SELECT *
       FROM qassas_core.institution_portfolio_directory
       WHERE ${clauses.join(" AND ")}
       ORDER BY
         CASE scale_class
           WHEN 'ENTERPRISE' THEN 1
           WHEN 'LARGE_PORTFOLIO' THEN 2
           WHEN 'PORTFOLIO' THEN 3
           WHEN 'FOCUSED' THEN 4
           ELSE 5
         END,
         display_name`,
      values,
    );

    return result.rows;
  }

  private view(row: PortfolioRow) {
    return {
      portfolio_id: row.portfolio_id,
      portfolio_name: row.portfolio_name,
      portfolio_kind: row.portfolio_kind,
      portfolio_status: row.portfolio_status,
      scale: {
        class: row.scale_class,
        public_asset_count: row.public_asset_count,
        count_basis: row.asset_count_basis,
      },
      institution: {
        institution_id: row.institution_id,
        enterprise_id: row.enterprise_id,
        legal_name: row.legal_name,
        display_name: row.display_name,
        country_code: row.country_code,
        kind: row.institution_kind,
        identity_status: row.public_identity_status,
      },
      institutional_account: {
        account_id: row.account_id,
        account_name: row.account_name,
        iam_binding_status: row.iam_binding_status,
        status: row.account_status,
        login_enabled: row.iam_binding_status === "BOUND" && row.account_status === "ACTIVE",
      },
      data_readiness: {
        public_source_count: Number(row.public_source_count ?? 0),
        private_source_count: Number(row.private_source_count ?? 0),
        term_sheet_required_count: Number(row.term_sheet_required_count ?? 0),
      },
      ui_profile: this.uiProfile(row.scale_class),
    };
  }

  private uiProfile(scaleClass: string) {
    switch (scaleClass) {
      case "FOCUSED":
        return {
          shell: "ASSET_CENTRIC",
          primary_surface: "MAP_AND_DECISION_LANE",
          navigation: "COMPACT",
          virtualized_asset_grid: false,
        };
      case "PORTFOLIO":
        return {
          shell: "PORTFOLIO_CONTROL",
          primary_surface: "CONTROL_BOARD",
          navigation: "PORTFOLIO_FILTERS",
          virtualized_asset_grid: false,
        };
      case "LARGE_PORTFOLIO":
      case "ENTERPRISE":
        return {
          shell: "ENTERPRISE_PORTFOLIO",
          primary_surface: "HEATMAP_MAP_AND_PRIORITY_QUEUE",
          navigation: "HIERARCHICAL_FILTERS",
          virtualized_asset_grid: true,
        };
      default:
        return {
          shell: "ADAPTIVE_ONBOARDING",
          primary_surface: "SOURCE_COVERAGE_AND_ASSET_DISCOVERY",
          navigation: "DISCOVERY_FIRST",
          virtualized_asset_grid: false,
        };
    }
  }
}
