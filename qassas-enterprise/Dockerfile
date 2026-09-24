FROM node:22.23.2-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/qassas-api/package.json apps/qassas-api/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY temporal/package.json temporal/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY temporal ./temporal
COPY scripts ./scripts
COPY database ./database
COPY opa ./opa
COPY keycloak ./keycloak

RUN npm run build
RUN npm prune --omit=dev

FROM node:22.23.2-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --from=build --chown=node:node /app /app

USER node

CMD ["node", "apps/qassas-api/dist/main.js"]
