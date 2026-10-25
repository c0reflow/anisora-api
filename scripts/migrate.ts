import prisma from '../src/db/prisma';

async function migrate() {
  console.log('--- Updating Database Schema ---');

  const statements = [
    `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,

    // Add views, likes and description to anime table
    `ALTER TABLE anime ADD COLUMN IF NOT EXISTS views BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE anime ADD COLUMN IF NOT EXISTS likes BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE anime ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;`,

    // 1. User accounts
    `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(254) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        username VARCHAR(50) UNIQUE,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        email_verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    // 2. User sessions
    `CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_name VARCHAR(100),
        ip_hash CHAR(64),
        user_agent_hash CHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
    );`,

    `CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);`,

    // 3. Authentication tokens
    `CREATE TABLE IF NOT EXISTS auth_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('access', 'refresh')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        replaced_by UUID REFERENCES auth_tokens(id)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_auth_tokens_session_id ON auth_tokens(session_id);`,
    `CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry ON auth_tokens(expires_at);`,

    // 4. CAPTCHA tokens
    `CREATE TABLE IF NOT EXISTS captcha_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash CHAR(64) NOT NULL UNIQUE,
        visitor_id UUID,
        session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
        provider VARCHAR(30) NOT NULL DEFAULT 'cloudflare',
        verification_status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'revoked')),
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
    );`,

    `CREATE INDEX IF NOT EXISTS idx_captcha_tokens_session_id ON captcha_tokens(session_id);`,
    `CREATE INDEX IF NOT EXISTS idx_captcha_tokens_expiry ON captcha_tokens(expires_at);`,

    // 5. Episode comments table (using episode_id = animeid&ep=(int))
    `CREATE TABLE IF NOT EXISTS anime_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id VARCHAR(100) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'parent' CHECK (type IN ('parent', 'reply')),
        parent_comment_id UUID REFERENCES anime_comments(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_anime_comments_episode_id ON anime_comments(episode_id);`,
    `CREATE INDEX IF NOT EXISTS idx_anime_comments_user_id ON anime_comments(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_anime_comments_parent_id ON anime_comments(parent_comment_id);`,

    // 6. Home page cache table
    `CREATE TABLE IF NOT EXISTS home (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  ];

  for (const sql of statements) {
    console.log(`Executing SQL: ${sql.slice(0, 60)}...`);
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('✅ All migrations executed successfully!');
}

migrate()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
