"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { T } from "@zfunnel/i18n";
import { useT } from "@zfunnel/i18n/react";
import { toast } from "@zfunnel/ui/toaster";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { connectSteps, saveMapPositions } from "@/lib/funnel-actions";
import type { StepType } from "@/lib/funnels";
import { STEP_COLORS, stepLabelKey } from "./step-type";

type MapStep = {
  id: string;
  name: string;
  type: StepType;
  x: number;
  y: number;
  nextStepId: string | null;
  declineStepId: string | null;
  status: "live" | "changed" | "draft";
  index: number;
};
type StepNodeData = { step: MapStep };

function StepNode({ data, selected }: NodeProps<Node<StepNodeData>>) {
  const t = useT();
  const s = data.step;
  const color = STEP_COLORS[s.type];
  const hasDecline = s.type === "upsell" || s.type === "downsell";
  return (
    <div
      className="w-56 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-md transition-shadow"
      style={selected ? { boxShadow: `0 0 0 3px ${color}55, 0 10px 30px -10px rgba(0,0,0,.3)` } : undefined}
    >
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-white !bg-zinc-400" />
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white" style={{ background: color }}>
        <span className="flex size-5 items-center justify-center rounded bg-white/25 text-[11px]">{s.index + 1}</span>
        {t(stepLabelKey(s.type))}
      </div>
      <div className="px-3 py-2.5">
        <div className="truncate text-sm font-medium">{s.name}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {s.status === "draft" ? "○" : "●"} {t(`funnels.status.${s.status}`)}
        </div>
      </div>
      <Handle
        id="next"
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-white !bg-emerald-500"
        title={t("funnels.mapNextHandle")}
      />
      {hasDecline && (
        <Handle
          id="decline"
          type="source"
          position={Position.Bottom}
          className="!size-3 !border-2 !border-white !bg-rose-500"
          title={t("funnels.mapDeclineHandle")}
        />
      )}
    </div>
  );
}

const nodeTypes = { step: StepNode };

function toEdges(steps: MapStep[], t: T): Edge[] {
  return steps.flatMap((s) => [
    ...(s.nextStepId
      ? [
          {
            id: `${s.id}-next`,
            source: s.id,
            sourceHandle: "next",
            target: s.nextStepId,
            animated: true,
            label: s.type === "upsell" || s.type === "downsell" ? t("funnels.mapYes") : undefined,
            style: { stroke: "#10b981", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
          },
        ]
      : []),
    ...(s.declineStepId
      ? [
          {
            id: `${s.id}-decline`,
            source: s.id,
            sourceHandle: "decline",
            target: s.declineStepId,
            label: t("funnels.mapNoThanks"),
            style: { stroke: "#f43f5e", strokeWidth: 2, strokeDasharray: "6 4" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#f43f5e" },
          },
        ]
      : []),
  ]);
}

export function FunnelMap({
  steps,
  workspaceSlug,
  funnelId,
  base,
}: {
  steps: MapStep[];
  workspaceSlug: string;
  funnelId: string;
  base: string;
}) {
  const t = useT();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [nodes, , onNodesChange] = useNodesState<Node<StepNodeData>>(
    steps.map((s) => ({ id: s.id, type: "step", position: { x: s.x, y: s.y }, data: { step: s } })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(steps, t));

  const onConnect = useCallback(
    async (c: Connection) => {
      if (!c.source || !c.target) return;
      const kind = c.sourceHandle === "decline" ? "decline" : "next";
      const res = await connectSteps(workspaceSlug, funnelId, c.source, kind, c.target);
      if (!res.ok) return toast.error(res.error);
      setEdges((eds) => {
        const rest = eds.filter((e) => e.id !== `${c.source}-${kind}`);
        const step = {
          ...steps.find((s) => s.id === c.source)!,
          nextStepId: null,
          declineStepId: null,
          [kind === "next" ? "nextStepId" : "declineStepId"]: c.target,
        };
        return [...rest, ...toEdges([step as MapStep], t)];
      });
      toast.success(kind === "next" ? t("funnels.mapNextUpdated") : t("funnels.mapDeclineUpdated"));
      router.refresh();
    },
    [workspaceSlug, funnelId, setEdges, steps, router, t],
  );

  return (
    <div className="h-[min(70dvh,640px)] overflow-hidden rounded-xl border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={(_, __, dragged) => {
          void saveMapPositions(
            workspaceSlug,
            funnelId,
            dragged.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
          );
        }}
        onEdgesDelete={async (deleted) => {
          for (const e of deleted)
            await connectSteps(
              workspaceSlug,
              funnelId,
              e.source,
              e.sourceHandle === "decline" ? "decline" : "next",
              null,
            );
          toast.success(t("funnels.mapConnectionRemoved"));
          router.refresh();
        }}
        onNodeDoubleClick={(_, n) => router.push(`${base}?step=${n.id}`)}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => STEP_COLORS[(n.data as StepNodeData).step.type]}
          className="!rounded-lg !border"
        />
      </ReactFlow>
    </div>
  );
}
