'use client';

import React, { useState } from 'react';

interface FormDetailViewProps {
  data: {
    nodes: any[];
    edges: any[];
  };
  onUpdate?: (updatedData: { nodes: any[]; edges: any[] }) => void;
}

export function FormDetailView({ data, onUpdate }: FormDetailViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    data.nodes[0]?.id || null,
  );
  const [editedNode, setEditedNode] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const selectedNode = data.nodes.find((n) => n.id === selectedNodeId);

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      Person: '#8b5cf6',
      Organization: '#06b6d4',
      Product: '#f59e0b',
      Class: '#ef4444',
      Function: '#3b82f6',
      default: '#6366f1',
    };
    return colors[type] || colors.default;
  };

  const getConnectedNodes = (nodeId: string) => {
    const outgoing = data.edges
      .filter((e) => e.source === nodeId)
      .map((e) => ({
        ...data.nodes.find((n) => n.id === e.target),
        predicate: e.predicate,
        direction: 'outgoing',
      }));
    const incoming = data.edges
      .filter((e) => e.target === nodeId)
      .map((e) => ({
        ...data.nodes.find((n) => n.id === e.source),
        predicate: e.predicate,
        direction: 'incoming',
      }));
    return [...outgoing, ...incoming];
  };

  const handleEdit = () => {
    setEditedNode({ ...selectedNode });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editedNode && onUpdate) {
      const updatedNodes = data.nodes.map((n) =>
        n.id === editedNode.id ? editedNode : n,
      );
      onUpdate({ ...data, nodes: updatedNodes });
    }
    setIsEditing(false);
    setEditedNode(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedNode(null);
  };

  const handlePropertyChange = (key: string, value: any) => {
    setEditedNode({
      ...editedNode,
      properties: {
        ...editedNode.properties,
        [key]: value,
      },
    });
  };

  const handleLabelChange = (value: string) => {
    setEditedNode({
      ...editedNode,
      label: value,
    });
  };

  if (!selectedNode) {
    return (
      <div className="text-center py-12 text-slate-500">No nodes available</div>
    );
  }

  const displayNode = isEditing ? editedNode : selectedNode;
  const connections = getConnectedNodes(selectedNode.id);

  return (
    <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Node List */}
      <div className="lg:col-span-1">
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200">
              All Nodes ({data.nodes.length})
            </h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {data.nodes.map((node) => (
              <button
                key={node.id}
                onClick={() => {
                  setSelectedNodeId(node.id);
                  setIsEditing(false);
                  setEditedNode(null);
                }}
                className={`w-full text-left p-3 border-b border-slate-700 hover:bg-slate-750 transition-colors ${
                  selectedNodeId === node.id ? 'bg-slate-750' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getTypeColor(node.type) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {node.label}
                    </div>
                    <div className="text-xs text-slate-500">{node.type}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <div className="lg:col-span-2">
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          {/* Header */}
          <div
            className="h-2"
            style={{ backgroundColor: getTypeColor(displayNode.type) }}
          />
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={displayNode.label}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    className="text-2xl font-bold text-slate-200 bg-slate-700 px-3 py-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-slate-200">
                    {displayNode.label}
                  </h2>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm px-3 py-1 rounded-full bg-slate-700 text-slate-300">
                    {displayNode.type}
                  </span>
                  <span className="text-sm text-slate-500">
                    {connections.length} connection
                    {connections.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-600 font-mono">
              {displayNode.id}
            </div>
          </div>

          {/* Properties */}
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              Properties
            </h3>
            <div className="space-y-4">
              {Object.entries(displayNode.properties).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    {key}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={String(value)}
                      onChange={(e) =>
                        handlePropertyChange(key, e.target.value)
                      }
                      className="w-full px-3 py-2 bg-slate-700 text-slate-200 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-900 text-slate-300 rounded border border-slate-700">
                      {typeof value === 'object'
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                    </div>
                  )}
                </div>
              ))}
              {Object.keys(displayNode.properties).length === 0 && (
                <div className="text-sm text-slate-500 italic">
                  No properties defined
                </div>
              )}
            </div>
          </div>

          {/* Connections */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              Connections
            </h3>
            <div className="space-y-2">
              {connections.map((conn, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getTypeColor(conn.type) }}
                  />
                  <div className="flex-1">
                    <div className="text-sm text-slate-200">{conn.label}</div>
                    <div className="text-xs text-slate-500">
                      {conn.direction === 'outgoing' ? '→' : '←'}{' '}
                      {conn.predicate}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNodeId(conn.id)}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    View
                  </button>
                </div>
              ))}
              {connections.length === 0 && (
                <div className="text-sm text-slate-500 italic">
                  No connections
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
