import { assertEquals } from "jsr:@std/assert";
import { signal, memo, effect, batch } from "../lib/relic-core.js";

Deno.test("signal returns initial value", () => {
  const s1 = signal(0);
  assertEquals(s1(), 0);

  const s2 = signal(42);
  assertEquals(s2(), 42);
});

Deno.test("signal mutates", () => {
    const s1 = signal(0);
    assertEquals(s1(), 0);
    s1.mut(_ => 42);
    assertEquals(s1(), 42);
});

Deno.test("memo returns derived value", () => {
    const count = signal(21);
    const double = memo(() => 2 * count());
    assertEquals(double.isStale(), true);
    assertEquals(double(), 42);
    assertEquals(double.isStale(), false);
    count.mut(_ => 8);
    assertEquals(double.isStale(), true);
    assertEquals(double(), 16);
    assertEquals(double.isStale(), false);
});

Deno.test("dirtiness propagates through chains of memos, value is pulled lazily", () => {
    const count = signal(4);
    const double = memo(() => 2 * count());
    const doubleSquared = memo(() => double() * double());
    const triple = memo(() => double() + count());

    assertEquals(doubleSquared(), 64);
    assertEquals(triple(), 12);
    assertEquals(triple.isStale(), false);

    count.mut(x => x + 1);

    assertEquals(triple.isStale(), true);
    assertEquals(double.isStale(), true);
    assertEquals(doubleSquared.isStale(), true);

    assertEquals(doubleSquared(), 100);
    assertEquals(doubleSquared.isStale(), false);
    assertEquals(double.isStale(), false);
    assertEquals(double(), 10);

    assertEquals(triple.isStale(), true);
    assertEquals(triple(), 15);
    assertEquals(triple.isStale(), false);
});

Deno.test("chain isn't recomputed if reference values remain unchanged", () => {
    let count = 0;
    const a = signal(1);
    const b = signal(2);
    const c = memo(() => a() + b());
    const d = memo(() => {
        count += 1;
        return c() * c();
    });

    assertEquals(count, 0);
    assertEquals(d(), 9);

    a.mut(_ => 2);
    b.mut(_ => 1);
    
    assertEquals(count, 1);
    assertEquals(d(), 9);
    assertEquals(count, 1);
});

Deno.test("references are tracked dynamically", () => {
    const visible = signal(true);
    const first = signal("Isaac");
    const last = signal("Newton");
    const initials = memo(() => visible() ? first().charAt(0) + last().charAt(0) : "**");

    assertEquals(initials(), "IN");

    last.mut(_ => "Asimov");

    assertEquals(initials.isStale(), true);

    visible.mut(_ => false);
    assertEquals(initials(), '**');

    assertEquals(initials.isStale(), false);

    first.mut(_ => 'Ada');
    last.mut(_ => 'Lovelace');

    assertEquals(initials.isStale(), false);
});

Deno.test("effect runs once upon initialization", () => {
    let flag = false;
    effect(() => flag = true);
    assertEquals(flag, true);
})

Deno.test("effect runs on state mutation", () => {
    let count = 0;
    const step = signal(0);
    effect(() => count += step());
    assertEquals(count, 0);
    step.mut(_ => 1);
    assertEquals(count, 1);
    step.mut(_ => 2);
    assertEquals(count, 3);
    step.mut(_ => 10);
    assertEquals(count, 13);
});

Deno.test("effect runs only once in diamond dependency graph", () => {
    let result = 0;
    const count = signal(3);
    const double = memo(() => count() + count());
    const square = memo(() => count() * count());
    effect(() => result += double() + square());
    assertEquals(result, 15);
    count.mut(_ => 4);
    assertEquals(result, 39);
});

Deno.test("effect skipped if dependency unchanged", () => {
    let result = 0;
    const flag = signal(false);
    const oneOrTwo = memo(() => flag() ? 1 : 2);
    const threeMinusOneOrTwo = memo(() => 3 - oneOrTwo());
    const three = memo(() => threeMinusOneOrTwo() + oneOrTwo());
    effect(() => result += three());
    assertEquals(result, 3);
    flag.mut(f => !f);
    assertEquals(result, 3);
});

Deno.test("batch updates run once", () => {
    let count = 0;
    const a = signal(0);
    const b = signal(0);
    const c = signal(0);
    effect(() => (a(), b(), c(), count += 1));

    assertEquals(count, 1);
    a.mut(x => x + 1);
    b.mut(x => x + 1);
    c.mut(x => x + 1);
    assertEquals(count, 4);

    batch(() => {
        a.mut(x => x + 1);
        b.mut(x => x + 1);
        c.mut(x => x + 1);
    });

    assertEquals(count, 5);
});
