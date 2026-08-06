"use client";

// TEMPORARY verification harness — delete before committing.

import { useCallback, useState } from "react";
import { AgentCanvas } from "@/components/canvas/AgentCanvas";
import { buildScene, sceneToPng, sceneToSvg } from "@/lib/canvas-export";
import { demoGraphAt } from "@/lib/demo-agent";
import { addNode, newSubagent, nodeById, orchestratorOf, slotUnder, type AgentGraph } from "@/lib/graph";
import { useGraphHistory } from "@/lib/use-graph-history";

export default function CanvasLab() {
  const [graph, setGraph] = useState<AgentGraph>(() => demoGraphAt(3));
  const [selection, setSelection] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [svg, setSvg] = useState<string>("");
  const [png, setPng] = useState<string>("");
  const apply = useCallback((next: AgentGraph) => setGraph(next), []);
  const history = useGraphHistory(graph, apply);

  const preview = async () => {
    const scene = buildScene(graph);
    setSvg(await sceneToSvg(scene));
    const blob = await sceneToPng(scene);
    setPng(blob ? URL.createObjectURL(blob) : "");
  };

  return (
    <div className="p-6">
      <AgentCanvas
        graph={graph}
        onChange={history.commit}
        selection={selection}
        onSelectionChange={setSelection}
        onAddSubagent={(at, ownerId) => {
          const root = orchestratorOf(graph);
          const owner = (ownerId ? nodeById(graph, ownerId) : null) ?? nodeById(graph, selection[0]) ?? root;
          if (!owner) return;
          const slot = at ?? slotUnder(graph, owner.id);
          const node = newSubagent(owner, Math.round(slot.x), Math.round(slot.y), graph);
          history.commit(addNode(graph, node, owner.id));
          setSelection([node.id]);
        }}
        onEditNode={(id) => console.log("edit fields for", id)}
        locked={locked}
        onLockedChange={setLocked}
        history={history}
        className="h-[560px]"
      />
      <button id="preview" onClick={preview} className="mt-4 border-2 border-line px-3 py-1 font-mono text-xs">
        preview export
      </button>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div id="svg-out" className="border-2 border-line" dangerouslySetInnerHTML={{ __html: svg }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {png && <img id="png-out" src={png} alt="png export" className="border-2 border-line max-w-full" />}
      </div>
    </div>
  );
}
