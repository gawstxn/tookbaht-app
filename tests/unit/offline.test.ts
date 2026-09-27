import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDuplicate, isNetworkError, outbox, runOp, snapshot, type KeyValueStore, type Op } from "@/lib/offline";

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

/** Records the query-builder calls runOp makes. */
function fakeClient() {
  const calls: unknown[][] = [];
  const builder: Record<string, (...a: unknown[]) => unknown> = {};
  for (const m of ["insert", "upsert", "update", "delete", "eq", "in"]) {
    builder[m] = (...a: unknown[]) => {
      calls.push([m, ...a]);
      return builder;
    };
  }
  const sb = { from: (t: string) => (calls.push(["from", t]), builder), rpc: (...a: unknown[]) => (calls.push(["rpc", ...a]), builder) } as unknown as SupabaseClient;
  return { sb, calls };
}

describe("offline outbox", () => {
  const op: Op = { table: "transactions", kind: "insert", rows: { id: "t1", amount: 65 } };

  it("keeps writes in order per user and removes them once sent", () => {
    const s = memory();
    const box = outbox("u1", s);
    expect(box.push(op)).toBe(1);
    expect(box.push({ table: "transactions", kind: "delete", match: { col: "id", eq: "t1" } })).toBe(2);
    expect(outbox("u2", s).list()).toEqual([]);
    const [first, second] = box.list();
    expect(first.op.kind).toBe("insert");
    expect(box.shift(first.id)).toBe(1);
    expect(box.list()[0].id).toBe(second.id);
    expect(box.shift(second.id)).toBe(0);
    expect(s.data.size).toBe(0);
  });

  it("survives broken or missing storage", () => {
    const broken: KeyValueStore = {
      getItem: () => "{not json",
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    expect(outbox("u", broken).list()).toEqual([]);
    expect(outbox("u", broken).push(op)).toBe(0);
    expect(outbox("u", null).list()).toEqual([]);
  });

  it("stores and clears the data snapshot", () => {
    const s = memory();
    const snap = snapshot<{ n: number }>("u1", s);
    expect(snap.read()).toBeNull();
    snap.save({ n: 3 });
    expect(snap.read()?.data).toEqual({ n: 3 });
    snap.clear();
    expect(snap.read()).toBeNull();
  });
});

describe("replaying writes", () => {
  it("builds the same queries the store used to make", () => {
    const { sb, calls } = fakeClient();
    void runOp(sb, { table: "ious", kind: "update", values: { settled_on: null }, match: { col: "id", eq: "i1" } });
    void runOp(sb, { table: "transactions", kind: "update", values: { subscription_id: "s" }, match: { col: "id", in: ["a", "b"] } });
    void runOp(sb, { table: "accounts", kind: "delete", match: { col: "id", eq: "a1" } });
    void runOp(sb, { table: "goals", kind: "upsert", rows: { user_id: "u" } });
    void runOp(sb, { kind: "rpc", fn: "merge_settings", args: { patch: { lang: "en" } } });
    expect(calls).toEqual([
      ["from", "ious"], ["update", { settled_on: null }], ["eq", "id", "i1"],
      ["from", "transactions"], ["update", { subscription_id: "s" }], ["in", "id", ["a", "b"]],
      ["from", "accounts"], ["delete"], ["eq", "id", "a1"],
      ["from", "goals"], ["upsert", { user_id: "u" }],
      ["rpc", "merge_settings", { patch: { lang: "en" } }],
    ]);
  });

  it("tells a lost connection from a refused write", () => {
    expect(isNetworkError({ error: { message: "TypeError: Failed to fetch" }, status: 0 })).toBe(true);
    expect(isNetworkError({ error: { message: "TypeError: Load failed" }, status: 400 })).toBe(true);
    expect(isNetworkError({ error: { message: "JWT expired" }, status: 401 })).toBe(true);
    expect(isNetworkError({ error: { message: "violates check constraint", code: "23514" }, status: 400 })).toBe(false);
    expect(isNetworkError({ error: null, status: 201 })).toBe(false);
  });

  it("treats a replayed insert that already landed as done", () => {
    expect(isDuplicate({ error: { code: "23505" }, status: 409 })).toBe(true);
    expect(isDuplicate({ error: { code: "23503" }, status: 409 })).toBe(false);
  });
});
