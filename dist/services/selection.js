export const bookingIds = (value) => value.serviceIds || [value.serviceId];
export const sameSelection = (a, b) =>
  [...a].sort().join("\0") === [...b].sort().join("\0");
export function selectedService(db, value, previous) {
  const ids = Array.isArray(value) ? value : [value];
  if (
    !ids.length ||
    ids.length > 20 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => typeof id !== "string")
  )
    return null;
  const unchanged = previous && sameSelection(ids, bookingIds(previous));
  const items = ids.map((id) => db.services.find((s) => s.id === id));
  if (items.some((s) => !s) && !unchanged) return null;
  return {
    id: ids[0],
    serviceIds: ids,
    name: unchanged
      ? previous.serviceName
      : items.map((s) => s.name).join(" + "),
    price: unchanged
      ? previous.price
      : Math.round(items.reduce((n, s) => n + s.price, 0) * 100) / 100,
    duration: unchanged
      ? previous.duration
      : items.reduce((n, s) => n + s.duration, 0),
    active: items.every((s) => s?.active),
  };
}
