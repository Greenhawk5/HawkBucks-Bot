#!/usr/bin/env node

/**
 * Validate that the HawkBucks deployment is ready
 * This script checks all critical components before deployment
 */

import { readFile } from 'node:fs/promises';

async function validateDeployment() {
  console.log("🔍 Validating HawkBucks deployment readiness...\n");
  
  // Check 1: Verify D1 schema exists
  try {
    const schemaPath = new URL('../database/schema.sql', import.meta.url);
    const schema = await readFile(schemaPath, { encoding: 'utf-8' });
    if (!schema.includes('CREATE TABLE IF NOT EXISTS mission_images')) {
      throw new Error('mission_images table not found in schema.sql');
    }
    console.log("✅ D1 schema contains mission_images table");
  } catch (error) {
    console.error("❌ D1 schema validation failed:", error.message);
    process.exit(1);
  }
  
  // Check 2: Verify no runtime CREATE TABLE
  try {
    const missionImagesPath = new URL('../database/mission-images.js', import.meta.url);
    const missionImages = await readFile(missionImagesPath, { encoding: 'utf-8' });
    if (missionImages.includes('CREATE TABLE')) {
      throw new Error('Runtime CREATE TABLE found in mission-images.js');
    }
    if (missionImages.includes('ensureCacheSchema')) {
      throw new Error('ensureCacheSchema function still present');
    }
    console.log("✅ No runtime table creation found");
  } catch (error) {
    console.error("❌ Runtime table validation failed:", error.message);
    process.exit(1);
  }
  
  // Check 3: Verify button handler has proper logging
  try {
    const buttonsPath = new URL('../src/telegram/buttons.js', import.meta.url);
    const buttons = await readFile(buttonsPath, { encoding: 'utf-8' });
    const requiredLogs = [
      'IMAGE CACHE CHECK',
      'CACHE HIT',
      'CACHE MISS',
      'GENERATING NEW IMAGE',
      'STORING IMAGE CACHE'
    ];
    
    for (const log of requiredLogs) {
      if (!buttons.includes(log)) {
        throw new Error(`Missing required log: ${log}`);
      }
    }
    console.log("✅ Proper logging implemented in button handler");
  } catch (error) {
    console.error("❌ Button handler validation failed:", error.message);
    process.exit(1);
  }
  
  // Check 4: Verify mission-image.js function signatures
  try {
    const missionImagePath = new URL('../src/services/mission-image.js', import.meta.url);
    const missionImage = await readFile(missionImagePath, { encoding: 'utf-8' });
    
    if (missionImage.includes('buildMissionHTML(') && !missionImage.includes('buildMissionHTML(data)')) {
      throw new Error('Incorrect buildMissionHTML function call');
    }
    
    if (missionImage.includes('generateScreenshot(')) {
      // Accept generateScreenshot(html, env) or generateScreenshot(html, env, layout) etc.
      const re = /generateScreenshot\s*\(\s*html\s*,\s*env/;
      if (!re.test(missionImage)) {
        throw new Error('Incorrect generateScreenshot function call; expected generateScreenshot(html, env, ...)');
      }
    }
    
    console.log("✅ Function signatures are correct");
  } catch (error) {
    console.error("❌ Function signature validation failed:", error.message);
    process.exit(1);
  }
  
  console.log("\n🎉 All validations passed! Deployment is ready.");
  console.log("\n📋 Deployment commands:");
  console.log("  npm run deploy:d1          # Deploy D1 schema");
  console.log("  npm run deploy             # Deploy Worker");
  console.log("  npm run deploy:full        # Deploy both");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateDeployment();
}