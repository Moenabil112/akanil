import {
  actorFromToken,
  clearSession,
  getAccessToken,
  handleCallback,
  startLogin,
} from "./auth.js";
import { QassasApi } from "./api.js";

const config = window.QASSAS_CONFIG;
const api = new QassasApi(config.apiBaseUrl, getAccessToken);

const el = (id) => document.getElementById(id);

const state = {
  portfolios: [],
  selectedPortfolioId: null,
  selectedPortfolio: null,
  pipeline: null,
  assets: [],
  assetFilter: "",
};

function showError(message) {
  const banner = el("error-banner");
  banner.textContent = message;
  banner.hidden = false;
}

function clearError() {
  el("error-banner").hidden = true;
}

function showAuth() {
  el("auth-screen").hidden = false;
  el("workspace").hidden = true;
  el("logout-button").hidden = true;
}

function showWorkspace() {
  el("auth-screen").hidden = true;
  el("workspace").hidden = false;
  el("logout-button").hidden = false;
}

function setText(id, value) {
  el(id).textContent = value ?? "—";
}

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

function statusTone(value) {
  const normalized = String(value || "").toUpperCase();
  if (["ACTIVE", "AVAILABLE", "CONNECTED", "PUBLIC_VERIFIED", "PARTNER_VERIFIED"].includes(normalized)) {
    return "good";
  }
  if (["TERM_SHEET_REQUIRED", "CONFIG_REQUIRED", "DISCOVERY_REQUIRED", "ONBOARDING"].includes(normalized)) {
    return "warn";
  }
  return "neutral";
}

