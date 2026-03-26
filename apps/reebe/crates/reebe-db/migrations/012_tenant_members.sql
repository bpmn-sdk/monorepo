CREATE TABLE IF NOT EXISTS tenant_members (
    tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    member_id   TEXT NOT NULL,
    member_type TEXT NOT NULL CHECK (member_type IN ('USER', 'GROUP', 'ROLE')),
    PRIMARY KEY (tenant_id, member_id, member_type)
);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_member ON tenant_members(member_id, member_type);
