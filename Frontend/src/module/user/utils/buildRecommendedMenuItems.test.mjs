import assert from "node:assert/strict"
import test from "node:test"
import { buildRecommendedMenuItems } from "./buildRecommendedMenuItems.js"

test("includes only isRecommended items", () => {
  const sections = [
    {
      items: [
        { id: "a", name: "Rec", price: 1, isRecommended: true },
        { id: "b", name: "Not", price: 2 },
      ],
      subsections: [],
    },
  ]
  const out = buildRecommendedMenuItems(sections)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, "a")
})

test("returns empty when nothing is recommended", () => {
  const sections = [
    {
      items: [
        { id: "1", name: "Pizza", price: 99 },
        { id: "2", name: "Pasta", price: 89 },
      ],
      subsections: [],
    },
  ]
  assert.equal(buildRecommendedMenuItems(sections).length, 0)
})

test("skips unavailable recommended", () => {
  const sections = [
    {
      items: [
        { id: "1", name: "Off", price: 1, isRecommended: true, isAvailable: false },
        { id: "2", name: "On", price: 2, isRecommended: true },
      ],
      subsections: [],
    },
  ]
  const out = buildRecommendedMenuItems(sections)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, "2")
})

test("subsection recommended items", () => {
  const sections = [
    {
      items: [],
      subsections: [
        { items: [{ id: "s1", name: "Sub", price: 5, isRecommended: true }] },
      ],
    },
  ]
  const out = buildRecommendedMenuItems(sections)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, "s1")
})
