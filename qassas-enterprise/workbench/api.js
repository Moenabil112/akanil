export class QassasApi {
  constructor(baseUrl, tokenProvider) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.tokenProvider = tokenProvider;
  }

  async request(path, options = {}) {
    const token = this.tokenProvider();
    if (!token) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    const response = await fetch(this.baseUrl + path, {
      ...options,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (response.status === 403) {
      const error = new Error(body?.message || "FORBIDDEN");
      error.code = "FORBIDDEN";
      error.status = 403;
      throw error;
    }

    if (response.status === 404) {
      const error = new Error("NOT_FOUND");
      error.code = "NOT_FOUND";
      throw error;
    }

    if (!response.ok) {
      const error = new Error(body?.message || `QASSAS API returned ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return body;
  }

  portfolios() {
    return this.request("/institutional-portfolios");
  }

  portfolio(portfolioId) {
    return this.request(`/institutional-portfolios/${encodeURIComponent(portfolioId)}`);
  }

  dataSources(portfolioId) {
    return this.request(
      `/institutional-portfolios/${encodeURIComponent(portfolioId)}/data-sources`,
    );
  }

  pipelineStatus(portfolioId) {
    return this.request(
      `/data-pipeline/portfolios/${encodeURIComponent(portfolioId)}/status`,
    );
  }

  assets(portfolioId) {
    return this.request(
      `/data-pipeline/portfolios/${encodeURIComponent(portfolioId)}/assets`,
    );
  }

  onboardingStatus(institutionId) {
    return this.request(
      `/institutional-onboarding/institutions/${encodeURIComponent(institutionId)}/status`,
    );
  }

  agreements(institutionId) {
    return this.request(
      `/institutional-onboarding/institutions/${encodeURIComponent(institutionId)}/agreements`,
    );
  }

  recordAgreement(payload) {
    return this.request("/institutional-onboarding/agreements", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  activatePrivateSource(portfolioId, sourceId, agreementId) {
    return this.request(
      `/institutional-onboarding/portfolios/${encodeURIComponent(portfolioId)}/sources/${encodeURIComponent(sourceId)}/activate`,
      {
        method: "POST",
        body: JSON.stringify({ agreement_id: agreementId }),
      },
    );
  }

  issueAdminActivationTicket(institutionId, expectedEmail, expiresInHours = 48) {
    return this.request(
      `/institutional-onboarding/institutions/${encodeURIComponent(institutionId)}/admin-activation-tickets`,
      {
        method: "POST",
        body: JSON.stringify({
          expected_email: expectedEmail,
          expires_in_hours: expiresInHours,
        }),
      },
    );
  }

  latestAdminActivationTicket(institutionId) {
    return this.request(
      `/institutional-onboarding/institutions/${encodeURIComponent(institutionId)}/admin-activation-tickets/latest`,
    );
  }

  claimAdminActivationTicket(ticketId, activationCode) {
    return this.request(
      `/institutional-onboarding/admin-activation-tickets/${encodeURIComponent(ticketId)}/claim`,
      {
        method: "POST",
        body: JSON.stringify({ activation_code: activationCode }),
      },
    );
  }
}
