import type { WorkflowGraph } from "@zfunnel/db/schema";
import { describe, expect, it } from "vitest";
import { blankNode, insertNode, layout, removeNode, validateGraph } from "./workflow-graph";

const empty: WorkflowGraph = { start: null, nodes: {} };

describe("workflow graph", () => {
  it("inserts steps in order and keeps the tree valid", () => {
    let g = insertNode(empty, { parent: "trigger" }, blankNode("send_email", "a"));
    g = insertNode(g, { parent: "a", branch: "next" }, blankNode("wait", "b"));
    g = insertNode(g, { parent: "a", branch: "next" }, blankNode("add_tag", "c")); // between a and b
    expect(g.start).toBe("a");
    expect(g.nodes.a).toMatchObject({ next: "c" });
    expect(g.nodes.c).toMatchObject({ next: "b" });
    expect(validateGraph(g)).toBeNull();
  });

  it("a new condition continues the old path on Yes", () => {
    let g = insertNode(empty, { parent: "trigger" }, blankNode("send_email", "a"));
    g = insertNode(g, { parent: "trigger" }, blankNode("condition", "if"));
    expect(g.nodes.if).toMatchObject({ yes: "a", no: null });
    g = insertNode(g, { parent: "if", branch: "no" }, blankNode("wait", "w"));
    expect(validateGraph(g)).toBeNull();
    const { pos, ends } = layout(g);
    expect(pos.a!.x).toBeLessThan(pos.w!.x);
    expect(ends).toHaveLength(2);
  });

  it("removing a condition keeps Yes and drops the No branch", () => {
    let g = insertNode(empty, { parent: "trigger" }, blankNode("condition", "if"));
    g = insertNode(g, { parent: "if", branch: "yes" }, blankNode("send_email", "y"));
    g = insertNode(g, { parent: "if", branch: "no" }, blankNode("wait", "n"));
    g = removeNode(g, "if");
    expect(g.start).toBe("y");
    expect(Object.keys(g.nodes)).toEqual(["y"]);
    expect(validateGraph(g)).toBeNull();
  });

  it("rejects loops, dangling references and orphans", () => {
    expect(
      validateGraph({ start: "a", nodes: { a: { id: "a", type: "wait", amount: 1, unit: "days", next: "a" } } }),
    ).toMatch(/loop/);
    expect(validateGraph({ start: "a", nodes: {} })).toMatch(/Broken/);
    expect(validateGraph({ start: null, nodes: { a: { id: "a", type: "add_tag", tag: "x" } } })).toMatch(
      /disconnected/,
    );
  });
});
