FROM sonarsource/sonar-scanner-cli:10 AS scanner
FROM eclipse-temurin:21-jre-jammy AS java

FROM node:22.20.0-bookworm-slim

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=scanner /opt/sonar-scanner /opt/sonar-scanner
COPY --from=java /opt/java/openjdk /opt/java/openjdk
COPY --chown=node:node server.mjs /app/server.mjs
RUN mkdir -p /data && chown node:node /data

ENV JAVA_HOME=/opt/java/openjdk \
    NODE_ENV=production \
    PATH="/opt/sonar-scanner/bin:${PATH}" \
    SONAR_USER_HOME=/tmp/.sonar

WORKDIR /app
USER node
EXPOSE 8787

CMD ["node", "server.mjs"]
