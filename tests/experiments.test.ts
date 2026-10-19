import assert from "node:assert/strict";
import { test } from "node:test";
import { copyFor, parseVariant, randomVariant, serializeVariant, variantProps } from "../src/lib/experiments";

test("variant cookie round-trips and rejects junk", () => {
  const v = { pos: "b", hook: "a", design: "b" } as const;
  assert.deepEqual(parseVariant(serializeVariant(v)), v);
  for (const bad of [undefined, "", "pos-c.hook-a.design-a", "pos-a.hook-a", "x"]) assert.equal(parseVariant(bad), null);
});

test("random assignment splits pos and hook evenly and keeps the winning design", () => {
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const counts = { pos: 0, hook: 0, design: 0 };
  for (let i = 0; i < 4000; i++) {
    const v = randomVariant(rand);
    for (const k of ["pos", "hook", "design"] as const) if (v[k] === "a") counts[k]++;
  }
  for (const k of ["pos", "hook"] as const) assert.ok(counts[k] > 1800 && counts[k] < 2200, `${k}: ${counts[k]}`);
  assert.equal(counts.design, 0, "design is fixed to the editorial arm (b)");
});

test("copy and analytics labels follow the variant", () => {
  const v = { pos: "a", hook: "b", design: "a" } as const;
  assert.match(copyFor(v).headline.join(" "), /Reverse-engineer your competitors/);
  assert.equal(copyFor(v).kicker, "Every website leaks its marketing");
  assert.deepEqual(variantProps(v), { exp_pos: "a_reverse_build", exp_hook: "b_curiosity", exp_design: "a_aurora", variant: "pos-a.hook-b.design-a" });
});
