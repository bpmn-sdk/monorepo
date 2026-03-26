# Build stage
FROM rust:alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev pkgconfig openssl-dev

WORKDIR /app

# Copy manifests first for layer caching
COPY Cargo.toml Cargo.lock ./
COPY crates/reebe-protocol/Cargo.toml crates/reebe-protocol/
COPY crates/reebe-feel/Cargo.toml crates/reebe-feel/
COPY crates/reebe-bpmn/Cargo.toml crates/reebe-bpmn/
COPY crates/reebe-dmn/Cargo.toml crates/reebe-dmn/
COPY crates/reebe-db/Cargo.toml crates/reebe-db/
COPY crates/reebe-engine/Cargo.toml crates/reebe-engine/
COPY crates/reebe-api/Cargo.toml crates/reebe-api/
COPY crates/reebe-server/Cargo.toml crates/reebe-server/

# Create dummy main files for dependency caching
RUN for crate in reebe-protocol reebe-feel reebe-bpmn reebe-dmn reebe-db reebe-engine reebe-api; do \
      mkdir -p crates/$crate/src && echo "// placeholder" > crates/$crate/src/lib.rs; \
    done && \
    mkdir -p crates/reebe-server/src && echo "fn main() {}" > crates/reebe-server/src/main.rs

# Build dependencies (cached layer)
RUN cargo build --release --package reebe-server 2>/dev/null || true

# Copy actual source
COPY . .

# Build the real binary
RUN cargo build --release --package reebe-server

# Runtime stage
FROM alpine:3.20

RUN apk add --no-cache ca-certificates libgcc

WORKDIR /app

COPY --from=builder /app/target/release/reebe-server /usr/local/bin/reebe
COPY --from=builder /app/config.example.toml /etc/reebe/config.toml

EXPOSE 8080

CMD ["reebe", "--config", "/etc/reebe/config.toml"]
