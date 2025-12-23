'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sampleDatasets, defaultDataset } from './data';
import { CardGridView } from './components/CardGridView';
import { FormDetailView } from './components/FormDetailView';
import { SankeyDiagram } from './components/SankeyDiagram';
import {
  Atom,
  Circle,
  Minus,
  Disc,
  Sparkles,
  Grid3x3,
  Waves,
  Database,
  Calendar,
  GanttChart as GanttChartIcon,
  LayoutGrid,
  CreditCard,
  Trello,
  FileEdit,
  Filter,
  Menu,
  Sparkle,
} from 'lucide-react';

// ============ UTILITIES ============
function stripJsonComments(jsonString: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < jsonString.length) {
    const char = jsonString[i];
    const nextChar = jsonString[i + 1];

    // Handle string boundaries
    if (
      (char === '"' || char === "'") &&
      (i === 0 || jsonString[i - 1] !== '\\')
    ) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      result += char;
      i++;
      continue;
    }

    // Skip comments only if not in a string
    if (!inString) {
      // Handle // comments
      if (char === '/' && nextChar === '/') {
        // Skip until end of line
        i += 2;
        while (i < jsonString.length && jsonString[i] !== '\n') {
          i++;
        }
        continue;
      }

      // Handle /* */ comments
      if (char === '/' && nextChar === '*') {
        // Skip until */
        i += 2;
        while (i < jsonString.length - 1) {
          if (jsonString[i] === '*' && jsonString[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
    }

    result += char;
    i++;
  }

  return result;
}

// ============ JSON-LD PARSER ============
function parseJsonLd(doc: any) {
  const nodes: any[] = [];
  const edges: any[] = [];
  const nodeMap = new Map();

  // Reserved JSON-LD keywords that aren't predicates
  const reserved = new Set([
    '@context',
    '@id',
    '@type',
    '@graph',
    '@value',
    '@language',
    '@list',
    '@set',
  ]);

  // Extract type name from URI
  function getTypeName(type: any) {
    if (!type) return 'Thing';
    const str = Array.isArray(type) ? type[0] : type;
    if (str.includes('#')) return str.split('#').pop();
    if (str.includes('/')) return str.split('/').pop();
    return str;
  }

  // Extract short ID from URI
  function getShortId(id: any) {
    if (!id) return null;
    if (id.includes(':')) return id.split(':').pop();
    if (id.includes('#')) return id.split('#').pop();
    if (id.includes('/')) return id.split('/').pop();
    return id;
  }

  // Process a single node object
  function processNode(obj: any, parentId: any = null, predicate: any = null) {
    if (!obj || typeof obj !== 'object') return null;

    // Handle @value (literal)
    if ('@value' in obj) return null;

    // Get or generate ID
    let id = obj['@id'];
    if (!id) {
      id = `_:b${nodes.length}`;
    }

    // Check if node already exists
    if (!nodeMap.has(id)) {
      const type = getTypeName(obj['@type']);
      const label = obj.name || obj.label || obj.title || getShortId(id) || id;

      const node = {
        id,
        label: typeof label === 'object' ? label['@value'] || id : label,
        type,
        properties: {} as Record<string, any>,
      };

      // Extract literal properties
      Object.entries(obj).forEach(([key, value]) => {
        if (reserved.has(key)) return;
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          node.properties[key] = value;
        } else if (value && typeof value === 'object' && '@value' in value) {
          node.properties[key] = value['@value'];
        }
      });

      nodes.push(node);
      nodeMap.set(id, node);
    }

    // Create edge from parent
    if (parentId && predicate) {
      edges.push({
        source: parentId,
        target: id,
        predicate: getShortId(predicate) || predicate,
      });
    }

    // Process nested objects and URI references (relationships)
    Object.entries(obj).forEach(([key, value]) => {
      if (reserved.has(key)) return;

      const values = Array.isArray(value) ? value : [value];
      values.forEach((v) => {
        if (v && typeof v === 'object' && !('@value' in v)) {
          // Nested object with @id
          processNode(v, id, key);
        } else if (
          typeof v === 'string' &&
          (v.startsWith('http://') ||
            v.startsWith('https://') ||
            v.startsWith('_:'))
        ) {
          // String URI reference - create edge to referenced node
          edges.push({
            source: id,
            target: v,
            predicate: getShortId(key) || key,
          });
        }
      });
    });

    return id;
  }

  // Handle @graph or single object
  const root = doc['@graph'] || doc;
  const items = Array.isArray(root) ? root : [root];
  items.forEach((item) => processNode(item));

  return { nodes, edges };
}

// ============ TYPE COLORS ============
const typeColorMap: Record<string, string> = {};
const colorPalette = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#3b82f6',
  '#06b6d4',
  '#f43f5e',
  '#84cc16',
];

function getTypeColor(type: any) {
  if (!typeColorMap[type]) {
    const index = Object.keys(typeColorMap).length % colorPalette.length;
    typeColorMap[type] = colorPalette[index];
  }
  return typeColorMap[type];
}

