import {
  isPlaceholderCategory,
  isPlaceholderMissionType,
  missionQuality,
  missionTypeKey,
  normalizeText,
  normalizeZone,
  sourcePriority,
} from "./normalizer.js";

function bucketKey(mission) {
  return [
    normalizeZone(mission.zone).toLowerCase(),
    Number(mission.powerLevel),
    Number(mission.reward?.amount),
  ].join("|");
}

function sourceNames(mission) {
  return new Set([
    mission.source,
    ...(Array.isArray(mission.confirmedBy) ? mission.confirmedBy : []),
  ].filter(Boolean));
}

function describe(mission) {
  return {
    source: mission.source || "unknown",
    zone: mission.zone,
    power: mission.powerLevel,
    reward: mission.reward?.amount,
    type: mission.mission?.type || "Unknown Mission",
    category: mission.mission?.category || "No Category",
  };
}

function enrichMission(target, candidate, reason) {
  const targetQuality = missionQuality(target);
  const candidateQuality = missionQuality(candidate);
  const targetTypeIsPlaceholder = isPlaceholderMissionType(target.mission?.type);
  const candidateTypeIsKnown = !isPlaceholderMissionType(candidate.mission?.type);
  const targetCategoryIsPlaceholder = isPlaceholderCategory(target.mission?.category);
  const candidateCategoryIsKnown = !isPlaceholderCategory(candidate.mission?.category);
  const selectedFields = [];
  const candidatePriority = sourcePriority(candidate.source);
  const targetPriority = sourcePriority(target.source);

  if (candidateTypeIsKnown && (targetTypeIsPlaceholder ||
    (candidatePriority > targetPriority && missionTypeKey(candidate.mission.type) === missionTypeKey(target.mission?.type)))) {
    target.mission.type = normalizeText(candidate.mission.type);
    selectedFields.push("type");
  }

  if (candidateCategoryIsKnown && (targetCategoryIsPlaceholder || candidatePriority > targetPriority)) {
    target.mission.category = normalizeText(candidate.mission.category);
    selectedFields.push("category");
  }

  const confirmedBy = new Set([...sourceNames(target), ...sourceNames(candidate)]);
  target.confirmedBy = [...confirmedBy];

  console.log("MERGE_DUPLICATE", {
    reason,
    target: describe(target),
    candidate: describe(candidate),
    selectedFields,
    selectedSource: selectedFields.length ? candidate.source : target.source,
    confirmedBy: target.confirmedBy,
  });
}

function attachUnresolved(bucket, knownCluster) {
  const unresolved = bucket.filter((cluster) => !cluster.typeKey);
  if (!unresolved.length) return;

  for (const cluster of unresolved) {
    enrichMission(knownCluster.mission, cluster.mission, "single-known-type-in-bucket");
    bucket.splice(bucket.indexOf(cluster), 1);
  }
}

/**
 * Merge only records that are safely attributable to one real mission:
 * - zone, power and reward establish a shared alert bucket;
 * - known mission types must normalize to the same value;
 * - an Unknown Mission is attached only if that bucket has exactly one known
 *   mission type, so two distinct missions at the same PL are never collapsed.
 */
export function mergeMissions(missions) {
  console.log("MERGE_START", { received: missions.length });

  const buckets = new Map();

  for (const inputMission of missions) {
    const mission = structuredClone(inputMission);
    const key = bucketKey(mission);
    const typeKey = missionTypeKey(mission.mission?.type);
    const bucket = buckets.get(key) || [];
    const sameType = typeKey ? bucket.find((cluster) => cluster.typeKey === typeKey) : null;

    if (sameType) {
      enrichMission(sameType.mission, mission, "matching-normalized-type");
    } else if (typeKey) {
      const cluster = { mission, typeKey };
      bucket.push(cluster);
      console.log("MERGE_NEW_KNOWN", { bucket: key, mission: describe(mission), typeKey });

      const knownClusters = bucket.filter((item) => item.typeKey);
      if (knownClusters.length === 1) attachUnresolved(bucket, cluster);
    } else {
      const knownClusters = bucket.filter((cluster) => cluster.typeKey);

      if (knownClusters.length === 1) {
        enrichMission(knownClusters[0].mission, mission, "placeholder-attached-to-known-type");
      } else {
        bucket.push({ mission, typeKey: "" });
        console.log("MERGE_UNRESOLVED", {
          bucket: key,
          mission: describe(mission),
          knownTypeCount: knownClusters.length,
          reason: knownClusters.length ? "ambiguous-known-types" : "no-known-type-yet",
        });
      }
    }

    buckets.set(key, bucket);
  }

  const merged = [...buckets.values()].flatMap((bucket) => bucket.map((cluster) => cluster.mission));
  console.log("MERGE_COMPLETE", { merged: merged.length });
  return merged;
}
