#!/usr/bin/env node

/**
 * Deploy D1 database schema to ensure tables are created
 * This should be run during deployment, not at runtime
 *
 * Usage:
 *   node scripts/deploy-d1-schema.js                                # fresh/full schema (database/schema.sql)
 *   node scripts/deploy-d1-schema.js database/migrations/0002_chat_last_seen.sql
 *
 * Idempotency: statements whose objects already exist (duplicate column /
 * table already exists) are recognized and skipped so migrations can be
 * re-run safely. All other SQL errors abort the deployment.
 */

import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

/**
 * Only these specific, expected idempotency errors are skippable.
 * Everything else is a real schema error and must abort.
 */
export function isIgnorableSchemaError(message) {
  const msg = String(message || '');
  return (
    msg.includes('duplicate column name') ||
    msg.includes('already exists')
  );
}

async function executeStatement(statement) {
  try {
    execSync(`npx wrangler d1 execute hawkbucks-db --command ${JSON.stringify(statement)}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    return true;
  } catch (error) {
    const output = `${error?.message || ''}\n${error?.stdout || ''}\n${error?.stderr || ''}`;
    if (isIgnorableSchemaError(output)) {
      console.log(`⏭️  Skipping (already applied): ${statement.split('\n')[0].slice(0, 70)}...`);
      return false;
    }
    // Real schema error: rethrow so deployment aborts loudly.
    throw error;
  }
}

async function deploySchema() {
  const target = process.argv[2] || 'database/schema.sql';

  try {
    console.log(`🗄️  Deploying D1 schema from ${target}...`);

    const schemaPath = new URL(`../${target}`, import.meta.url);
    const schema = await readFile(schemaPath, { encoding: 'utf-8' });

    const statements = schema.split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => `${statement};`);

    for (const statement of statements) {
      console.log("Executing D1 schema statement");
      await executeStatement(statement);
    }

    console.log("✅ D1 schema deployed successfully");

  } catch (error) {
    console.error("❌ Failed to deploy D1 schema:", error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  deploySchema();
}