// ============ FORCE-DIRECTED GRAPH ============
function ForceDirectedGraph({ data }: any) {
  const [positions, setPositions] = useState({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 550;
  const height = 420;

  useEffect(() => {
    const initial: Record<string, any> = {};
    data.nodes.forEach((node: any, i: number) => {
      const angle = (i / data.nodes.length) * 2 * Math.PI;
      const r = 100 + Math.random() * 50;
      initial[node.id] = {
        x: width / 2 + r * Math.cos(angle),
        y: height / 2 + r * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });
    // Use setTimeout to avoid calling setState synchronously within effect
    setTimeout(() => setPositions(initial), 0);
  }, [data]);

  useEffect(() => {
    if (Object.keys(positions).length === 0) return;

    const interval = setInterval(() => {
      setPositions((prev) => {
        const next: Record<string, any> = { ...prev };
        const centerX = width / 2;
        const centerY = height / 2;

        data.nodes.forEach((node: any) => {
          if (!next[node.id] || dragging === node.id) return;
          let fx = 0,
            fy = 0;

          data.nodes.forEach((other: any) => {
            if (node.id === other.id || !next[other.id]) return;
            const dx = next[node.id].x - next[other.id].x;
            const dy = next[node.id].y - next[other.id].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 1000 / (dist * dist);
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          });

          data.edges.forEach((edge: any) => {
            let other = null;
            if (edge.source === node.id) other = edge.target;
            else if (edge.target === node.id) other = edge.source;
            if (other && next[other]) {
              const dx = next[other].x - next[node.id].x;
              const dy = next[other].y - next[node.id].y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (dist - 90) * 0.04;
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }
          });

          fx += (centerX - next[node.id].x) * 0.003;
          fy += (centerY - next[node.id].y) * 0.003;

          next[node.id] = {
            ...next[node.id],
            vx: (next[node.id].vx + fx) * 0.85,
            vy: (next[node.id].vy + fy) * 0.85,
            x: Math.max(
              40,
              Math.min(width - 40, next[node.id].x + next[node.id].vx * 0.1),
            ),
            y: Math.max(
              40,
              Math.min(height - 40, next[node.id].y + next[node.id].vy * 0.1),
            ),
          };
        });

        return next;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [positions, data, dragging]);

  const handleMouseMove = useCallback(
    (e: any) => {
      if (!dragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      setPositions((prev: Record<string, any>) => ({
        ...prev,
        [dragging]: {
          ...prev[dragging],
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          vx: 0,
          vy: 0,
        },
      }));
    },
    [dragging],
  );

  if (Object.keys(positions).length === 0) return null;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDragging(null)}
      onMouseLeave={() => setDragging(null)}
      className="cursor-grab"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="20"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
        </marker>
      </defs>

      {data.edges.map((edge: any, i: number) => {
        const source = (positions as Record<string, any>)[edge.source];
        const target = (positions as Record<string, any>)[edge.target];
        if (!source || !target) return null;
        const isHighlighted =
          hovered === edge.source || hovered === edge.target;
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;

        return (
          <g key={i}>
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isHighlighted ? '#94a3b8' : '#334155'}
              strokeWidth={isHighlighted ? 2 : 1}
              opacity={hovered && !isHighlighted ? 0.15 : 0.8}
              markerEnd="url(#arrowhead)"
            />
            {isHighlighted && (
              <text
                x={midX}
                y={midY - 6}
                textAnchor="middle"
                className="text-xs fill-slate-400"
              >
                {edge.predicate}
              </text>
            )}
          </g>
        );
      })}

      {data.nodes.map((node: any) => {
        const pos = (positions as Record<string, any>)[node.id];
        if (!pos) return null;
        const isHovered = hovered === node.id;
        const isConnected = data.edges.some(
          (e: any) =>
            (e.source === hovered && e.target === node.id) ||
            (e.target === hovered && e.source === node.id),
        );

        return (
          <g key={node.id}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={isHovered ? 14 : 11}
              fill={getTypeColor(node.type)}
              stroke={isHovered ? '#fff' : '#1e293b'}
              strokeWidth={isHovered ? 2 : 1}
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
              style={{ cursor: 'grab' }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={() => setDragging(node.id)}
            />
            <text
              x={pos.x}
              y={pos.y + 24}
              textAnchor="middle"
              className="text-xs fill-slate-300 pointer-events-none"
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============ RADIAL GRAPH ============
function RadialGraph({ data }: any) {
  const [hovered, setHovered] = useState<string | null>(null);
  const width = 480;
  const height = 480;
  const cx = width / 2;
  const cy = height / 2;

  // Group by type
  const typeGroups: Record<string, any[]> = {};
  data.nodes.forEach((node: any) => {
    if (!typeGroups[node.type]) typeGroups[node.type] = [];
    typeGroups[node.type].push(node);
  });

  const types = Object.keys(typeGroups);
  const ringStep = 160 / (types.length || 1);

  const nodePositions: Record<string, any> = {};
  types.forEach((type, typeIndex) => {
    const nodes = typeGroups[type];
    const radius = 40 + typeIndex * ringStep;
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
      nodePositions[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  });

  return (
    <svg width={width} height={height}>
      {types.map((_, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={40 + i * ringStep}
          fill="none"
          stroke="#1e293b"
          strokeDasharray="4 4"
        />
      ))}

      {data.edges.map((edge: any, i: number) => {
        const source = nodePositions[edge.source];
        const target = nodePositions[edge.target];
        if (!source || !target) return null;
        const isHighlighted =
          hovered === edge.source || hovered === edge.target;

        return (
          <line
            key={i}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={isHighlighted ? '#94a3b8' : '#334155'}
            strokeWidth={isHighlighted ? 2 : 1}
            opacity={hovered && !isHighlighted ? 0.1 : 0.6}
          />
        );
      })}

      {data.nodes.map((node: any) => {
        const pos = nodePositions[node.id];
        if (!pos) return null;
        const isHovered = hovered === node.id;
        const isConnected = data.edges.some(
          (e: any) =>
            (e.source === hovered && e.target === node.id) ||
            (e.target === hovered && e.source === node.id),
        );

        return (
          <g key={node.id}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={isHovered ? 12 : 9}
              fill={getTypeColor(node.type)}
              stroke={isHovered ? '#fff' : '#1e293b'}
              strokeWidth={isHovered ? 2 : 1}
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
            />
            <text
              x={pos.x}
              y={pos.y + 22}
              textAnchor="middle"
              className="text-xs fill-slate-400 pointer-events-none"
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============ ARC DIAGRAM ============
function ArcDiagram({ data }: any) {
  const [hovered, setHovered] = useState<string | null>(null);
  const width = 580;
  const height = 320;
  const nodeY = height - 50;

  const nodePositions: Record<string, any> = {};
  data.nodes.forEach((node: any, i: number) => {
    nodePositions[node.id] = {
      x: 50 + (i / (data.nodes.length - 1 || 1)) * (width - 100),
      y: nodeY,
    };
  });

  return (
    <svg width={width} height={height}>
      {data.edges.map((edge: any, i: number) => {
        const source = nodePositions[edge.source];
        const target = nodePositions[edge.target];
        if (!source || !target) return null;

        const isHighlighted =
          hovered === edge.source || hovered === edge.target;
        const midX = (source.x + target.x) / 2;
        const dist = Math.abs(target.x - source.x);
        const arcHeight = Math.min(dist * 0.45, 140);

        return (
          <path
            key={i}
            d={`M ${source.x} ${source.y} Q ${midX} ${nodeY - arcHeight} ${target.x} ${target.y}`}
            fill="none"
            stroke={isHighlighted ? '#94a3b8' : '#334155'}
            strokeWidth={isHighlighted ? 2 : 1}
            opacity={hovered && !isHighlighted ? 0.1 : 0.7}
          />
        );
      })}

      {data.nodes.map((node: any) => {
        const pos = nodePositions[node.id];
        const isHovered = hovered === node.id;
        const isConnected = data.edges.some(
          (e: any) =>
            (e.source === hovered && e.target === node.id) ||
            (e.target === hovered && e.source === node.id),
        );

        return (
          <g key={node.id}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={isHovered ? 10 : 8}
              fill={getTypeColor(node.type)}
              stroke={isHovered ? '#fff' : '#1e293b'}
              strokeWidth={isHovered ? 2 : 1}
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
            />
            <text
              x={pos.x}
              y={pos.y + 20}
              textAnchor="middle"
              className="text-xs fill-slate-400 pointer-events-none"
              transform={`rotate(45, ${pos.x}, ${pos.y + 20})`}
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============ ADJACENCY MATRIX ============
function AdjacencyMatrix({ data }: any) {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(
    null,
  );
  const size = 32;
  const margin = 100;

  const matrix: Record<string, Record<string, any>> = {};
  data.edges.forEach((edge: any) => {
    if (!matrix[edge.source]) matrix[edge.source] = {};
    matrix[edge.source][edge.target] = edge.predicate;
  });

  const width = margin + data.nodes.length * size;
  const height = margin + data.nodes.length * size;

  return (
    <div className="overflow-auto">
      <svg width={width} height={height}>
        {data.nodes.map((node: any, i: number) => (
          <text
            key={`col-${node.id}`}
            x={margin + i * size + size / 2}
            y={margin - 10}
            textAnchor="end"
            className="text-xs fill-slate-400"
            transform={`rotate(-45, ${margin + i * size + size / 2}, ${margin - 10})`}
          >
            {node.label}
          </text>
        ))}

        {data.nodes.map((node: any, i: number) => (
          <text
            key={`row-${node.id}`}
            x={margin - 8}
            y={margin + i * size + size / 2 + 4}
            textAnchor="end"
            className="text-xs fill-slate-400"
          >
            {node.label}
          </text>
        ))}

        {data.nodes.map((rowNode: any, row: number) =>
          data.nodes.map((colNode: any, col: number) => {
            const hasEdge = matrix[rowNode.id]?.[colNode.id];
            const isHovered = hovered?.row === row || hovered?.col === col;
            const isCellHovered = hovered?.row === row && hovered?.col === col;

            return (
              <rect
                key={`${row}-${col}`}
                x={margin + col * size}
                y={margin + row * size}
                width={size - 2}
                height={size - 2}
                fill={hasEdge ? getTypeColor(rowNode.type) : '#1e293b'}
                opacity={
                  hasEdge ? (isCellHovered ? 1 : 0.7) : isHovered ? 0.25 : 0.12
                }
                stroke={isCellHovered ? '#fff' : 'transparent'}
                strokeWidth={2}
                rx="3"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered({ row, col })}
                onMouseLeave={() => setHovered(null)}
              />
            );
          }),
        )}
      </svg>
      {hovered && (
        <div className="text-center mt-2 text-slate-400 text-sm">
          {data.nodes[hovered.row]?.label} → {data.nodes[hovered.col]?.label}
          {matrix[data.nodes[hovered.row]?.id]?.[
            data.nodes[hovered.col]?.id
          ] && (
            <span className="text-teal-400 ml-2">
              ({matrix[data.nodes[hovered.row].id][data.nodes[hovered.col].id]})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============ EDGE BUNDLING ============
function EdgeBundling({ data }: any) {
  const [hovered, setHovered] = useState<string | null>(null);
  const width = 480;
  const height = 480;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 190;

  const sortedNodes = [...data.nodes].sort((a, b) =>
    a.type.localeCompare(b.type),
  );

  const nodePositions: Record<string, any> = {};
  sortedNodes.forEach((node, i) => {
    const angle = (i / sortedNodes.length) * 2 * Math.PI - Math.PI / 2;
    nodePositions[node.id] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
    };
  });

  function bundledPath(source: any, target: any) {
    const s = nodePositions[source];
    const t = nodePositions[target];
    if (!s || !t) return '';
    const tension = 0.75;
    const ctrl1x = s.x * (1 - tension) + cx * tension;
    const ctrl1y = s.y * (1 - tension) + cy * tension;
    const ctrl2x = t.x * (1 - tension) + cx * tension;
    const ctrl2y = t.y * (1 - tension) + cy * tension;
    return `M ${s.x} ${s.y} C ${ctrl1x} ${ctrl1y}, ${ctrl2x} ${ctrl2y}, ${t.x} ${t.y}`;
  }

  return (
    <svg width={width} height={height}>
      {data.edges.map((edge: any, i: number) => {
        const isHighlighted =
          hovered === edge.source || hovered === edge.target;
        const sourceNode = data.nodes.find((n: any) => n.id === edge.source);
        return (
          <path
            key={i}
            d={bundledPath(edge.source, edge.target)}
            fill="none"
            stroke={isHighlighted ? getTypeColor(sourceNode?.type) : '#334155'}
            strokeWidth={isHighlighted ? 2.5 : 1}
            opacity={hovered && !isHighlighted ? 0.05 : 0.5}
          />
        );
      })}

      {sortedNodes.map((node) => {
        const pos = nodePositions[node.id];
        const isHovered = hovered === node.id;
        const isConnected = data.edges.some(
          (e: any) =>
            (e.source === hovered && e.target === node.id) ||
            (e.target === hovered && e.source === node.id),
        );

        const labelRadius = radius + 16;
        const labelX = cx + labelRadius * Math.cos(pos.angle);
        const labelY = cy + labelRadius * Math.sin(pos.angle);
        const rotation =
          (pos.angle * 180) / Math.PI +
          (pos.angle > Math.PI / 2 && pos.angle < (3 * Math.PI) / 2 ? 180 : 0);
        const textAnchor =
          pos.angle > Math.PI / 2 && pos.angle < (3 * Math.PI) / 2
            ? 'end'
            : 'start';

        return (
          <g key={node.id}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={isHovered ? 8 : 6}
              fill={getTypeColor(node.type)}
              stroke={isHovered ? '#fff' : '#1e293b'}
              strokeWidth={isHovered ? 2 : 1}
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="text-xs fill-slate-400 pointer-events-none"
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
              transform={`rotate(${rotation}, ${labelX}, ${labelY})`}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============ SORT ICON COMPONENT ============
function SortIcon({ column, sortConfig }: { column: any; sortConfig: any }) {
  if (sortConfig.key !== column)
    return <span className="text-slate-600 ml-1">↕</span>;
  return (
    <span className="text-indigo-400 ml-1">
      {sortConfig.direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

// ============ TABLE VIEW ============
function TableView({ data }: any) {
  const [activeTable, setActiveTable] = useState('nodes');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [filter, setFilter] = useState('');
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  // Get all unique property keys across nodes
  const allPropertyKeys = [
    ...new Set(data.nodes.flatMap((n: any) => Object.keys(n.properties))),
  ];

  const handleSort = (key: any) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedNodes = [...data.nodes].sort((a, b) => {
    if (!sortConfig.key) return 0;
    let aVal, bVal;

    if (
      sortConfig.key === 'label' ||
      sortConfig.key === 'type' ||
      sortConfig.key === 'id'
    ) {
      aVal = a[sortConfig.key];
      bVal = b[sortConfig.key];
    } else {
      aVal = a.properties[sortConfig.key] || '';
      bVal = b.properties[sortConfig.key] || '';
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredNodes = sortedNodes.filter((node) => {
    if (!filter) return true;
    const searchStr = filter.toLowerCase();
    return (
      node.label.toLowerCase().includes(searchStr) ||
      node.type.toLowerCase().includes(searchStr) ||
      node.id.toLowerCase().includes(searchStr) ||
      Object.values(node.properties).some((v) =>
        String(v).toLowerCase().includes(searchStr),
      )
    );
  });

  const filteredEdges = data.edges.filter((edge: any) => {
    if (!filter) return true;
    const searchStr = filter.toLowerCase();
    return (
      edge.source.toLowerCase().includes(searchStr) ||
      edge.target.toLowerCase().includes(searchStr) ||
      edge.predicate.toLowerCase().includes(searchStr)
    );
  });

  return (
    <div className="w-full max-w-full">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTable('nodes')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTable === 'nodes'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Nodes ({data.nodes.length})
          </button>
          <button
            onClick={() => setActiveTable('edges')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTable === 'edges'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Edges ({data.edges.length})
          </button>
        </div>

        <input
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={(e: any) => setFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
        />

        {filter && (
          <button
            onClick={() => setFilter('')}
            className="text-slate-500 hover:text-slate-300 text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tables */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        {activeTable === 'nodes' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-left">
                <th
                  className="px-4 py-3 text-slate-300 font-medium cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('label')}
                >
                  Label <SortIcon column="label" sortConfig={sortConfig} />
                </th>
                <th
                  className="px-4 py-3 text-slate-300 font-medium cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('type')}
                >
                  Type <SortIcon column="type" sortConfig={sortConfig} />
                </th>
                <th
                  className="px-4 py-3 text-slate-300 font-medium cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('id')}
                >
                  ID <SortIcon column="id" sortConfig={sortConfig} />
                </th>
                {allPropertyKeys.slice(0, 3).map((key: any) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-slate-300 font-medium cursor-pointer hover:bg-slate-700"
                    onClick={() => handleSort(key)}
                  >
                    {key} <SortIcon column={key} sortConfig={sortConfig} />
                  </th>
                ))}
                <th className="px-4 py-3 text-slate-300 font-medium">
                  Connections
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredNodes.map((node, i) => {
                const outCount = data.edges.filter(
                  (e: any) => e.source === node.id,
                ).length;
                const inCount = data.edges.filter(
                  (e: any) => e.target === node.id,
                ).length;
                const isSelected = selectedRow === node.id;

                return (
                  <tr
                    key={node.id}
                    className={`border-t border-slate-700/50 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-900/30'
                        : i % 2 === 0
                          ? 'bg-slate-800/30'
                          : 'bg-slate-800/10'
                    } hover:bg-slate-700/50`}
                    onClick={() => setSelectedRow(isSelected ? null : node.id)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getTypeColor(node.type) }}
                        />
                        <span className="text-slate-200">{node.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: getTypeColor(node.type) + '25',
                          color: getTypeColor(node.type),
                        }}
                      >
                        {node.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs max-w-[200px] truncate">
                      {node.id}
                    </td>
                    {allPropertyKeys.slice(0, 3).map((key: any) => (
                      <td key={key} className="px-4 py-2.5 text-slate-400">
                        {node.properties[key] || '—'}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2 text-xs">
                        {outCount > 0 && (
                          <span className="text-teal-400">{outCount} out</span>
                        )}
                        {inCount > 0 && (
                          <span className="text-amber-400">{inCount} in</span>
                        )}
                        {outCount === 0 && inCount === 0 && (
                          <span className="text-slate-600">isolated</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredNodes.length === 0 && (
                <tr>
                  <td
                    colSpan={4 + allPropertyKeys.slice(0, 3).length}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No nodes match filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-left">
                <th className="px-4 py-3 text-slate-300 font-medium">Source</th>
                <th className="px-4 py-3 text-slate-300 font-medium">
                  Predicate
                </th>
                <th className="px-4 py-3 text-slate-300 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {filteredEdges.map((edge: any, i: number) => {
                const sourceNode = data.nodes.find(
                  (n: any) => n.id === edge.source,
                );
                const targetNode = data.nodes.find(
                  (n: any) => n.id === edge.target,
                );

                return (
                  <tr
                    key={i}
                    className={`border-t border-slate-700/50 ${
                      i % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'
                    } hover:bg-slate-700/50`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: getTypeColor(sourceNode?.type),
                          }}
                        />
                        <span className="text-slate-200">
                          {sourceNode?.label || edge.source}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-teal-400 font-mono text-xs">
                        {edge.predicate}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: getTypeColor(targetNode?.type),
                          }}
                        />
                        <span className="text-slate-200">
                          {targetNode?.label || edge.target}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEdges.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No edges match filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected node details */}
      {selectedRow && activeTable === 'nodes' && (
        <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          {(() => {
            const node = data.nodes.find((n: any) => n.id === selectedRow);
            if (!node) return null;

            const outgoing = data.edges.filter(
              (e: any) => e.source === node.id,
            );
            const incoming = data.edges.filter(
              (e: any) => e.target === node.id,
            );

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-slate-500 text-xs mb-1">Full ID</div>
                  <div className="text-slate-300 font-mono text-xs break-all">
                    {node.id}
                  </div>
                </div>

                {Object.keys(node.properties).length > 0 && (
                  <div>
                    <div className="text-slate-500 text-xs mb-1">
                      Properties
                    </div>
                    {Object.entries(node.properties).map(([k, v]) => (
                      <div key={k} className="text-sm">
                        <span className="text-slate-500">{k}:</span>{' '}
                        <span className="text-slate-300">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div className="text-slate-500 text-xs mb-1">
                    Relationships
                  </div>
                  {outgoing.map((e: any, i: number) => (
                    <div key={`out-${i}`} className="text-xs text-slate-400">
                      —<span className="text-teal-400 mx-1">{e.predicate}</span>
                      →{' '}
                      {data.nodes.find((n: any) => n.id === e.target)?.label ||
                        e.target}
                    </div>
                  ))}
                  {incoming.map((e: any, i: number) => (
                    <div key={`in-${i}`} className="text-xs text-slate-400">
                      ←<span className="text-teal-400 mx-1">{e.predicate}</span>
                      —{' '}
                      {data.nodes.find((n: any) => n.id === e.source)?.label ||
                        e.source}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ============ ERD DIAGRAM ============
function ERDiagram({ data }: any) {
  const [hovered, setHovered] = useState<string | null>(null);
  const width: number = 900;
  const height: number = 600;

  const entityTypes: string[] = [
    ...new Set(data.nodes.map((n: any) => n.type)),
  ];
  const entitiesByType: Record<string, any[]> = {};

  entityTypes.forEach((type: string) => {
    entitiesByType[type] = data.nodes.filter((n: any) => n.type === type);
  });

  const columns: number = Math.min(entityTypes.length, 3);
  const rows: number = Math.ceil(entityTypes.length / columns);
  const padding: number = 100;
  const colWidth: number = (width - padding * 2) / columns;
  const rowHeight: number = (height - padding * 2) / rows;

  const entityPositions: Record<
    string,
    { x: number; y: number; width: number; height: number }
  > = {};

  entityTypes.forEach((type: string, idx: number) => {
    const col: number = idx % columns;
    const row: number = Math.floor(idx / columns);
    const x: number = padding + colWidth * (col + 0.5);
    const y: number = padding + rowHeight * (row + 0.5);

    const entities: any[] = entitiesByType[type];
    const boxHeight: number = Math.max(120, 50 + entities.length * 22);

    entities.forEach((entity: any, entityIdx: number) => {
      entityPositions[entity.id] = {
        x: x - 90,
        y: y - boxHeight / 2 + 50 + entityIdx * 22,
        width: 180,
        height: boxHeight,
      };
    });
  });

  const getConnectionPoint = (entityId: string, isSource: boolean) => {
    const pos = entityPositions[entityId];
    if (!pos) return { x: 0, y: 0 };
    return {
      x: isSource ? pos.x + pos.width : pos.x,
      y: pos.y,
    };
  };

  return (
    <svg width={width} height={height} className="bg-slate-900">
      <defs>
        <marker
          id="erd-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
        >
          <polygon points="0 0, 8 4, 0 8" fill="#64748b" />
        </marker>
      </defs>

      {data.edges.map((edge: any, i: number) => {
        const source = getConnectionPoint(edge.source, true);
        const target = getConnectionPoint(edge.target, false);
        const isHighlighted =
          hovered === edge.source || hovered === edge.target;

        const midX = (source.x + target.x) / 2;
        const controlX1 = source.x + (midX - source.x) * 0.5;
        const controlX2 = target.x - (target.x - midX) * 0.5;

        return (
          <g key={i}>
            <path
              d={`M ${source.x} ${source.y} C ${controlX1} ${source.y}, ${controlX2} ${target.y}, ${target.x} ${target.y}`}
              fill="none"
              stroke={isHighlighted ? '#94a3b8' : '#475569'}
              strokeWidth={isHighlighted ? 2 : 1.5}
              opacity={hovered && !isHighlighted ? 0.2 : 0.6}
              markerEnd="url(#erd-arrow)"
            />
            <text
              x={midX}
              y={(source.y + target.y) / 2 - 5}
              className="text-xs fill-slate-500 pointer-events-none"
              textAnchor="middle"
              opacity={isHighlighted ? 1 : 0.5}
            >
              {edge.predicate}
            </text>
          </g>
        );
      })}

      {entityTypes.map((type, idx) => {
        const col = idx % columns;
        const row = Math.floor(idx / columns);
        const x = padding + colWidth * (col + 0.5);
        const y = padding + rowHeight * (row + 0.5);
        const entities = entitiesByType[type];
        const boxHeight = Math.max(120, 50 + entities.length * 22);
        const boxWidth = 180;

        return (
          <g key={type}>
            <rect
              x={x - boxWidth / 2}
              y={y - boxHeight / 2}
              width={boxWidth}
              height={boxHeight}
              fill="#1e293b"
              stroke={getTypeColor(type)}
              strokeWidth={2}
              rx={4}
            />

            <rect
              x={x - boxWidth / 2}
              y={y - boxHeight / 2}
              width={boxWidth}
              height={30}
              fill={getTypeColor(type)}
              rx={4}
            />
            <rect
              x={x - boxWidth / 2}
              y={y - boxHeight / 2 + 26}
              width={boxWidth}
              height={4}
              fill={getTypeColor(type)}
            />

            <text
              x={x}
              y={y - boxHeight / 2 + 20}
              className="text-sm font-semibold fill-slate-900"
              textAnchor="middle"
            >
              {type}
            </text>

            {entities.map((entity, entityIdx) => {
              const isHovered = hovered === entity.id;
              const isConnected = data.edges.some(
                (e: any) =>
                  (e.source === hovered && e.target === entity.id) ||
                  (e.target === hovered && e.source === entity.id),
              );

              return (
                <g key={entity.id}>
                  <text
                    x={x - boxWidth / 2 + 12}
                    y={y - boxHeight / 2 + 62 + entityIdx * 22}
                    className="text-xs fill-slate-300 cursor-pointer"
                    opacity={hovered && !isHovered && !isConnected ? 0.3 : 1}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    onMouseEnter={() => setHovered(entity.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {entity.label}
                  </text>

                  {Object.keys(entity.properties).length > 0 && (
                    <title>
                      {Object.entries(entity.properties)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n')}
                    </title>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ============ CALENDAR VIEW ============
function CalendarView({ data }: any) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const getDateFromNode = (node: any): Date | null => {
    const dateProps = [
      'dueDate',
      'startDate',
      'endDate',
      'createdAt',
      'completedAt',
    ];
    for (const prop of dateProps) {
      if (node.properties[prop]) {
        const date = new Date(node.properties[prop]);
        if (!isNaN(date.getTime())) return date;
      }
    }
    return null;
  };

  const nodesWithDates = data.nodes
    .map((node: any) => ({ ...node, date: getDateFromNode(node) }))
    .filter((node: any) => node.date !== null);

  const dateGroups: Record<string, any[]> = {};
  nodesWithDates.forEach((node: any) => {
    const dateKey = node.date.toISOString().split('T')[0];
    if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
    dateGroups[dateKey].push(node);
  });

  const sortedDates = Object.keys(dateGroups).sort();
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto p-4">
        {sortedDates.length === 0 ? (
          <div className="text-slate-500 text-center py-8">
            No nodes with date properties found
          </div>
        ) : (
          sortedDates.map((dateKey) => {
            const isToday = dateKey === today;
            const isPast = dateKey < today;
            return (
              <div
                key={dateKey}
                className={`border rounded-lg p-3 ${
                  isToday
                    ? 'border-indigo-500 bg-indigo-900/20'
                    : isPast
                      ? 'border-slate-700 bg-slate-800/50'
                      : 'border-slate-600 bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-semibold text-slate-300">
                    {new Date(dateKey).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  {isToday && (
                    <span className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded">
                      Today
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {dateGroups[dateKey].length} item
                    {dateGroups[dateKey].length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {dateGroups[dateKey].map((node: any) => (
                    <div
                      key={node.id}
                      className="flex items-start gap-2 p-2 bg-slate-900/50 rounded border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: getTypeColor(node.type) }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate">
                          {node.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {node.type}
                        </div>
                        {Object.entries(node.properties).length > 0 && (
                          <div className="text-xs text-slate-600 mt-1">
                            {Object.entries(node.properties)
                              .filter(
                                ([k]) =>
                                  !k.includes('Date') && !k.includes('At'),
                              )
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' • ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============ GANTT CHART ============
function GanttChart({ data }: any) {
  const getDateRange = (node: any): { start: Date; end: Date } | null => {
    const start = node.properties.startDate || node.properties.createdAt;
    const end =
      node.properties.endDate ||
      node.properties.dueDate ||
      node.properties.completedAt;

    if (!start) return null;

    const startDate = new Date(start);
    const endDate = end
      ? new Date(end)
      : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime())) return null;

    return { start: startDate, end: endDate };
  };

  const nodesWithRanges = data.nodes
    .map((node: any) => ({ ...node, range: getDateRange(node) }))
    .filter((node: any) => node.range !== null)
    .sort(
      (a: any, b: any) => a.range.start.getTime() - b.range.start.getTime(),
    );

  if (nodesWithRanges.length === 0) {
    return (
      <div className="text-slate-500 text-center py-8">
        No nodes with date ranges found (needs startDate/endDate or
        createdAt/dueDate)
      </div>
    );
  }

  const allDates = nodesWithRanges.flatMap((n: any) => [
    n.range.start,
    n.range.end,
  ]);
  const minDate = new Date(Math.min(...allDates.map((d: Date) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d: Date) => d.getTime())));
  const totalDays =
    Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) +
    1;

  const getPosition = (date: Date) => {
    const days = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    return (days / totalDays) * 100;
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span>{minDate.toLocaleDateString()}</span>
        <span>{maxDate.toLocaleDateString()}</span>
      </div>
      <div className="space-y-2 max-h-[450px] overflow-y-auto">
        {nodesWithRanges.map((node: any, idx: number) => {
          const startPos = getPosition(node.range.start);
          const endPos = getPosition(node.range.end);
          const width = endPos - startPos;

          return (
            <div key={node.id} className="relative">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-32 text-xs text-slate-300 truncate">
                  {node.label}
                </div>
                <div className="text-xs text-slate-500">{node.type}</div>
              </div>
              <div className="relative h-8 bg-slate-800 rounded">
                <div
                  className="absolute h-full rounded transition-all hover:opacity-80"
                  style={{
                    left: `${startPos}%`,
                    width: `${width}%`,
                    backgroundColor: getTypeColor(node.type),
                  }}
                >
                  <div className="px-2 py-1 text-xs text-white truncate">
                    {node.range.start.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' → '}
                    {node.range.end.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ KANBAN BOARD ============
function KanbanBoard({ data }: any) {
  const getStatus = (node: any): string => {
    if (node.properties.status) {
      const status = node.properties.status;
      if (typeof status === 'string') {
        return status.split('/').pop() || status;
      }
    }

    const statusEdge = data.edges.find(
      (e: any) => e.source === node.id && e.predicate === 'status',
    );
    if (statusEdge) {
      const statusNode = data.nodes.find(
        (n: any) => n.id === statusEdge.target,
      );
      if (statusNode) return statusNode.label;
    }

    if (node.properties.completedAt) return 'Done';
    if (
      node.properties.startDate &&
      new Date(node.properties.startDate) <= new Date()
    )
      return 'In Progress';
    return 'Todo';
  };

  const nodesWithStatus = data.nodes.map((node: any) => ({
    ...node,
    status: getStatus(node),
  }));

  const statusGroups: Record<string, any[]> = {};
  nodesWithStatus.forEach((node: any) => {
    if (!statusGroups[node.status]) statusGroups[node.status] = [];
    statusGroups[node.status].push(node);
  });

  const statusOrder = ['Todo', 'In Progress', 'Blocked', 'Done'];
  const orderedStatuses = statusOrder.filter((s) => statusGroups[s]);
  const otherStatuses = Object.keys(statusGroups).filter(
    (s) => !statusOrder.includes(s),
  );
  const allStatuses = [...orderedStatuses, ...otherStatuses];

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {allStatuses.map((status) => (
          <div key={status} className="flex flex-col">
            <div className="mb-3 pb-2 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-slate-200">{status}</h3>
              <div className="text-xs text-slate-500">
                {statusGroups[status].length} items
              </div>
            </div>
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {statusGroups[status].map((node: any) => (
                <div
                  key={node.id}
                  className="p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: getTypeColor(node.type) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200">
                        {node.label}
                      </div>
                      <div className="text-xs text-slate-500">{node.type}</div>
                    </div>
                  </div>
                  {Object.entries(node.properties).length > 0 && (
                    <div className="text-xs text-slate-600 space-y-1">
                      {Object.entries(node.properties)
                        .filter(
                          ([k]) =>
                            !['status', 'name', 'description'].includes(k),
                        )
                        .slice(0, 3)
                        .map(([k, v]) => (
                          <div key={k} className="truncate">
                            <span className="text-slate-500">{k}:</span>{' '}
                            {String(v)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ CHORD DIAGRAM ============
function ChordDiagram({ data }: any) {
  const [hovered, setHovered] = useState<string | null>(null);
  const width = 450;
  const height = 450;
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = 190;
  const innerRadius = 170;

  const nodeAngle = (2 * Math.PI) / data.nodes.length;
  const nodePositions: Record<string, any> = {};

  data.nodes.forEach((node: any, i: number) => {
    const startAngle = i * nodeAngle - Math.PI / 2;
    const endAngle = startAngle + nodeAngle * 0.85;
    const midAngle = (startAngle + endAngle) / 2;
    nodePositions[node.id] = {
      startAngle,
      endAngle,
      midAngle,
      x: cx + innerRadius * Math.cos(midAngle),
      y: cy + innerRadius * Math.sin(midAngle),
    };
  });

  function describeArc(startAngle: any, endAngle: any, radius: any) {
    const start = {
      x: cx + radius * Math.cos(startAngle),
      y: cy + radius * Math.sin(startAngle),
    };
    const end = {
      x: cx + radius * Math.cos(endAngle),
      y: cy + radius * Math.sin(endAngle),
    };
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  return (
    <svg width={width} height={height}>
      {data.edges.map((edge: any, i: number) => {
        const source = nodePositions[edge.source];
        const target = nodePositions[edge.target];
        if (!source || !target) return null;
        const isHighlighted =
          hovered === edge.source || hovered === edge.target;

        return (
          <path
            key={i}
            d={`M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`}
            fill="none"
            stroke={isHighlighted ? '#94a3b8' : '#334155'}
            strokeWidth={isHighlighted ? 2.5 : 1.5}
            opacity={hovered && !isHighlighted ? 0.08 : 0.5}
          />
        );
      })}

      {data.nodes.map((node: any) => {
        const pos = nodePositions[node.id];
        const isHovered = hovered === node.id;
        const isConnected = data.edges.some(
          (e: any) =>
            (e.source === hovered && e.target === node.id) ||
            (e.target === hovered && e.source === node.id),
        );

        const labelX = cx + (outerRadius + 18) * Math.cos(pos.midAngle);
        const labelY = cy + (outerRadius + 18) * Math.sin(pos.midAngle);
        const textAnchor =
          pos.midAngle > Math.PI / 2 && pos.midAngle < (3 * Math.PI) / 2
            ? 'end'
            : 'start';

        return (
          <g key={node.id}>
            <path
              d={describeArc(pos.startAngle, pos.endAngle, outerRadius)}
              fill="none"
              stroke={getTypeColor(node.type)}
              strokeWidth={isHovered ? 14 : 10}
              strokeLinecap="round"
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="text-xs fill-slate-400 pointer-events-none"
              opacity={hovered && !isHovered && !isConnected ? 0.25 : 1}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============ NODE DETAILS PANEL ============
function NodeDetails({ node, edges }: any) {
  if (!node) return null;

  const outgoing = edges.filter((e: any) => e.source === node.id);
  const incoming = edges.filter((e: any) => e.target === node.id);

  return (
    <div className="bg-slate-800 rounded-lg p-4 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: getTypeColor(node.type) }}
        />
        <span className="text-slate-200 font-medium">{node.label}</span>
        <span className="text-slate-500 text-xs">({node.type})</span>
      </div>

      <div className="text-slate-500 text-xs mb-2 font-mono break-all">
        {node.id}
      </div>

      {Object.keys(node.properties).length > 0 && (
        <div className="mb-3">
          {Object.entries(node.properties).map(([key, value]) => (
            <div key={key} className="text-slate-400">
              <span className="text-slate-500">{key}:</span> {String(value)}
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mb-2">
          <div className="text-slate-500 text-xs mb-1">Outgoing:</div>
          {outgoing.map((e: any, i: number) => (
            <div key={i} className="text-slate-400 text-xs">
              —<span className="text-teal-400">{e.predicate}</span>→ {e.target}
            </div>
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <div>
          <div className="text-slate-500 text-xs mb-1">Incoming:</div>
          {incoming.map((e: any, i: number) => (
            <div key={i} className="text-slate-400 text-xs">
              ←<span className="text-teal-400">{e.predicate}</span>— {e.source}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ MAIN APP ============
// Read-only projections: cannot edit data, only view
const readOnlyProjections = [
  { id: 'force', name: 'Force-Directed', icon: Atom, category: 'Graph' },
  { id: 'radial', name: 'Radial', icon: Circle, category: 'Graph' },
  { id: 'arc', name: 'Arc Diagram', icon: Minus, category: 'Graph' },
  { id: 'chord', name: 'Chord', icon: Disc, category: 'Graph' },
  { id: 'bundle', name: 'Edge Bundling', icon: Sparkles, category: 'Graph' },
  { id: 'matrix', name: 'Matrix', icon: Grid3x3, category: 'Graph' },
  { id: 'sankey', name: 'Sankey', icon: Waves, category: 'Graph' },
  { id: 'erd', name: 'ERD Schema', icon: Database, category: 'Schema' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, category: 'Time' },
  { id: 'gantt', name: 'Gantt', icon: GanttChartIcon, category: 'Time' },
  { id: 'table', name: 'Table', icon: LayoutGrid, category: 'Data' },
  { id: 'cards', name: 'Cards', icon: CreditCard, category: 'Data' },
];

// Read/write projections: allow data editing and manipulation
const readWriteProjections = [
  { id: 'kanban', name: 'Kanban', icon: Trello, category: 'Workflow' },
  { id: 'form', name: 'Form', icon: FileEdit, category: 'Edit' },
];

const visualizations = [...readOnlyProjections, ...readWriteProjections];

export default function JsonLdVisualizer() {
  const [selectedDataset, setSelectedDataset] = useState(defaultDataset.id);
  const currentDataset = sampleDatasets.find((d) => d.id === selectedDataset);
  const [jsonInput, setJsonInput] = useState(
    JSON.stringify(defaultDataset.data, null, 2),
  );
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: [],
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSource, setShowSource] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Filter states
  // Get available visualizations including bespoke projection if available
  const availableVisualizations = React.useMemo(() => {
    const tabs = [...visualizations];
    if (currentDataset?.bespokeProjection) {
      tabs.unshift({
        id: 'dashboard',
        name: 'Dashboard',
        icon: Sparkle,
        category: 'Bespoke',
      });
    }
    return tabs;
  }, [currentDataset]);

  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [rightSidebarTab, setRightSidebarTab] = useState<
    'json' | 'details' | 'stats'
  >('json');
  const [filters, setFilters] = useState({
    types: [] as string[],
    namespaces: [] as string[],
    search: '',
    showIsolated: true,
    minConnections: 0,
  });
  const [filteredData, setFilteredData] = useState<{
    nodes: any[];
    edges: any[];
  }>({ nodes: [], edges: [] });

  useEffect(() => {
    try {
      // Strip comments before parsing
      const cleanedInput = stripJsonComments(jsonInput);
      const doc = JSON.parse(cleanedInput);
      const data = parseJsonLd(doc);
      // Use setTimeout to avoid calling setState synchronously within effect
      setTimeout(() => {
        setGraphData(data);
        setParseError(null);
      }, 0);
      // Reset type colors for fresh parse
      Object.keys(typeColorMap).forEach((k) => delete typeColorMap[k]);
    } catch (e) {
      // Use setTimeout to avoid calling setState synchronously within effect
      setTimeout(
        () => setParseError(e instanceof Error ? e.message : String(e)),
        0,
      );
    }
  }, [jsonInput]);

  // Apply filters whenever graph data or filters change
  useEffect(() => {
    if (!graphData.nodes.length) {
      // Use setTimeout to avoid calling setState synchronously within effect
      setTimeout(() => setFilteredData({ nodes: [], edges: [] }), 0);
      return;
    }

    let filteredNodes = [...graphData.nodes];
    let filteredEdges = [...graphData.edges];

    // Filter by types
    if (filters.types.length > 0) {
      filteredNodes = filteredNodes.filter((node) =>
        filters.types.includes(node.type),
      );
    }

    // Filter by namespaces (extracted from IDs)
    if (filters.namespaces.length > 0) {
      filteredNodes = filteredNodes.filter((node) => {
        const namespace =
          node.id.split(':')[0] || node.id.split('/')[0] || 'default';
        return filters.namespaces.includes(namespace);
      });
    }

    // Filter by search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredNodes = filteredNodes.filter(
        (node) =>
          node.label.toLowerCase().includes(searchLower) ||
          node.id.toLowerCase().includes(searchLower) ||
          Object.values(node.properties).some((v) =>
            String(v).toLowerCase().includes(searchLower),
          ),
      );
    }

    // Filter isolated nodes
    if (!filters.showIsolated) {
      const connectedNodeIds = new Set();
      filteredEdges.forEach((edge) => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });
      filteredNodes = filteredNodes.filter((node) =>
        connectedNodeIds.has(node.id),
      );
    }

    // Filter by minimum connections
    if (filters.minConnections > 0) {
      const connectionCounts: Record<string, number> = {};
      filteredEdges.forEach((edge) => {
        connectionCounts[edge.source] =
          (connectionCounts[edge.source] || 0) + 1;
        connectionCounts[edge.target] =
          (connectionCounts[edge.target] || 0) + 1;
      });
      filteredNodes = filteredNodes.filter(
        (node) => (connectionCounts[node.id] || 0) >= filters.minConnections,
      );
    }

    // Filter edges to only include those between filtered nodes
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredEdges = filteredEdges.filter(
      (edge) =>
        filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target),
    );

    // Use setTimeout to avoid calling setState synchronously within effect
    setTimeout(
      () => setFilteredData({ nodes: filteredNodes, edges: filteredEdges }),
      0,
    );
  }, [graphData, filters]);

  const renderVisualization = () => {
    // Bespoke projection doesn't need filtered data check
    if (activeTab === 'dashboard' && currentDataset?.bespokeProjection) {
      const BespokeComponent = currentDataset.bespokeProjection;
      return <BespokeComponent data={graphData} />;
    }

    if (filteredData.nodes.length === 0) {
      return (
        <div className="text-slate-500">No nodes match current filters</div>
      );
    }

    switch (activeTab) {
      case 'force':
        return <ForceDirectedGraph data={filteredData} />;
      case 'radial':
        return <RadialGraph data={filteredData} />;
      case 'arc':
        return <ArcDiagram data={filteredData} />;
      case 'chord':
        return <ChordDiagram data={filteredData} />;
      case 'bundle':
        return <EdgeBundling data={filteredData} />;
      case 'matrix':
        return <AdjacencyMatrix data={filteredData} />;
      case 'sankey':
        return <SankeyDiagram data={filteredData} />;
      case 'erd':
        return <ERDiagram data={filteredData} />;
      case 'calendar':
        return <CalendarView data={filteredData} />;
      case 'gantt':
        return <GanttChart data={filteredData} />;
      case 'kanban':
        return <KanbanBoard data={filteredData} />;
      case 'table':
        return <TableView data={filteredData} />;
      case 'cards':
        return <CardGridView data={filteredData} />;
      case 'form':
        return <FormDetailView data={filteredData} />;
      default:
        return null;
    }
  };

  // Get unique types and namespaces for filter options
  const uniqueTypes = [...new Set(graphData.nodes.map((n) => n.type))];
  const uniqueNamespaces = [
    ...new Set(
      graphData.nodes.map(
        (n) => n.id.split(':')[0] || n.id.split('/')[0] || 'default',
      ),
    ),
  ];

  const FilterSidebar = () => (
    <div className="p-4 h-full">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-slate-200">Filters</h3>
      </div>

      {/* Type Filters */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Types</h4>
        <div className="space-y-2">
          {uniqueTypes.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.types.includes(type)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFilters((prev) => ({
                      ...prev,
                      types: [...prev.types, type],
                    }));
                  } else {
                    setFilters((prev) => ({
                      ...prev,
                      types: prev.types.filter((t) => t !== type),
                    }));
                  }
                }}
                className="rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
              />
              <span className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: typeColorMap[type] }}
                />
                <span className="text-slate-200">{type}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Namespace Filters */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Namespaces</h4>
        <div className="space-y-2">
          {uniqueNamespaces.map((ns) => (
            <label key={ns} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.namespaces.includes(ns)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFilters((prev) => ({
                      ...prev,
                      namespaces: [...prev.namespaces, ns],
                    }));
                  } else {
                    setFilters((prev) => ({
                      ...prev,
                      namespaces: prev.namespaces.filter((n) => n !== ns),
                    }));
                  }
                }}
                className="rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
              />
              <span className="text-slate-200">{ns}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Search</h4>
        <input
          type="text"
          placeholder="Search nodes..."
          value={filters.search}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Connection Filters */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Connections</h4>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={filters.showIsolated}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                showIsolated: e.target.checked,
              }))
            }
            className="rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
          />
          <span className="text-sm text-slate-200">Show isolated nodes</span>
        </label>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Minimum connections: {filters.minConnections}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={filters.minConnections}
            onChange={(e: any) =>
              setFilters((prev) => ({
                ...prev,
                minConnections: parseInt(e.target.value),
              }))
            }
            className="w-full"
          />
        </div>
      </div>

      {/* Filter Summary */}
      <div className="mt-6 p-3 bg-slate-700 rounded-lg">
        <div className="text-xs text-slate-400 mb-1">Filtered results:</div>
        <div className="text-sm text-slate-200">
          {filteredData.nodes.length} nodes, {filteredData.edges.length} edges
        </div>
        {filteredData.nodes.length < graphData.nodes.length && (
          <div className="text-xs text-slate-400 mt-1">
            {graphData.nodes.length - filteredData.nodes.length} nodes hidden
          </div>
        )}
      </div>
    </div>
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey) {
        setShowLeftSidebar((prev) => !prev);
      } else if (e.key === ']' && !e.metaKey && !e.ctrlKey) {
        setShowRightSidebar((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-light text-slate-200">
            JSON-LD Graph Visualizer
          </h1>
        </div>

        <select
          value={selectedDataset}
          onChange={(e) => {
            const dataset = sampleDatasets.find((d) => d.id === e.target.value);
            if (dataset) {
              setSelectedDataset(dataset.id);
              setJsonInput(JSON.stringify(dataset.data, null, 2));
            }
          }}
          className="px-3 py-1.5 rounded-md text-sm bg-slate-700 text-slate-200 border border-slate-600 hover:border-slate-500 focus:border-indigo-500 focus:outline-none"
        >
          {sampleDatasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </option>
          ))}
        </select>

        {/* Projection Tabs */}
        <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-hide">
          {availableVisualizations.map((viz) => {
            const IconComponent = viz.icon;
            return (
              <button
                key={viz.id}
                onClick={() => setActiveTab(viz.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === viz.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                {viz.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className={`p-2 rounded-md text-sm transition-colors ${
              showLeftSidebar
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
            title="Toggle Filters ([)"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className={`p-2 rounded-md text-sm transition-colors ${
              showRightSidebar
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
            title="Toggle Sidebar (])"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area with Sidebars */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Filters */}
        <div
          className={`bg-slate-800 border-r border-slate-700 transition-all duration-300 overflow-y-auto ${
            showLeftSidebar ? 'w-80' : 'w-0'
          }`}
        >
          {showLeftSidebar && <FilterSidebar />}
        </div>

        {/* Center - Visualization */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
          <div className="flex-1 w-full h-full flex items-center justify-center overflow-auto p-8">
            {renderVisualization()}
          </div>
        </div>

        {/* Right Sidebar - JSON/Details/Stats */}
        <div
          className={`bg-slate-800 border-l border-slate-700 transition-all duration-300 overflow-hidden flex flex-col ${
            showRightSidebar ? 'w-96' : 'w-0'
          }`}
        >
          {showRightSidebar && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-700 shrink-0">
                <button
                  onClick={() => setRightSidebarTab('json')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    rightSidebarTab === 'json'
                      ? 'bg-slate-700 text-slate-200 border-b-2 border-indigo-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                  }`}
                >
                  JSON-LD
                </button>
                <button
                  onClick={() => setRightSidebarTab('details')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    rightSidebarTab === 'details'
                      ? 'bg-slate-700 text-slate-200 border-b-2 border-indigo-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setRightSidebarTab('stats')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    rightSidebarTab === 'stats'
                      ? 'bg-slate-700 text-slate-200 border-b-2 border-indigo-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                  }`}
                >
                  Stats
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {rightSidebarTab === 'json' && (
                  <div className="p-4">
                    {parseError && (
                      <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">
                        {parseError}
                      </div>
                    )}
                    <textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      className="w-full h-[calc(100vh-200px)] bg-slate-700 text-slate-300 text-xs font-mono p-3 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
                      spellCheck={false}
                      placeholder="Paste your JSON-LD here..."
                    />
                  </div>
                )}

                {rightSidebarTab === 'details' && (
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-slate-200 mb-3">
                      Node Details
                    </h3>
                    {selectedNode ? (
                      <div className="text-sm text-slate-300">
                        <p>Selected: {selectedNode}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">
                        Click a node to view details
                      </p>
                    )}
                  </div>
                )}

                {rightSidebarTab === 'stats' && (
                  <div className="p-4 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200 mb-3">
                        Graph Statistics
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Nodes:</span>
                          <span className="text-slate-200 font-medium">
                            {graphData.nodes.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Edges:</span>
                          <span className="text-slate-200 font-medium">
                            {graphData.edges.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Visible Nodes:</span>
                          <span className="text-slate-200 font-medium">
                            {filteredData.nodes.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Visible Edges:</span>
                          <span className="text-slate-200 font-medium">
                            {filteredData.edges.length}
                          </span>
                        </div>
                        {filteredData.nodes.length < graphData.nodes.length && (
                          <div className="flex justify-between text-amber-400">
                            <span>Filtered:</span>
                            <span className="font-medium">
                              {graphData.nodes.length -
                                filteredData.nodes.length}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-200 mb-2">
                        Node Types
                      </h4>
                      <div className="space-y-1 text-xs">
                        {uniqueTypes.map((type) => {
                          const count = graphData.nodes.filter(
                            (n) => n.type === type,
                          ).length;
                          return (
                            <div
                              key={type}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor: typeColorMap[type],
                                  }}
                                />
                                <span className="text-slate-300">{type}</span>
                              </div>
                              <span className="text-slate-500">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="h-10 bg-slate-800 border-t border-slate-700 flex items-center px-4 text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          <span>
            {filteredData.nodes.length} nodes, {filteredData.edges.length} edges
          </span>
          <span className="text-slate-600">|</span>
          <span>
            {activeTab === 'force' &&
              'Drag nodes to reposition. Scroll to zoom.'}
            {activeTab === 'radial' &&
              'Nodes grouped by type in concentric rings.'}
            {activeTab === 'arc' && 'Linear layout with curved edges.'}
            {activeTab === 'chord' && 'Circular layout with ribbons.'}
            {activeTab === 'bundle' && 'Edges curve through center.'}
            {activeTab === 'matrix' && 'Grid cells show directed edges.'}
            {activeTab === 'sankey' && 'Flow diagram showing hierarchy.'}
            {activeTab === 'erd' && 'Entity-Relationship Diagram.'}
            {activeTab === 'calendar' && 'Timeline view grouped by date.'}
            {activeTab === 'gantt' && 'Task durations and timelines.'}
            {activeTab === 'kanban' && 'Organized by status.'}
            {activeTab === 'table' && 'Sortable, filterable tables.'}
            {activeTab === 'cards' && 'Grid of cards with search.'}
            {activeTab === 'form' && 'Detailed form view for editing.'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-slate-600">Keyboard:</span>
          <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-300">
            [
          </kbd>
          <span className="text-slate-500">Filters</span>
          <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-300">
            ]
          </kbd>
          <span className="text-slate-500">Sidebar</span>
        </div>
      </div>
    </div>
  );
}
