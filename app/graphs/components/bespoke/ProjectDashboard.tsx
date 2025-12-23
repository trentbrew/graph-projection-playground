'use client';

import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  Target,
} from 'lucide-react';

interface ProjectDashboardProps {
  data: {
    nodes: any[];
    edges: any[];
  };
}

export function ProjectDashboard({ data }: ProjectDashboardProps) {
  const tasks = data.nodes.filter((n) => n.type === 'Task');
  const milestones = data.nodes.filter((n) => n.type === 'Milestone');
  const people = data.nodes.filter((n) => n.type === 'Person');

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'Todo').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    blocked: tasks.filter((t) => t.status === 'Blocked').length,
    done: tasks.filter((t) => t.status === 'Done').length,
  };

  const totalTasks = tasks.length;
  const completionRate =
    totalTasks > 0 ? Math.round((tasksByStatus.done / totalTasks) * 100) : 0;

  const upcomingMilestones = milestones
    .filter((m) => m.dueDate && new Date(m.dueDate) > new Date())
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )
    .slice(0, 3);

  const recentTasks = tasks.filter((t) => t.status !== 'Done').slice(0, 5);

  return (
    <div className="w-full h-full p-6 overflow-auto bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              Project Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Overview of project progress and metrics
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-2xl font-bold text-slate-100">
              {completionRate}%
            </span>
            <span className="text-xs text-slate-400">Complete</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">To Do</span>
              <Circle className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-3xl font-bold text-slate-100">
              {tasksByStatus.todo}
            </div>
            <div className="text-xs text-slate-500 mt-1">Pending tasks</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">In Progress</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-400">
              {tasksByStatus.inProgress}
            </div>
            <div className="text-xs text-slate-500 mt-1">Active tasks</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Blocked</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400">
              {tasksByStatus.blocked}
            </div>
            <div className="text-xs text-slate-500 mt-1">Needs attention</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-400">
              {tasksByStatus.done}
            </div>
            <div className="text-xs text-slate-500 mt-1">Finished tasks</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Progress Chart */}
          <div className="lg:col-span-2 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              Task Distribution
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">Completed</span>
                  <span className="text-sm font-medium text-slate-300">
                    {tasksByStatus.done} / {totalTasks}
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">In Progress</span>
                  <span className="text-sm font-medium text-slate-300">
                    {tasksByStatus.inProgress} / {totalTasks}
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${totalTasks > 0 ? (tasksByStatus.inProgress / totalTasks) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">To Do</span>
                  <span className="text-sm font-medium text-slate-300">
                    {tasksByStatus.todo} / {totalTasks}
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-500 transition-all duration-500"
                    style={{
                      width: `${totalTasks > 0 ? (tasksByStatus.todo / totalTasks) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">Blocked</span>
                  <span className="text-sm font-medium text-slate-300">
                    {tasksByStatus.blocked} / {totalTasks}
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{
                      width: `${totalTasks > 0 ? (tasksByStatus.blocked / totalTasks) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-300">
                  Team Members
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {people.slice(0, 8).map((person) => (
                  <div
                    key={person.id}
                    className="px-3 py-1.5 bg-slate-700 rounded-full text-xs text-slate-300 border border-slate-600"
                  >
                    {person.label}
                  </div>
                ))}
                {people.length > 8 && (
                  <div className="px-3 py-1.5 bg-slate-700 rounded-full text-xs text-slate-400 border border-slate-600">
                    +{people.length - 8} more
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Milestones */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-indigo-400" />
                <h2 className="text-lg font-semibold text-slate-100">
                  Upcoming Milestones
                </h2>
              </div>
              <div className="space-y-3">
                {upcomingMilestones.length > 0 ? (
                  upcomingMilestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                    >
                      <div className="font-medium text-slate-200 text-sm mb-1">
                        {milestone.label}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(milestone.dueDate).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    No upcoming milestones
                  </p>
                )}
              </div>
            </div>

            {/* Recent Tasks */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">
                Active Tasks
              </h2>
              <div className="space-y-2">
                {recentTasks.length > 0 ? (
                  recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-2 p-2 rounded hover:bg-slate-700/50 transition-colors"
                    >
                      {task.status === 'Done' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      ) : task.status === 'Blocked' ? (
                        <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      ) : task.status === 'In Progress' ? (
                        <Clock className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate">
                          {task.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {task.status}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    No active tasks
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
