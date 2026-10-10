"use client";

import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowGraph, WorkflowNode, WorkflowTrigger } from "@zfunnel/db/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { cn } from "@zfunnel/ui/lib/utils";
import { PlusIcon, ZapIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { createContext, useContext, useMemo } from "react";
import { layout, type NodeType, type Slot } from "@/lib/workflow-graph";
import { NODE_META, NODE_ORDER, nodeSummary, TRIGGER_META, triggerSummary, type Lookups } from "./meta";

type Ctx = { onAdd: (slot: Slot, type: NodeType) => void; readOnly: boolean };
const CanvasCtx = createContext<Ctx>({ onAdd: () => {}, readOnly: false });

const NODE_W = 256;

function AddMenu({ slot, children }: { slot: Slot; children: React.ReactNode }) {
  const { onAdd, readOnly } = useContext(CanvasCtx);
  if (readOnly) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Add a step</DropdownMenuLabel>
        {NODE_ORDER.map((t) => {
          const m = NODE_META[t];
          return (
            <DropdownMenuItem key={t} onClick={() => onAdd(slot, t)} className="gap-3 py-2">
              <span
                className="flex size-7 items-center justify-center rounded-md text-white"
                style={{ background: m.color }}
              >
                <m.icon className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.hint}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type CardData = {
  title: string;
  summary: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  branches?: boolean;
  error?: boolean;
};

function CardNode({ data, selected }: NodeProps<Node<CardData>>) {
  const Icon = data.icon;
  return (
    <div
      className={cn(
        "cursor-pointer rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      style={{ width: NODE_W }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      <div className="flex items-center gap-3 p-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ background: data.color }}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{data.kicker}</div>
          <div className="truncate text-sm font-semibold">{data.title}</div>
          <div
            className={cn(
              "truncate text-xs",
              data.error ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            {data.summary}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" isConnectable={false} />
    </div>
  );
}

function AdderNode({ data }: NodeProps<Node<{ slot: Slot; label?: string }>>) {
  const { readOnly } = useContext(CanvasCtx);
  return (
    <div className="flex flex-col items-center" style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      {readOnly ? (
        <span className="rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">End</span>
      ) : (
        <AddMenu slot={data.slot}>
          <button
            type="button"
            className="nodrag nopan flex items-center gap-1.5 rounded-full border border-dashed border-primary/50 bg-background px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
          >
            <PlusIcon className="size-3.5" /> {data.label ?? "Add step"}
          </button>
        </AddMenu>
      )}
    </div>
  );
}

function InsertEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
}: EdgeProps<Edge<{ slot: Slot; label?: string; adder?: boolean }>>) {
  const [path, , ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, borderRadius: 16 });
  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex flex-col items-center gap-1"
          style={{ transform: `translate(-50%, -50%) translate(${targetX}px, ${(ly + targetY) / 2}px)` }}
        >
          {data?.label && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
                data.label === "Yes" ? "bg-emerald-500" : "bg-rose-500",
              )}
            >
              {data.label}
            </span>
          )}
          {!data?.adder && data?.slot && (
            <AddMenu slot={data.slot}>
              <button
                type="button"
                aria-label="Insert step"
                className="flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </AddMenu>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { card: CardNode, adder: AdderNode };
const edgeTypes = { insert: InsertEdge };

export function WorkflowCanvas({
  graph,
  trigger,
  lookups,
  selected,
  onSelect,
  onAdd,
  readOnly,
}: {
  graph: WorkflowGraph;
  trigger: WorkflowTrigger;
  lookups: Lookups;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (slot: Slot, type: NodeType) => void;
  readOnly: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const { nodes, edges } = useMemo(() => {
    const { pos, ends } = layout(graph);
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const tm = TRIGGER_META[trigger.type];
    const tSummary = triggerSummary(trigger, lookups);
    nodes.push({
      id: "trigger",
      type: "card",
      position: { x: pos.trigger!.x - NODE_W / 2, y: pos.trigger!.y },
      selected: selected === "trigger",
      data: {
        title: tm.label,
        summary: tSummary,
        color: "#7c3aed",
        icon: ZapIcon,
        kicker: "Trigger",
        error: tSummary === "Choose a tag",
      } satisfies CardData,
    });
    const stroke = { stroke: "var(--color-border, #d4d4d8)", strokeWidth: 2 };
    const edgeTo = (source: string, target: string, slot: Slot, label?: string, adder?: boolean) =>
      edges.push({
        id: `${source}->${target}`,
        source,
        target,
        type: "insert",
        style: stroke,
        data: { slot, label, adder },
      });
    for (const n of Object.values(graph.nodes) as WorkflowNode[]) {
      const p = pos[n.id];
      if (!p) continue;
      const m = NODE_META[n.type];
      const summary = nodeSummary(n, lookups);
      nodes.push({
        id: n.id,
        type: "card",
        position: { x: p.x - NODE_W / 2, y: p.y },
        selected: selected === n.id,
        data: {
          title: m.label,
          summary,
          color: m.color,
          icon: m.icon,
          kicker: "Step",
          error: /^(Choose|Set)/.test(summary),
        } satisfies CardData,
      });
    }
    // Edges from parents, keyed by slot.
    const parentOf = (slot: Slot) => slot.parent;
    for (const n of Object.values(graph.nodes) as WorkflowNode[]) {
      if (n.type === "condition") {
        if (n.yes) edgeTo(n.id, n.yes, { parent: n.id, branch: "yes" }, "Yes");
        if (n.no) edgeTo(n.id, n.no, { parent: n.id, branch: "no" }, "No");
      } else if (n.next) edgeTo(n.id, n.next, { parent: n.id, branch: "next" });
    }
    if (graph.start) edgeTo("trigger", graph.start, { parent: "trigger" });
    ends.forEach((e, i) => {
      const id = `end-${i}`;
      const parent = parentOf(e.slot);
      const branch = "branch" in e.slot ? e.slot.branch : undefined;
      nodes.push({
        id,
        type: "adder",
        position: { x: e.x - NODE_W / 2, y: e.y + 10 },
        selectable: false,
        data: { slot: e.slot },
      });
      edgeTo(parent, id, e.slot, branch === "yes" ? "Yes" : branch === "no" ? "No" : undefined, true);
    });
    return { nodes, edges };
  }, [graph, trigger, lookups, selected]);

  return (
    <CanvasCtx.Provider value={{ onAdd, readOnly }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, n) => n.type === "card" && onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </CanvasCtx.Provider>
  );
}
