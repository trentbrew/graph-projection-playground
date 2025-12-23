'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import dagre from '@dagrejs/dagre';
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  reactive,
  ref,
  watch,
} from 'vue';
import {
  Handle,
  MarkerType,
  Panel,
  Position,
  useVueFlow,
  VueFlow,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';

type GraphNode = {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
};

type GraphEdge = {
  source: string;
  target: string;
  predicate: string;
};

export function VueFlowProjection({
  data,
}: {
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const vueAppRef = useRef<ReturnType<typeof createApp> | null>(null);
  const setGraphRef = useRef<
    ((nodes: unknown[], edges: unknown[]) => void) | null
  >(null);

  const mapped = useMemo(() => {
    const nodes = data.nodes;
    const edges = data.edges;

    const connectionCounts = new Map<string, number>();
    const outBySourcePredicate = new Map<string, number>();
    const inByTargetPredicate = new Map<string, number>();

    for (const e of edges) {
      connectionCounts.set(e.source, (connectionCounts.get(e.source) || 0) + 1);
      connectionCounts.set(e.target, (connectionCounts.get(e.target) || 0) + 1);

      const outKey = `${e.source}::${e.predicate}`;
      outBySourcePredicate.set(
        outKey,
        (outBySourcePredicate.get(outKey) || 0) + 1,
      );

      const inKey = `${e.target}::${e.predicate}`;
      inByTargetPredicate.set(inKey, (inByTargetPredicate.get(inKey) || 0) + 1);
    }

    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const spacingX = 220;
    const spacingY = 140;

    const vfNodes = nodes.map((n, idx) => {
      const x = (idx % cols) * spacingX;
      const y = Math.floor(idx / cols) * spacingY;

      const namespace = n.id.split(':')[0] || n.id.split('/')[0] || 'default';

      const propertyEntries = Object.entries(n.properties).filter(
        ([k]) => !['name', 'label', 'title'].includes(k),
      );

      return {
        id: n.id,
        type: 'card',
        position: { x, y },
        data: {
          label: n.label || n.id,
          type: n.type,
          namespace,
          id: n.id,
          properties: n.properties,
          propertyEntries,
          connections: connectionCounts.get(n.id) || 0,
        },
      };
    });

    const vfEdges = edges.map((e, idx) => {
      const outKey = `${e.source}::${e.predicate}`;
      const inKey = `${e.target}::${e.predicate}`;
      const outCount = outBySourcePredicate.get(outKey) || 0;
      const inCount = inByTargetPredicate.get(inKey) || 0;

      const sourceCardinality = outCount > 1 ? 'N' : '1';
      const targetCardinality = inCount > 1 ? 'N' : '1';
      const cardinality = `${sourceCardinality}→${targetCardinality}`;

      const isManyMany = sourceCardinality === 'N' && targetCardinality === 'N';
      const isOneMany =
        !isManyMany && (sourceCardinality === 'N' || targetCardinality === 'N');

      const stroke = isManyMany ? '#f97316' : isOneMany ? '#a78bfa' : '#94a3b8';
      const strokeDasharray = isManyMany
        ? '4 2'
        : isOneMany
          ? '6 4'
          : undefined;

      return {
        id: `${e.source}-${e.target}-${e.predicate}-${idx}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        label: `${e.predicate} (${cardinality})`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
          width: 16,
          height: 16,
          strokeWidth: 1.5,
        },
        style: {
          stroke,
          strokeWidth: 1.5,
          ...(strokeDasharray ? { strokeDasharray } : {}),
        },
        labelShowBg: true,
        labelBgStyle: {
          fill: '#0b1220',
          fillOpacity: 0.85,
          stroke: '#1f2a44',
          strokeWidth: 1,
        },
        labelStyle: {
          fill: '#e2e8f0',
          fontSize: '10px',
        },
      };
    });

    return { vfNodes, vfEdges };
  }, [data.edges, data.nodes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (vueAppRef.current) return;

    const state = reactive({
      nodes: [] as unknown[],
      edges: [] as unknown[],
      nonce: 0,
    });

    const Root = defineComponent({
      setup() {
        const id = 'embedded-vueflow';
        const { findNode, fitView, onInit, onNodesInitialized } = useVueFlow({
          id,
        });

        const graph = ref(new dagre.graphlib.Graph());
        const direction = ref<'LR' | 'TB'>('LR');
        const density = ref<'compact' | 'spacious'>('spacious');

        function getTypeColor(type: unknown): string {
          const t = typeof type === 'string' ? type : 'default';
          const colors: Record<string, string> = {
            Person: '#8b5cf6',
            Organization: '#06b6d4',
            Product: '#f59e0b',
            Class: '#ef4444',
            Function: '#3b82f6',
            default: '#6366f1',
          };
          return colors[t] || colors.default;
        }

        const CardNode = defineComponent({
          props: {
            id: { type: String, required: true },
            data: { type: Object, required: true },
            sourcePosition: { type: String, required: true },
            targetPosition: { type: String, required: true },
          },
          setup(props) {
            return () => {
              const d = props.data as {
                label?: string;
                type?: string;
                namespace?: string;
                id?: string;
                connections?: number;
                propertyEntries?: Array<[string, unknown]>;
              };

              const typeColor = getTypeColor(d.type);
              const entries = Array.isArray(d.propertyEntries)
                ? d.propertyEntries
                : [];

              return h(
                'div',
                {
                  class:
                    'relative rounded-lg border border-slate-700 bg-slate-800 text-slate-200 shadow-sm overflow-hidden w-[240px]',
                },
                [
                  h(Handle as unknown as any, {
                    id: 't',
                    type: 'target',
                    position: props.targetPosition,
                    class:
                      'w-2 h-2 bg-slate-300 border border-slate-700 rounded-full',
                  }),
                  h(Handle as unknown as any, {
                    id: 's',
                    type: 'source',
                    position: props.sourcePosition,
                    class:
                      'w-2 h-2 bg-slate-300 border border-slate-700 rounded-full',
                  }),
                  h('div', {
                    class: 'h-2',
                    style: { backgroundColor: typeColor },
                  }),
                  h('div', { class: 'p-3' }, [
                    h(
                      'div',
                      { class: 'text-sm font-semibold leading-snug mb-2' },
                      d.label || d.id || '',
                    ),
                    h(
                      'div',
                      { class: 'flex flex-wrap items-center gap-2 mb-2' },
                      [
                        h(
                          'span',
                          {
                            class:
                              'text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300',
                          },
                          d.type || 'Thing',
                        ),
                        h(
                          'span',
                          {
                            class:
                              'text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400',
                          },
                          d.namespace || 'default',
                        ),
                        typeof d.connections === 'number' && d.connections > 0
                          ? h(
                              'span',
                              { class: 'text-xs text-slate-500' },
                              `${d.connections} connection${
                                d.connections === 1 ? '' : 's'
                              }`,
                            )
                          : null,
                      ],
                    ),
                    entries.length > 0
                      ? h(
                          'div',
                          { class: 'space-y-1 text-xs' },
                          entries
                            .slice(0, 3)
                            .map(([key, value]) =>
                              h('div', { key, class: 'flex flex-col' }, [
                                h(
                                  'span',
                                  { class: 'text-slate-500 font-medium' },
                                  key,
                                ),
                                h(
                                  'span',
                                  { class: 'text-slate-300 line-clamp-2' },
                                  typeof value === 'object'
                                    ? JSON.stringify(value)
                                    : String(value),
                                ),
                              ]),
                            ),
                        )
                      : null,
                    h('div', { class: 'mt-2 pt-2 border-t border-slate-700' }, [
                      h(
                        'div',
                        {
                          class: 'text-[10px] text-slate-600 truncate',
                          title: d.id,
                        },
                        d.id || '',
                      ),
                    ]),
                  ]),
                ],
              );
            };
          },
        });

        function layout(
          nodes: Array<{ id: string; position: { x: number; y: number } }>,
          edges: Array<{ source: string; target: string }>,
          layoutDirection: 'LR' | 'TB',
        ) {
          const dagreGraph = new dagre.graphlib.Graph();
          graph.value = dagreGraph;
          dagreGraph.setDefaultEdgeLabel(() => ({}));

          const isHorizontal = layoutDirection === 'LR';
          const isSpacious = density.value === 'spacious';

          dagreGraph.setGraph({
            rankdir: layoutDirection,
            ranksep: isSpacious ? 180 : 120,
            nodesep: isSpacious ? 110 : 70,
            marginx: 32,
            marginy: 32,
          });

          for (const node of nodes) {
            const graphNode = findNode(node.id);

            dagreGraph.setNode(node.id, {
              width: graphNode?.dimensions.width || 240,
              height: graphNode?.dimensions.height || 120,
            });
          }

          for (const edge of edges) {
            dagreGraph.setEdge(edge.source, edge.target);
          }

          dagre.layout(dagreGraph);

          return nodes.map((node) => {
            const nodeWithPosition = dagreGraph.node(node.id) as
              | { x: number; y: number }
              | undefined;

            const graphNode = findNode(node.id);
            const width = graphNode?.dimensions.width || 240;
            const height = graphNode?.dimensions.height || 120;

            const x = (nodeWithPosition?.x ?? node.position.x) - width / 2;
            const y = (nodeWithPosition?.y ?? node.position.y) - height / 2;

            return {
              ...node,
              targetPosition: isHorizontal ? Position.Left : Position.Top,
              sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
              position: { x, y },
            };
          });
        }

        function runLayout(layoutDirection = direction.value) {
          const nodes = state.nodes as Array<{
            id: string;
            position: { x: number; y: number };
          }>;
          const edges = state.edges as Array<{
            source: string;
            target: string;
          }>;

          if (!nodes.length) return;

          state.nodes = layout(nodes, edges, layoutDirection);

          nextTick(() => {
            fitView({ padding: 0.2 });
          });
        }

        onInit(() => {
          nextTick(() => {
            runLayout(direction.value);
          });
        });

        onNodesInitialized(() => {
          nextTick(() => {
            runLayout(direction.value);
          });
        });

        watch(
          () => state.nonce,
          () => {
            nextTick(() => {
              runLayout(direction.value);
            });
          },
        );

        watch(
          () => [direction.value, density.value] as const,
          () => {
            nextTick(() => {
              runLayout(direction.value);
            });
          },
        );

        function setDirection(next: 'LR' | 'TB') {
          direction.value = next;
        }

        function setDensity(next: 'compact' | 'spacious') {
          density.value = next;
        }

        return () =>
          h(
            VueFlow as unknown as any,
            {
              id,
              nodes: state.nodes,
              edges: state.edges,
              nodeTypes: { card: CardNode },
              fitViewOnInit: true,
              class: 'w-full h-full',
            },
            {
              default: () => [
                h(Background as unknown as any),
                h(MiniMap as unknown as any),
                h(Controls as unknown as any),
                h(
                  Panel as unknown as any,
                  { position: 'top-right' },
                  {
                    default: () =>
                      h(
                        'div',
                        {
                          class:
                            'bg-slate-800/90 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs backdrop-blur',
                        },
                        [
                          h('div', { class: 'flex items-center gap-2' }, [
                            h('span', { class: 'text-slate-400' }, 'Layout'),
                            h(
                              'button',
                              {
                                class:
                                  direction.value === 'LR'
                                    ? 'px-2 py-1 rounded bg-indigo-600 text-white'
                                    : 'px-2 py-1 rounded bg-slate-700 text-slate-200',
                                onClick: () => setDirection('LR'),
                              },
                              'Horizontal',
                            ),
                            h(
                              'button',
                              {
                                class:
                                  direction.value === 'TB'
                                    ? 'px-2 py-1 rounded bg-indigo-600 text-white'
                                    : 'px-2 py-1 rounded bg-slate-700 text-slate-200',
                                onClick: () => setDirection('TB'),
                              },
                              'Vertical',
                            ),
                          ]),
                          h('div', { class: 'flex items-center gap-2 mt-2' }, [
                            h('span', { class: 'text-slate-400' }, 'Spacing'),
                            h(
                              'button',
                              {
                                class:
                                  density.value === 'compact'
                                    ? 'px-2 py-1 rounded bg-indigo-600 text-white'
                                    : 'px-2 py-1 rounded bg-slate-700 text-slate-200',
                                onClick: () => setDensity('compact'),
                              },
                              'Compact',
                            ),
                            h(
                              'button',
                              {
                                class:
                                  density.value === 'spacious'
                                    ? 'px-2 py-1 rounded bg-indigo-600 text-white'
                                    : 'px-2 py-1 rounded bg-slate-700 text-slate-200',
                                onClick: () => setDensity('spacious'),
                              },
                              'Spacious',
                            ),
                          ]),
                        ],
                      ),
                  },
                ),
              ],
            },
          );
      },
    });

    const app = createApp(Root);

    app.mount(el);

    vueAppRef.current = app;
    setGraphRef.current = (nodes: unknown[], edges: unknown[]) => {
      state.nodes = nodes;
      state.edges = edges;
      state.nonce += 1;
    };

    setGraphRef.current(mapped.vfNodes, mapped.vfEdges);

    return () => {
      try {
        app.unmount();
      } finally {
        vueAppRef.current = null;
        setGraphRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setGraphRef.current?.(mapped.vfNodes, mapped.vfEdges);
  }, [mapped.vfEdges, mapped.vfNodes]);

  return <div ref={containerRef} className="w-full h-full" />;
}
