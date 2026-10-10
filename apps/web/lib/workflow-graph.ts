import type { WorkflowGraph, WorkflowNode } from "@zfunnel/db/schema";

/**
 * Pure operations on an automation's step tree. Shared by the builder (client)
 * and the save action (server), which re-validates whatever the client sends.
 */
export type Slot = { parent: "trigger" } | { parent: string; branch: "next" | "yes" | "no" };
export type NodeType = WorkflowNode["type"];
export const MAX_NODES = 100;

const newId = () => `n_${Math.random().toString(36).slice(2, 10)}`;

export function blankNode(type: NodeType, id = newId()): WorkflowNode {
  switch (type) {
    case "send_email":
      return { id, type, emailId: null };
    case "wait":
      return { id, type, amount: 1, unit: "days" };
    case "add_tag":
    case "remove_tag":
      return { id, type, tag: "" };
    case "condition":
      return { id, type, rule: null };
    case "webhook":
      return { id, type, url: "" };
    case "grant_course":
      return { id, type, courseId: null };
  }
}

function getSlot(g: WorkflowGraph, slot: Slot): string | null {
  if (slot.parent === "trigger") return g.start;
  const p = g.nodes[slot.parent] as Record<string, unknown> | undefined;
  return (p?.[(slot as { branch: string }).branch] as string | null | undefined) ?? null;
}
function setSlot(g: WorkflowGraph, slot: Slot, id: string | null): WorkflowGraph {
  if (slot.parent === "trigger") return { ...g, start: id };
  const p = g.nodes[slot.parent]!;
  return { ...g, nodes: { ...g.nodes, [p.id]: { ...p, [(slot as { branch: string }).branch]: id } as WorkflowNode } };
}

/** Inserts a node into a slot; whatever was there continues after it (a condition's "Yes" path). */
export function insertNode(g: WorkflowGraph, slot: Slot, node: WorkflowNode): WorkflowGraph {
  const after = getSlot(g, slot);
  const n = (node.type === "condition" ? { ...node, yes: after, no: null } : { ...node, next: after }) as WorkflowNode;
  return setSlot({ ...g, nodes: { ...g.nodes, [n.id]: n } }, slot, n.id);
}

function children(n: WorkflowNode) {
  return n.type === "condition" ? [n.yes, n.no] : [n.next];
}
function subtree(g: WorkflowGraph, id: string | null | undefined, out = new Set<string>()) {
  if (!id || out.has(id) || !g.nodes[id]) return out;
  out.add(id);
  for (const c of children(g.nodes[id]!)) subtree(g, c, out);
  return out;
}

/** Removes a node. Its path continues in its place; a condition keeps its "Yes" path and drops "No". */
export function removeNode(g: WorkflowGraph, id: string): WorkflowGraph {
  const node = g.nodes[id];
  if (!node) return g;
  const cont = node.type === "condition" ? (node.yes ?? null) : (node.next ?? null);
  let slot: Slot | null = g.start === id ? { parent: "trigger" } : null;
  for (const p of Object.values(g.nodes)) {
    for (const b of ["next", "yes", "no"] as const)
      if ((p as Record<string, unknown>)[b] === id) slot = { parent: p.id, branch: b };
  }
  const dropped = node.type === "condition" ? subtree(g, node.no) : new Set<string>();
  dropped.add(id);
  const nodes = Object.fromEntries(Object.entries(g.nodes).filter(([k]) => !dropped.has(k)));
  return slot ? setSlot({ ...g, nodes }, slot, cont) : { ...g, nodes };
}

export function updateNode(g: WorkflowGraph, node: WorkflowNode): WorkflowGraph {
  if (!g.nodes[node.id]) return g;
  return { ...g, nodes: { ...g.nodes, [node.id]: node } };
}

/** Server-side check: a tree rooted at start, every node reachable exactly once, no cycles. */
export function validateGraph(g: WorkflowGraph): string | null {
  const ids = Object.keys(g.nodes);
  if (ids.length > MAX_NODES) return `An automation can have at most ${MAX_NODES} steps.`;
  const seen = new Set<string>();
  const stack = g.start ? [g.start] : [];
  while (stack.length) {
    const id = stack.pop()!;
    const n = g.nodes[id];
    if (!n || n.id !== id) return "Broken step reference.";
    if (seen.has(id)) return "Steps cannot loop back.";
    seen.add(id);
    for (const c of children(n)) if (c) stack.push(c);
  }
  if (seen.size !== ids.length) return "Some steps are disconnected.";
  return null;
}

/** Tree layout for the canvas: x centred over each subtree, fixed row height. */
export function layout(g: WorkflowGraph, colW = 300, rowH = 150) {
  const pos: Record<string, { x: number; y: number }> = {};
  const width = (id: string | null | undefined): number => {
    const n = id ? g.nodes[id] : undefined;
    if (!n) return 1;
    if (n.type === "condition") return width(n.yes) + width(n.no);
    return width(n.next);
  };
  const ends: { slot: Slot; x: number; y: number }[] = [];
  const place = (id: string | null | undefined, slot: Slot, x0: number, depth: number) => {
    const n = id ? g.nodes[id] : undefined;
    const w = width(id);
    const cx = x0 + (w * colW) / 2;
    if (!n) {
      ends.push({ slot, x: cx, y: depth * rowH });
      return;
    }
    pos[n.id] = { x: cx, y: depth * rowH };
    if (n.type === "condition") {
      const wy = width(n.yes);
      place(n.yes, { parent: n.id, branch: "yes" }, x0, depth + 1);
      place(n.no, { parent: n.id, branch: "no" }, x0 + wy * colW, depth + 1);
    } else place(n.next, { parent: n.id, branch: "next" }, x0, depth + 1);
  };
  const total = width(g.start);
  pos.trigger = { x: (total * colW) / 2, y: 0 };
  place(g.start, { parent: "trigger" }, 0, 1);
  return { pos, ends };
}

/** Nodes in the order a contact meets them (depth-first, Yes before No). */
export function flowOrder(g: WorkflowGraph): WorkflowNode[] {
  const out: WorkflowNode[] = [];
  const visit = (id: string | null | undefined) => {
    const n = id ? g.nodes[id] : undefined;
    if (!n || out.includes(n)) return;
    out.push(n);
    for (const c of children(n)) visit(c);
  };
  visit(g.start);
  return out;
}
