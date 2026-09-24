window.QASSAS_CONFIG = Object.freeze({
  apiBaseUrl: "http://localhost:3001/api/v1",
  oidcIssuer: "http://localhost:8080/realms/qassas-pilot",
  oidcClientId: "qassas-web",
  oidcScope: "openid profile email",
  redirectUri: window.location.origin + window.location.pathname,
  environmentLabel: "LOCAL / TEST",
});
