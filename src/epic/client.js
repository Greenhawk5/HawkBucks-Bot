// Epic Games API client for Fortnite Save the World mission alerts.
// Authentication and request handling are adapted from the reference
// HawkBucks Epic implementation (epic/index.js).

import { parseWorldInfo, totalVbucks } from "./parser.js";

const TOKEN_URL =
  "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token";

const WORLD_INFO_URL =
  "https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/world/info";

const DEFAULT_LANGUAGE = "en";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

export class EpicApiError extends Error {
  constructor(message, { status = null, kind = "api_error" } = {}) {
    super(message);
    this.name = "EpicApiError";
    this.status = status;
    this.kind = kind;
  }
}

function describeApiFailure(response, payload) {
  return (
    payload?.errorMessage ||
    payload?.message ||
    payload?.error_description ||
    payload?.error ||
    `HTTP ${response?.status ?? "unknown"}`
  );
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertEpicCredentials(env) {
  if (
    !env?.EPIC_ACCOUNT_ID ||
    !env?.EPIC_DEVICE_ID ||
    !env?.EPIC_DEVICE_SECRET
  ) {
    throw new EpicApiError(
      "Missing Epic credentials: EPIC_ACCOUNT_ID, EPIC_DEVICE_ID, or EPIC_DEVICE_SECRET",
      { kind: "auth_config" }
    );
  }

  if (!env?.EPIC_TOKEN_AUTH) {
    throw new EpicApiError("Missing EPIC_TOKEN_AUTH secret", {
      kind: "auth_config",
    });
  }
}

/**
 * Exchanges the device-auth credentials for a fresh access token.
 * The reference implementation requests a new token for every mission refresh;
 * the same behavior is kept here to avoid storing long-lived secrets.
 */
export async function refreshToken(env) {
  assertEpicCredentials(env);

  const body = new URLSearchParams({
    grant_type: "device_auth",
    account_id: env.EPIC_ACCOUNT_ID,
    device_id: env.EPIC_DEVICE_ID,
    secret: env.EPIC_DEVICE_SECRET,
  });

  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: env.EPIC_TOKEN_AUTH,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "HawkBucks/1.0",
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new EpicApiError(`Epic token request failed: ${error.message}`, {
      kind: "network",
    });
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    console.error(
      `Token request failed: ${response.status} - ${describeApiFailure(response, payload)}`
    );
    throw new EpicApiError(
      `Epic token request failed with HTTP ${response.status}`,
      {
        status: response.status,
        kind: response.status === 429 ? "rate_limited" : "auth_failed",
      }
    );
  }

  if (!payload?.access_token) {
    throw new EpicApiError("Epic token response did not contain access_token", {
      kind: "malformed_response",
    });
  }

  return payload.access_token;
}

/**
 * Fetches and parses today's mission alerts from the official Epic Games API.
 *
 * Returns:
 * {
 *   success: true,
 *   status: "available" | "empty",
 *   totalVbucks: number,
 *   missions: Mission[]   // internal mission model
 * }
 *
 * Throws EpicApiError when Epic cannot be reached or returns invalid data, so
 * callers can distinguish "no missions today" from "the API failed".
 */
export async function fetchMissionData(env, { language = DEFAULT_LANGUAGE } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const token = await refreshToken(env);

      let response;
      try {
        response = await fetch(WORLD_INFO_URL, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "HawkBucks/1.0",
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        throw new EpicApiError(
          `Epic world info request failed: ${error.message}`,
          {
            kind: error?.name === "TimeoutError" || error?.name === "AbortError"
              ? "timeout"
              : "network",
          }
        );
      }

      const worldData = await parseJson(response);

      if (!response.ok) {
        console.error(
          `World info request failed: ${response.status} - ${describeApiFailure(response, worldData)}`
        );

        const kind =
          response.status === 429
            ? "rate_limited"
            : response.status === 401
              ? "auth_failed"
              : "api_error";

        throw new EpicApiError(
          `Epic world info request failed with HTTP ${response.status}`,
          { status: response.status, kind }
        );
      }

      if (!worldData || typeof worldData !== "object") {
        throw new EpicApiError("Epic world info response was not valid JSON", {
          kind: "malformed_response",
        });
      }

      const missions = parseWorldInfo(worldData, language);

      return {
        success: true,
        status: missions.length > 0 ? "available" : "empty",
        lastUpdated: new Date().toISOString(),
        totalVbucks: totalVbucks(missions),
        missions,
      };
    } catch (error) {
      if (error instanceof EpicApiError && error.kind === "auth_config") {
        throw error;
      }

      lastError = error instanceof EpicApiError
        ? error
        : new EpicApiError(`Epic mission fetch failed: ${error.message}`, {
            kind: "network",
          });

      console.error(
        `EPIC_FETCH_ATTEMPT_FAILED { attempt: ${attempt}, kind: ${lastError.kind}, error: ${lastError.message} }`
      );

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}