#!/usr/bin/env node

/**
 * Deploy D1 database schema to ensure tables are created
 * This should be run during deployment, not at runtime
 */

import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

async function deploySchema() {
  try {
    console.log("🗄️  Deploying D1 schema...");
    
    // Read the schema file
    const schemaPath = new URL('../database/schema.sql', import.meta.url);
    const schema = await readFile(schemaPath, { encoding: 'utf-8' });
    
    const statements = schema.split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => `${statement};`);

    for (const statement of statements) {
      console.log("Executing D1 schema statement");
      execSync(`npx wrangler d1 execute hawkbucks-db --command ${JSON.stringify(statement)}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
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
