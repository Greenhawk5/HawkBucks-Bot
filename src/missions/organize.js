const ZONE_ORDER = ["Stonewood", "Plankerton", "Canny Valley", "Twine Peaks"];

export function groupAndSortMissions(missions) {
  const groups = new Map();

  for (const [index, mission] of (Array.isArray(missions) ? missions : []).entries()) {
    const zone = mission.zone || "Unknown zone";
    if (!groups.has(zone)) groups.set(zone, []);
    groups.get(zone).push({ mission, index });
  }

  return [...groups.entries()]
    .sort(([zoneA], [zoneB]) => {
      const orderA = ZONE_ORDER.indexOf(zoneA);
      const orderB = ZONE_ORDER.indexOf(zoneB);
      return (orderA === -1 ? ZONE_ORDER.length : orderA) -
        (orderB === -1 ? ZONE_ORDER.length : orderB);
    })
    .flatMap(([, entries]) => entries
      .sort((entryA, entryB) => {
        const powerA = Number(entryA.mission.powerLevel);
        const powerB = Number(entryB.mission.powerLevel);
        const valueA = Number.isFinite(powerA) ? powerA : Number.POSITIVE_INFINITY;
        const valueB = Number.isFinite(powerB) ? powerB : Number.POSITIVE_INFINITY;
        return valueA - valueB || entryA.index - entryB.index;
      })
      .map(({ mission }) => mission));
}
