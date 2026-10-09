FROM sonarsource/sonar-scanner-cli:10 AS scanner

FROM node:22.20.0-bookworm-slim

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates git openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*

COPY --from=scanner /opt/sonar-scanner /opt/sonar-scanner
COPY --chown=node:node server.mjs /app/server.mjs

ENV NODE_ENV=production \
    PATH="/opt/sonar-scanner/bin:${PATH}" \
    SONAR_USER_HOME=/tmp/.sonar

WORKDIR /app
USER node
EXPOSE 8787

CMD ["node", "server.mjs"]
