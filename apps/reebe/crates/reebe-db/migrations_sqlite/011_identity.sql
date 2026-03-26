CREATE TABLE IF NOT EXISTS tenants (
    tenant_id    TEXT  PRIMARY KEY,
    name         TEXT  NOT NULL,
    description  TEXT,
    created_at   TEXT  NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
    username      TEXT     PRIMARY KEY,
    name          TEXT     NOT NULL,
    email         TEXT,
    password_hash TEXT,
    enabled       INTEGER  NOT NULL DEFAULT 1,
    created_at    TEXT     NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS roles (
    id           TEXT  PRIMARY KEY,
    name         TEXT  NOT NULL,
    description  TEXT,
    created_at   TEXT  NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS groups (
    id           TEXT  PRIMARY KEY,
    name         TEXT  NOT NULL,
    description  TEXT,
    created_at   TEXT  NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS authorizations (
    key            INTEGER  PRIMARY KEY,
    owner_key      TEXT     NOT NULL,
    owner_type     TEXT     NOT NULL,
    resource_type  TEXT     NOT NULL,
    resource_id    TEXT     NOT NULL DEFAULT '*',
    permissions    TEXT     NOT NULL DEFAULT '[]',
    created_at     TEXT     NOT NULL DEFAULT (datetime('now'))
);
