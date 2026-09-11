FROM node:22.19.0-slim
WORKDIR /app
COPY src ./src
COPY containers ./containers
ENTRYPOINT ["node", "--experimental-strip-types", "/app/containers/gate1-artifact-roundtrip/entrypoint.ts"]
