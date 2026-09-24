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

    if (response.status === 401 || response.status === 403) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    if (response.status === 404) {
      const error = new Error("NOT_FOUND");
      error.code = "NOT_FOUND";
      throw error;
    }

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

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
}
