'use client';

import React, { useState } from 'react';

interface CardGridViewProps {
  data: {
    nodes: any[];
    edges: any[];
  };
}

export function CardGridView({ data }: CardGridViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'label' | 'type'>('label');
  const [selectedType, setSelectedType] = useState<string>('all');

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

  const types = ['all', ...new Set(data.nodes.map((n) => n.type))];

  const filteredNodes = data.nodes
    .filter((node) => {
      const matchesSearch =
        node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        Object.values(node.properties).some((v) =>
          String(v).toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const matchesType = selectedType === 'all' || node.type === selectedType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'label') return a.label.localeCompare(b.label);
      return a.type.localeCompare(b.type);
    });

  const getConnectionCount = (nodeId: string) => {
    return data.edges.filter((e) => e.source === nodeId || e.target === nodeId)
      .length;
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Types' : type}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'label' | 'type')}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="label">Sort by Name</option>
          <option value="type">Sort by Type</option>
        </select>
        <div className="text-sm text-slate-400">
          {filteredNodes.length} of {data.nodes.length} nodes
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredNodes.map((node) => {
          const connections = getConnectionCount(node.id);
          const propertyEntries = Object.entries(node.properties).filter(
            ([k]) => !['name', 'label', 'title'].includes(k),
          );

          return (
            <div
              key={node.id}
              className="bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-indigo-500/10 overflow-hidden"
            >
              {/* Header */}
              <div
                className="h-2"
                style={{ backgroundColor: getTypeColor(node.type) }}
              />

              <div className="p-4">
                {/* Title */}
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-200 mb-1 line-clamp-2">
                    {node.label}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      {node.type}
                    </span>
                    {connections > 0 && (
                      <span className="text-xs text-slate-500">
                        {connections} connection{connections !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Properties */}
                {propertyEntries.length > 0 && (
                  <div className="space-y-2 text-xs">
                    {propertyEntries.slice(0, 4).map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-slate-500 font-medium mb-0.5">
                          {key}
                        </span>
                        <span className="text-slate-300 line-clamp-2">
                          {typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                    {propertyEntries.length > 4 && (
                      <div className="text-slate-600 italic">
                        +{propertyEntries.length - 4} more properties
                      </div>
                    )}
                  </div>
                )}

                {/* ID */}
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div
                    className="text-xs text-slate-600 truncate"
                    title={node.id}
                  >
                    {node.id}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredNodes.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No nodes found matching your filters
        </div>
      )}
    </div>
  );
}
