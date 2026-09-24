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
  onboarding: null,
  agreements: [],
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
  el("logout-button").hidden = !getAccessToken();
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

  const portfolio = await api.portfolio(portfolioId);
  const [pipeline, assets, onboarding, agreements] = await Promise.all([
    api.pipelineStatus(portfolioId),
    api.assets(portfolioId),
    api.onboardingStatus(portfolio.institution.institution_id),
    api.agreements(portfolio.institution.institution_id),
  ]);

  state.selectedPortfolio = portfolio;
  state.pipeline = pipeline;
  state.assets = assets.assets || [];
  state.onboarding = onboarding;
  state.agreements = agreements.agreements || [];

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
  renderInstitutionAccess(p, state.onboarding);
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

function renderInstitutionAccess(portfolio, onboarding) {
  const account = onboarding?.account || {};
  const loginEnabled = account.login_enabled === true;

  setText("account-status", humanize(account.status || "UNKNOWN"));
  setText(
    "account-binding-status",
    `Identity binding: ${humanize(account.iam_binding_status || "UNKNOWN")}`,
  );
  setText(
    "primary-admin-status",
    account.primary_admin_user_id ? "BOUND" : "NOT BOUND",
  );
  setText(
    "primary-admin-activated-at",
    account.activated_at
      ? `Activated ${new Date(account.activated_at).toLocaleString()}`
      : "Awaiting verified Keycloak self-claim",
  );
  setText(
    "account-login-state",
    loginEnabled ? "LOGIN ENABLED" : "LOGIN DISABLED",
  );
  el("account-login-state").dataset.tone = loginEnabled ? "good" : "warn";

  const adminCard = el("activation-admin-card");
  adminCard.hidden = loginEnabled;
  if (!loginEnabled) {
    el("admin-activation-email").value = "";
    el("issued-activation-secret").hidden = true;
  }

  adminCard.dataset.institutionId = portfolio.institution.institution_id;
}

