CREATE TABLE tenants (
    key        BIGINT       PRIMARY KEY,
    tenant_id  VARCHAR(255) UNIQUE NOT NULL,
    name       VARCHAR(255),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
INSERT INTO tenants (key, tenant_id, name) VALUES (-1, '<default>', 'Default Tenant');

CREATE TABLE users (
    username     VARCHAR(255) PRIMARY KEY,
    name         VARCHAR(255),
    email        VARCHAR(255),
    password_hash VARCHAR(255),
    enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
    role_id    VARCHAR(255) PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE groups (
    group_id   VARCHAR(255) PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE authorizations (
    key            BIGINT       PRIMARY KEY,
    owner_key      VARCHAR(255) NOT NULL,
    owner_type     VARCHAR(50)  NOT NULL,
    resource_type  VARCHAR(50)  NOT NULL,
    resource_id    VARCHAR(255) NOT NULL DEFAULT '*',
    permissions    TEXT[]       NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (owner_key, owner_type, resource_type, resource_id)
);
CREATE INDEX idx_authz_owner ON authorizations(owner_key, owner_type);