function pill(label, tone = "neutral") {
  return `<span class="pill tone-${tone}">${escapeHtml(label)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadDirectory() {
  const directory = await api.portfolios();
  state.portfolios = directory.portfolios || [];

  if (state.portfolios.length === 0) {
    throw new Error("No institutional portfolios are visible to this identity.");
  }

  const select = el("portfolio-select");
  select.innerHTML = state.portfolios
    .map(
      (portfolio) =>
        `<option value="${escapeHtml(portfolio.portfolio_id)}">${escapeHtml(
          portfolio.institution.display_name,
        )} — ${escapeHtml(portfolio.portfolio_name)}</option>`,
    )
    .join("");

  const remembered = sessionStorage.getItem("qassas.workbench.portfolio_id");
  const initial = state.portfolios.some((p) => p.portfolio_id === remembered)
    ? remembered
    : state.portfolios[0].portfolio_id;

  select.value = initial;
  await loadPortfolio(initial);
}

async function loadPortfolio(portfolioId) {
  clearError();
  state.selectedPortfolioId = portfolioId;
  sessionStorage.setItem("qassas.workbench.portfolio_id", portfolioId);

  const [portfolio, pipeline, assets] = await Promise.all([
    api.portfolio(portfolioId),
    api.pipelineStatus(portfolioId),
    api.assets(portfolioId),
  ]);

  state.selectedPortfolio = portfolio;
  state.pipeline = pipeline;
  state.assets = assets.assets || [];

  renderPortfolio();
}

function renderPortfolio() {
  const p = state.selectedPortfolio;
  const pipeline = state.pipeline;

  setText("institution-kind", humanize(p.institution.kind));
  setText("institution-name", p.institution.display_name);
  setText("portfolio-name", p.portfolio_name);
  setText("scale-badge", humanize(p.scale.class));
  setText("portfolio-status", humanize(p.portfolio_status));
  setText("identity-status", humanize(p.institution.identity_status));

  el("scale-badge").dataset.tone = statusTone(p.scale.class);
  el("portfolio-status").dataset.tone = statusTone(p.portfolio_status);
  el("identity-status").dataset.tone = statusTone(p.institution.identity_status);

  setText(
    "metric-public-assets",
    p.scale.public_asset_count === null ? "Discovering" : p.scale.public_asset_count,
  );
  setText("metric-count-basis", humanize(p.scale.count_basis || "Not locked"));
  setText("metric-discovered-assets", state.assets.length);
  setText("metric-public-sources", p.data_readiness.public_source_count);
  setText("metric-term-sheet", p.data_readiness.term_sheet_required_count);

  renderAdaptiveSurface(p);
  renderAssets();
  renderSources(pipeline);
  renderPartnerLayer(p, pipeline);
}

function renderAdaptiveSurface(portfolio) {
  const profile = portfolio.ui_profile;
  const body = el("surface-body");
  setText("surface-mode", humanize(profile.shell));
  setText("surface-title", humanize(profile.primary_surface));

  const assets = state.assets;
  const regionCounts = new Map();
  for (const asset of assets) {
    const key = asset.region || "Unclassified";
    regionCounts.set(key, (regionCounts.get(key) || 0) + 1);
  }

  if (profile.shell === "ADAPTIVE_ONBOARDING") {
    body.innerHTML = `
      <div class="onboarding-grid">
        <article class="surface-card">
          <span class="surface-kicker">Asset universe</span>
          <strong>${assets.length}</strong>
          <p>Public records discovered and normalized so far.</p>
        </article>
        <article class="surface-card">
          <span class="surface-kicker">Next control</span>
          <strong>Source coverage</strong>
          <p>Expand Taadeen / NGD coverage before portfolio scoring.</p>
        </article>
        <article class="surface-card locked">
          <span class="surface-kicker">Private context</span>
          <strong>Term Sheet</strong>
          <p>Commercial, JV and internal datasets remain contract-gated.</p>
        </article>
      </div>
    `;
    return;
  }

  if (profile.shell === "LARGE_PORTFOLIO" || profile.shell === "ENTERPRISE_PORTFOLIO") {
    const heatCells = assets.slice(0, 60).map((asset, index) => {
      const intensity = 1 + (index % 5);
      return `<button class="heat-cell heat-${intensity}" title="${escapeHtml(asset.asset_name)}" type="button">
        <span>${escapeHtml(asset.external_licence_number || asset.asset_id.slice(-6))}</span>
      </button>`;
    }).join("");

    body.innerHTML = `
      <div class="large-surface">
        <div class="heatmap" aria-label="Portfolio asset heatmap">
          ${heatCells || '<div class="empty-inline">Assets will appear here as source records are ingested.</div>'}
        </div>
        <div class="region-stack">
          ${[...regionCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([region, count]) => `<div class="region-row"><span>${escapeHtml(region)}</span><strong>${count}</strong></div>`)
            .join("") || '<div class="empty-inline">No region distribution available yet.</div>'}
        </div>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="portfolio-surface">
      <div class="map-placeholder">
        <div class="map-grid"></div>
        <div class="map-caption">
          <strong>${assets.length} visible assets</strong>
          <span>Geometry renders here when coordinates are ingested.</span>
        </div>
      </div>
      <div class="region-stack">
        ${[...regionCounts.entries()]
          .map(([region, count]) => `<div class="region-row"><span>${escapeHtml(region)}</span><strong>${count}</strong></div>`)
          .join("") || '<div class="empty-inline">No region distribution available yet.</div>'}
      </div>
    </div>
  `;
}

function renderAssets() {
  const query = state.assetFilter.trim().toLowerCase();
  const assets = state.assets.filter((asset) => {
    if (!query) return true;
    return [
      asset.asset_name,
      asset.asset_type,
      asset.external_licence_number,
      asset.region,
      ...(asset.mineral_classes || []),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const wrap = el("asset-table-wrap");
  if (assets.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <strong>No matching Asset Records</strong>
        <span>Public ingestion populates this registry before any Target promotion.</span>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Asset</th>
          <th>Type</th>
          <th>Licence / ID</th>
          <th>Region</th>
          <th>Area km²</th>
          <th>Source</th>
          <th>Master status</th>
        </tr>
      </thead>
      <tbody>
        ${assets.slice(0, 250).map((asset) => `
          <tr>
            <td><strong>${escapeHtml(asset.asset_name)}</strong></td>
            <td>${escapeHtml(humanize(asset.asset_type))}</td>
            <td>${escapeHtml(asset.external_licence_number || asset.asset_id)}</td>
            <td>${escapeHtml(asset.region || "—")}</td>
            <td>${asset.area_km2 ?? "—"}</td>
            <td>${escapeHtml(asset.source_of_record_id || "—")}</td>
            <td>${pill(humanize(asset.master_data_status), statusTone(asset.master_data_status))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderSources(pipeline) {
  const grid = el("source-grid");
  grid.innerHTML = (pipeline.sources || []).map((source) => {
    const latest = source.latest_run;
    const adapterSummary = (source.adapters || [])
      .map((adapter) => `${humanize(adapter.adapter_kind)} · ${humanize(adapter.status)}`)
      .join("<br />");

    return `
      <article class="source-card">
        <div class="source-card-top">
          <div>
            <span class="source-authority">${escapeHtml(source.authority)}</span>
            <h3>${escapeHtml(source.source_name)}</h3>
          </div>
          ${pill(humanize(source.access_status), statusTone(source.access_status))}
        </div>
        <dl class="definition-list">
          <div><dt>Class</dt><dd>${escapeHtml(humanize(source.source_class))}</dd></div>
          <div><dt>Adapters</dt><dd>${source.adapter_count}</dd></div>
          <div><dt>Latest run</dt><dd>${latest ? escapeHtml(humanize(latest.status)) : "Not yet ingested"}</dd></div>
          <div><dt>Records</dt><dd>${latest ? latest.record_count : "—"}</dd></div>
        </dl>
        <div class="adapter-list">${adapterSummary || "No adapter contract"}</div>
      </article>
    `;
  }).join("");
}

function renderPartnerLayer(portfolio, pipeline) {
  const locked = (pipeline.sources || []).filter(
    (source) => source.source_class === "PRIVATE_CONTRACTUAL",
  );
  const container = el("partner-state");

  if (locked.some((source) => source.access_status === "CONNECTED")) {
    container.innerHTML = `
      <div class="partner-connected">
        <div>
          <strong>Private partner source connected</strong>
          <p>Contractual datasets may now be ingested under their allowed domains and security classifications.</p>
        </div>
        ${pill("CONNECTED", "good")}
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="locked-layer">
      <div class="lock-icon" aria-hidden="true">⌁</div>
      <div>
        <strong>Private institutional layer is locked</strong>
        <p>
          Work programmes, private geology, assays, drilling, capital, JV rights,
          commercial terms and internal decisions remain unavailable until the
          institution's Term Sheet / data-sharing basis is activated.
        </p>
      </div>
      ${pill(
        portfolio.data_readiness.term_sheet_required_count > 0
          ? "TERM SHEET REQUIRED"
          : "NO PRIVATE SOURCE",
        "warn",
      )}
    </div>
  `;
}

async function boot() {
  el("release-pill").textContent = config.environmentLabel;

  el("login-button").addEventListener("click", () => startLogin(config));
  el("logout-button").addEventListener("click", () => {
    clearSession();
    window.location.reload();
  });
  el("portfolio-select").addEventListener("change", async (event) => {
    try {
      await loadPortfolio(event.target.value);
    } catch (error) {
      showError(error.message);
    }
  });
  el("asset-search").addEventListener("input", (event) => {
    state.assetFilter = event.target.value;
    renderAssets();
  });

  try {
    await handleCallback(config);
    const token = getAccessToken();
    if (!token) {
      showAuth();
      return;
    }

    const actor = actorFromToken(token);
    setText("actor-name", actor.displayName);
    showWorkspace();
    await loadDirectory();
  } catch (error) {
    if (error?.code === "AUTH_REQUIRED") {
      clearSession();
      showAuth();
      return;
    }
    showError(error instanceof Error ? error.message : String(error));
    if (!getAccessToken()) showAuth();
  }
}

void boot();