async function issueActivationTicket() {
  clearError();
  const card = el("activation-admin-card");
  const institutionId = card.dataset.institutionId;
  const email = el("admin-activation-email").value.trim();
  const expires = Number(el("admin-activation-expiry").value || "48");

  if (!institutionId || !email) {
    showError("Institution and verified administrator email are required.");
    return;
  }

  try {
    const issued = await api.issueAdminActivationTicket(
      institutionId,
      email,
      expires,
    );
    const output = el("issued-activation-secret");
    output.hidden = false;
    output.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = "Activation secret — display once";
    const ticket = document.createElement("code");
    ticket.textContent = issued.ticket_id;
    const secret = document.createElement("code");
    secret.textContent = issued.activation_code;
    const expiry = document.createElement("span");
    expiry.textContent = `Expires: ${new Date(issued.expires_at).toLocaleString()}`;
    output.append(title, ticket, secret, expiry);
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
}

function pendingActivation() {
  return {
    ticketId: sessionStorage.getItem("qassas.activation.ticket_id") || "",
    code: sessionStorage.getItem("qassas.activation.code") || "",
  };
}

function clearPendingActivation() {
  sessionStorage.removeItem("qassas.activation.ticket_id");
  sessionStorage.removeItem("qassas.activation.code");
}

async function activateInstitutionalAccess() {
  clearError();
  const ticketId = el("activation-ticket-id").value.trim();
  const code = el("activation-code").value.trim();
  const message = el("activation-message");

  if (!ticketId || !code) {
    showError("Activation ticket ID and one-time activation code are required.");
    return;
  }

  sessionStorage.setItem("qassas.activation.ticket_id", ticketId);
  sessionStorage.setItem("qassas.activation.code", code);

  if (!getAccessToken()) {
    message.hidden = false;
    message.textContent =
      "Sign-in is required. Your activation ticket will be claimed after Keycloak verifies your identity.";
    await startLogin(config);
    return;
  }

  try {
    const result = await api.claimAdminActivationTicket(ticketId, code);
    clearPendingActivation();
    message.hidden = false;
    message.textContent =
      `Institutional access activated for ${result.institution_name}. Loading portfolio…`;
    const token = getAccessToken();
    const actor = actorFromToken(token);
    setText("actor-name", actor.displayName);
    showWorkspace();
    await loadDirectory();
  } catch (error) {
    message.hidden = false;
    message.textContent =
      error instanceof Error ? error.message : String(error);
    showAuth();
  }
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
  const privateSource = (pipeline.sources || []).find(
    (source) => source.source_class === "PRIVATE_CONTRACTUAL",
  );
  const container = el("partner-state");
  const agreements = state.agreements || [];
  const activeAgreements = agreements.filter(
    (agreement) => agreement.agreement_status === "ACTIVE",
  );

  if (!privateSource) {
    container.innerHTML =
      '<div class="empty-inline">No private contractual source is configured.</div>';
    return;
  }

  const agreementRows = agreements.length
    ? agreements
        .map(
          (agreement) => `
            <div class="contract-row">
              <div>
                <strong>${escapeHtml(agreement.agreement_type)}</strong>
                <span>${escapeHtml(agreement.agreement_id)}</span>
              </div>
              <div class="contract-domains">
                ${(agreement.allowed_domains || [])
                  .map((domain) => pill(domain, "neutral"))
                  .join("") || pill("NO DATA SCOPE", "warn")}
              </div>
              ${pill(
                humanize(agreement.agreement_status),
                statusTone(agreement.agreement_status),
              )}
            </div>
          `,
        )
        .join("")
    : '<div class="empty-inline">No institutional access agreement has been recorded yet.</div>';

  const connection = privateSource.connection;
  const connectionState = connection?.status || privateSource.access_status;
  const connected = connection?.status === "CONNECTED";

  container.innerHTML = `
    <div class="${connected ? "partner-connected" : "locked-layer"}">
      <div class="lock-icon" aria-hidden="true">${connected ? "✓" : "⌁"}</div>
      <div>
        <strong>${connected ? "Private partner source connected" : "Private institutional layer is locked"}</strong>
        <p>
          ${connected
            ? "Contractual datasets may be ingested only inside the agreement-scoped data domains shown below."
            : "Partner data remains unavailable until an active Term Sheet or approved data-sharing agreement is bound to this portfolio."}
        </p>
      </div>
      ${pill(humanize(connectionState), connected ? "good" : "warn")}
    </div>

    <div class="contract-summary">
      <div class="contract-summary-head">
        <div>
          <span class="surface-kicker">Agreement registry</span>
          <strong>${agreements.length} recorded agreement${agreements.length === 1 ? "" : "s"}</strong>
        </div>
        <div>
          <span class="surface-kicker">Bound agreement</span>
          <strong>${escapeHtml(privateSource.agreement_id || "None")}</strong>
        </div>
        <div>
          <span class="surface-kicker">Effective private scope</span>
          <strong>${(privateSource.allowed_domains || []).length} domain${(privateSource.allowed_domains || []).length === 1 ? "" : "s"}</strong>
        </div>
      </div>
      <div class="contract-list">${agreementRows}</div>
    </div>

    <div class="contract-control">
      <div class="section-heading compact-heading">
        <div>
          <div class="eyebrow">Platform contract control</div>
          <h3>Term Sheet / Data Sharing Activation</h3>
        </div>
        ${pill("SYSTEM ADMIN REQUIRED", "warn")}
      </div>

      <div class="contract-control-grid">
        <div class="contract-form">
          <label class="label" for="contract-document-ref">Document reference</label>
          <input id="contract-document-ref" class="input" type="text" placeholder="TERM-SHEET://INSTITUTION/REV" />
          <label class="label" for="contract-document-hash">SHA-256 document hash</label>
          <input id="contract-document-hash" class="input" type="text" placeholder="64 hex characters" />
          <label class="label" for="contract-domains">Allowed data domains</label>
          <input id="contract-domains" class="input" type="text" placeholder="ASSAYS, PRIVATE_GEOLOGY" />
          <button id="record-contract-button" class="button button-primary" type="button">
            Record active Term Sheet
          </button>
        </div>

        <div class="contract-form">
          <label class="label" for="contract-agreement-select">Active agreement</label>
          <select id="contract-agreement-select" class="select">
            <option value="">Select active agreement</option>
            ${activeAgreements
              .map(
                (agreement) =>
                  `<option value="${escapeHtml(agreement.agreement_id)}">${escapeHtml(
                    agreement.agreement_id,
                  )} — ${escapeHtml(agreement.agreement_type)}</option>`,
              )
              .join("")}
          </select>
          <div class="contract-scope-preview">
            <span>Source</span>
            <strong>${escapeHtml(privateSource.source_name)}</strong>
            <span>Current state</span>
            <strong>${escapeHtml(humanize(connectionState))}</strong>
          </div>
          <button id="connect-private-source-button" class="button button-primary" type="button">
            Activate private source
          </button>
        </div>
      </div>
      <div id="contract-control-message" class="activation-message" hidden></div>
    </div>
  `;

  el("record-contract-button")?.addEventListener("click", () => {
    void recordPartnerAgreement(portfolio);
  });
  el("connect-private-source-button")?.addEventListener("click", () => {
    void connectPartnerSource(portfolio, privateSource);
  });
}

async function recordPartnerAgreement(portfolio) {
  clearError();
  const message = el("contract-control-message");
  const documentRef = el("contract-document-ref")?.value.trim();
  const documentHash = el("contract-document-hash")?.value.trim().toLowerCase();
  const allowedDomains = (el("contract-domains")?.value || "")
    .split(",")
    .map((domain) => domain.trim().toUpperCase())
    .filter(Boolean);

  if (!documentRef || !/^[a-f0-9]{64}$/.test(documentHash || "")) {
    showError("Document reference and a valid SHA-256 document hash are required.");
    return;
  }
  if (allowedDomains.length === 0) {
    showError("At least one private data domain must be authorised.");
    return;
  }

  try {
    const agreement = await api.recordAgreement({
      institution_id: portfolio.institution.institution_id,
      agreement_type: "TERM_SHEET",
      agreement_status: "ACTIVE",
      document_ref: documentRef,
      document_hash: documentHash,
      allowed_domains: allowedDomains,
      effective_from: new Date().toISOString(),
    });
    message.hidden = false;
    message.textContent =
      `Agreement ${agreement.agreement_id} recorded. Explicit source activation is still required.`;
    await loadPortfolio(portfolio.portfolio_id);
  } catch (error) {
    message.hidden = false;
    message.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function connectPartnerSource(portfolio, privateSource) {
  clearError();
  const message = el("contract-control-message");
  const agreementId = el("contract-agreement-select")?.value;

  if (!agreementId) {
    showError("Select an active agreement before activating the private source.");
    return;
  }

  try {
    const result = await api.activatePrivateSource(
      portfolio.portfolio_id,
      privateSource.source_id,
      agreementId,
    );
    message.hidden = false;
    message.textContent =
      `Private source connected under ${result.agreement_id}. Allowed scope: ${(
        result.allowed_domains || []
      ).join(", ")}.`;
    await loadPortfolio(portfolio.portfolio_id);
  } catch (error) {
    message.hidden = false;
    message.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function boot() {
  el("release-pill").textContent = config.environmentLabel;

  el("login-button").addEventListener("click", () => startLogin(config));
  el("activate-button").addEventListener("click", () => {
    void activateInstitutionalAccess();
  });
  el("issue-activation-button").addEventListener("click", () => {
    void issueActivationTicket();
  });
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

    const pending = pendingActivation();
    if (pending.ticketId && pending.code) {
      el("activation-ticket-id").value = pending.ticketId;
      el("activation-code").value = pending.code;
      await activateInstitutionalAccess();
      return;
    }

    const actor = actorFromToken(token);
    setText("actor-name", actor.displayName);
    showWorkspace();
    await loadDirectory();
  } catch (error) {
    if (error?.code === "AUTH_REQUIRED") {
      const token = getAccessToken();
      if (token) {
        const actor = actorFromToken(token);
        setText("actor-name", actor.displayName);
        el("activation-message").hidden = false;
        el("activation-message").textContent =
          "Keycloak identity verified. QASSAS institutional access is not active yet; enter your activation ticket below.";
        showAuth();
        return;
      }
      clearSession();
      showAuth();
      return;
    }
    showError(error instanceof Error ? error.message : String(error));
    if (!getAccessToken()) showAuth();
  }
}

void boot();
