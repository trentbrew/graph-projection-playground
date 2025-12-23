'use client';

import React, { useMemo } from 'react';

interface SankeyDiagramProps {
  data: {
    nodes: any[];
    edges: any[];
  };
}

export function SankeyDiagram({ data }: SankeyDiagramProps) {
  const width = 800;
  const height = 600;
  const nodeWidth = 20;
  const nodePadding = 30;

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      Person: '#8b5cf6',
      Organization: '#06b6d4',
      Product: '#f59e0b',
      Class: '#ef4444',
      Function: '#3b82f6',
      Portfolio: '#10b981',
      Position: '#f59e0b',
      Service: '#3b82f6',
      Database: '#ef4444',
      default: '#6366f1',
    };
    return colors[type] || colors.default;
  };

  const sankeyData = useMemo(() => {
    // Build node layers based on graph structure
    const nodeMap = new Map(
      data.nodes.map((n) => [n.id, { ...n, layer: -1, value: 0 }]),
    );
    const visited = new Set<string>();

    // Find root nodes (nodes with no incoming edges)
    const rootNodes = data.nodes.filter(
      (n) => !data.edges.some((e) => e.target === n.id),
    );

    // Assign layers using BFS
    const queue: Array<{ id: string; layer: number }> = rootNodes.map((n) => ({
      id: n.id,
      layer: 0,
    }));

    while (queue.length > 0) {
      const { id, layer } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodeMap.get(id);
      if (node) {
        node.layer = Math.max(node.layer, layer);

        // Add children to queue
        data.edges
          .filter((e) => e.source === id)
          .forEach((e) => {
            queue.push({ id: e.target, layer: layer + 1 });
          });
      }
    }

    // Group nodes by layer
    const layers: any[][] = [];
    nodeMap.forEach((node) => {
      if (node.layer >= 0) {
        if (!layers[node.layer]) layers[node.layer] = [];
        layers[node.layer].push(node);
      }
    });

    // Calculate node values (number of connections)
    data.edges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (sourceNode) sourceNode.value += 1;
      if (targetNode) targetNode.value += 1;
    });

    // Position nodes
    const layerWidth = (width - nodeWidth) / Math.max(layers.length - 1, 1);
    const positionedNodes: any[] = [];

    layers.forEach((layerNodes, layerIndex) => {
      const layerHeight = height - nodePadding * 2;
      const nodeHeight = Math.max(
        20,
        (layerHeight - nodePadding * (layerNodes.length - 1)) /
          layerNodes.length,
      );

      layerNodes.forEach((node, nodeIndex) => {
        positionedNodes.push({
          ...node,
          x: layerIndex * layerWidth + nodeWidth / 2,
          y: nodePadding + nodeIndex * (nodeHeight + nodePadding),
          width: nodeWidth,
          height: Math.max(nodeHeight, node.value * 10),
        });
      });
    });

    // Create links
    const links = data.edges
      .map((edge) => {
        const source = positionedNodes.find((n) => n.id === edge.source);
        const target = positionedNodes.find((n) => n.id === edge.target);
        if (!source || !target) return null;

        return {
          source,
          target,
          predicate: edge.predicate,
          value: 1,
        };
      })
      .filter(Boolean);

    return { nodes: positionedNodes, links };
  }, [data]);

  const createLinkPath = (link: any) => {
    const x0 = link.source.x + link.source.width;
    const x1 = link.target.x;
    const y0 = link.source.y + link.source.height / 2;
    const y1 = link.target.y + link.target.height / 2;
    const xi = (x0 + x1) / 2;

    return `M${x0},${y0} C${xi},${y0} ${xi},${y1} ${x1},${y1}`;
  };

  if (sankeyData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-500">
        No hierarchical relationships found for Sankey diagram
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <svg width={width} height={height} className="bg-slate-900 rounded-lg">
        <defs>
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Links */}
        <g>
          {sankeyData.links.map((link: any, i: number) => (
            <g key={i}>
              <path
                d={createLinkPath(link)}
                fill="none"
                stroke="url(#linkGradient)"
                strokeWidth={Math.max(2, link.value * 3)}
                opacity={0.6}
              />
            </g>
          ))}
        </g>

        {/* Nodes */}
        <g>
          {sankeyData.nodes.map((node: any) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                fill={getTypeColor(node.type)}
                stroke="#1e293b"
                strokeWidth={2}
                rx={4}
                opacity={0.9}
              />
              <text
                x={node.x + node.width + 8}
                y={node.y + node.height / 2}
                dominantBaseline="middle"
                className="text-xs fill-slate-300"
              >
                {node.label}
              </text>
              <text
                x={node.x + node.width + 8}
                y={node.y + node.height / 2 + 12}
                dominantBaseline="middle"
                className="text-xs fill-slate-500"
              >
                {node.type}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
