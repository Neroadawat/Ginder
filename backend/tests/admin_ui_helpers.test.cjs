const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  cropRectangle,
  weeklyPeriods,
  missingFields,
} = require("../app/admin_ui/admin-tools.js");

test("portrait crop preserves its ratio inside a landscape source", () => {
  assert.deepEqual(cropRectangle(1600, 900, 0.8), {
    x: 440,
    y: 0,
    width: 720,
    height: 900,
  });
});
test("zoom and edge positions never read outside the source image", () => {
  for (const aspect of [0.8, 1, 4 / 3]) {
    for (const x of [0, 50, 100])
      for (const y of [0, 50, 100]) {
        const r = cropRectangle(800, 1200, aspect, 3, x, y);
        assert.ok(r.x >= 0 && r.y >= 0);
        assert.ok(r.x + r.width <= 800 + 1e-8 && r.y + r.height <= 1200 + 1e-8);
        assert.ok(Math.abs(r.width / r.height - aspect) < 1e-8);
      }
  }
});
test("invalid crop controls fail before creating a canvas", () => {
  for (const args of [
    [0, 10, 1],
    [10, 10, NaN],
    [10, 10, 1, 0],
    [10, 10, 1, 1, -1],
  ])
    assert.throws(() => cropRectangle(...args));
});
test("weekday schedule uses exactly the chosen days without duplicates", () => {
  const periods = weeklyPeriods([5, 1, 2, 3, 4, 1], "0900", "2100");
  assert.deepEqual(
    periods.map((p) => p.open.day),
    [1, 2, 3, 4, 5]
  );
  assert.ok(
    periods.every((p) => p.close.day === p.open.day && p.close.time === "2100")
  );
});
test("Saturday overnight and full-day hours wrap to Sunday", () => {
  assert.deepEqual(weeklyPeriods([6], "1800", "0200", true), [
    { open: { day: 6, time: "1800" }, close: { day: 0, time: "0200" } },
  ]);
  assert.equal(weeklyPeriods([6], "0900", "0900", true)[0].close.day, 0);
});
test("invalid or overlapping daily windows are rejected", () => {
  for (const args of [
    [[], "0900", "2100"],
    [[7], "0900", "2100"],
    [[1], "2400", "2100"],
    [[1], "2100", "0900"],
    [[1], "0900", "0900"],
    [[1], "0900", "2100", true],
  ])
    assert.throws(() => weeklyPeriods(...args));
});
test("reviewed status does not fill unknown data or require an invented rating", () => {
  const row = {
    name: "ร้านตัวอย่าง",
    primary_category: "Thai",
    latitude: 14,
    longitude: 100,
    photo_url: "/photo.webp",
    address: "ที่อยู่",
    opening_hours: { periods: [{ open: { day: 0, time: "0000" } }] },
    price_level: 0,
    reviewed: false,
    rating: null,
  };
  assert.deepEqual(missingFields(row), []);
  assert.deepEqual(
    missingFields({
      ...row,
      reviewed: true,
      photo_url: null,
      price_level: null,
    }),
    ["รูปภาพ", "ราคา"]
  );
  assert.ok(
    missingFields({
      ...row,
      latitude: null,
      primary_category: "Other",
    }).includes("พิกัด")
  );
  assert.ok(
    missingFields({ ...row, primary_category: "Other" }).includes("หมวดอาหาร")
  );
});
