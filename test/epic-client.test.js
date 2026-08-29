import assert from "node:assert/strict";
import test from "node:test";
import { EpicApiError, fetchMissionData } from "../src/epic/client.js";
import { worldInfoFixture } from "./fixtures/world-info.js";

const ENV = {
  EPIC_ACCOUNT_ID: "account",
  EPIC_DEVICE_ID: "device",
  EPIC_DEVICE_SECRET: "secret",
  EPIC_TOKEN_AUTH: "basic dGVzdDp0ZXN0",
};

const TOKEN_RESPONSE = () => ({
  ok: true,
  status: 200,
  json: async () => ({ access_token: "token-abc" }),
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function installFetch(stub) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return () => {
    globalThis.fetch = original;
  };
}

test("fetchMissionData returns normalized missions on success", async () => {
  const calls = [];
  const restore = installFetch(async (url) => {
    calls.push(String(url));
    if (url.includes("/account/api/oauth/token")) return TOKEN_RESPONSE();
    return jsonResponse(200, worldInfoFixture);
  });

  try {
    const data = await fetchMissionData(ENV);
    assert.equal(data.success, true);
    assert.equal(data.status, "available");
    assert.equal(data.totalVbucks, 100);
    assert.equal(data.missions.length, 2);
    assert.deepEqual(calls.length, 2);
    assert.ok(calls[0].includes("oauth/token"));
    assert.ok(calls[1].includes("world/info"));
  } finally {
    restore();
  }
});

test("fetchMissionData reports empty status when there are no V-Buck alerts", async () => {
  const restore = installFetch(async (url) => {
    if (url.includes("oauth/token")) return TOKEN_RESPONSE();
    return jsonResponse(200, { theaters: [], missions: [], missionAlerts: [] });
  });

  try {
    const data = await fetchMissionData(ENV);
    assert.equal(data.status, "empty");
    assert.deepEqual(data.missions, []);
    assert.equal(data.totalVbucks, 0);
  } finally {
    restore();
  }
});

test("missing Epic credentials fail fast without calling Epic", async () => {
  const restore = installFetch(async () => {
    throw new Error("should not be called");
  });

  try {
    await assert.rejects(
      () => fetchMissionData({ EPIC_ACCOUNT_ID: "only-one" }),
      (error) => error instanceof EpicApiError && error.kind === "auth_config"
    );
  } finally {
    restore();
  }
});

test("authentication failure raises an auth_failed EpicApiError", async () => {
  const restore = installFetch(async (url) => {
    if (url.includes("oauth/token")) {
      return jsonResponse(401, { errorMessage: "invalid_client" });
    }
    throw new Error("should not be reached");
  });

  try {
    await assert.rejects(
      () => fetchMissionData(ENV),
      (error) =>
        error instanceof EpicApiError &&
        error.kind === "auth_failed" &&
        error.status === 401
    );
  } finally {
    restore();
  }
});

test("rate limiting is retried and then surfaces a rate_limited error", async () => {
  let worldCalls = 0;
  const restore = installFetch(async (url) => {
    if (url.includes("oauth/token")) return TOKEN_RESPONSE();
    worldCalls += 1;
    return jsonResponse(429, { errorMessage: "rate limited" });
  });

  try {
    await assert.rejects(
      () => fetchMissionData(ENV),
      (error) =>
        error instanceof EpicApiError && error.kind === "rate_limited"
    );
    assert.equal(worldCalls, 3); // MAX_ATTEMPTS
  } finally {
    restore();
  }
});

test("malformed world info payload raises malformed_response", async () => {
  const restore = installFetch(async (url) => {
    if (url.includes("oauth/token")) return TOKEN_RESPONSE();
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    };
  });

  try {
    await assert.rejects(
      () => fetchMissionData(ENV),
      (error) =>
        error instanceof EpicApiError && error.kind === "malformed_response"
    );
  } finally {
    restore();
  }
});

test("network failures are retried and then thrown as network errors", async () => {
  let worldAttempts = 0;
  const restore = installFetch(async (url) => {
    if (String(url).includes("oauth/token")) return TOKEN_RESPONSE();
    worldAttempts += 1;
    throw new TypeError("fetch failed");
  });

  try {
    await assert.rejects(
      () => fetchMissionData(ENV),
      (error) => error instanceof EpicApiError && error.kind === "network"
    );
    assert.equal(worldAttempts, 3);
  } finally {
    restore();
  }
});

test("timeouts are classified as timeout errors", async () => {
  const restore = installFetch(async (url) => {
    if (url.includes("oauth/token")) return TOKEN_RESPONSE();
    const timeoutError = new Error("The operation was aborted due to timeout");
    timeoutError.name = "TimeoutError";
    throw timeoutError;
  });

  try {
    await assert.rejects(
      () => fetchMissionData(ENV),
      (error) => error instanceof EpicApiError && error.kind === "timeout"
    );
  } finally {
    restore();
  }
});

test("5xx responses are retried and then thrown as api errors", async () => {
  let worldCalls = 0;
  const restore = installFetch(async (url) => {
    if (url.includes("oauth/token")) return TOKEN_RESPONSE();
    worldCalls += 1;
    return jsonResponse(503, { message: "service unavailable" });
  });

  try {
    await assert.rejects(
      () => fetchMissionData(ENV),
      (error) =>
        error instanceof EpicApiError &&
        error.kind === "api_error" &&
        error.status === 503
    );
    assert.equal(worldCalls, 3);
  } finally {
    restore();
  }
});
