'use client';

import React, { useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  Factory,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';

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

interface TriReportingQuestionnaireProps {
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

type QuestionType = 'text' | 'number' | 'checkbox' | 'yesno';

type Question = {
  id: string;
  section: string;
  label: string;
  helper?: string;
  type: QuestionType;
  required?: boolean;
};

function safeString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pillClass(active: boolean) {
  return `px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
    active
      ? 'bg-indigo-600 text-white border-indigo-500'
      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
  }`;
}

export function TriReportingQuestionnaire({
  data,
}: TriReportingQuestionnaireProps) {
  const nodesById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes]);

  const outgoing = useMemo(() => {
    const m = new Map<string, GraphEdge[]>();
    for (const e of data.edges) {
      const arr = m.get(e.source) ?? [];
      arr.push(e);
      m.set(e.source, arr);
    }
    return m;
  }, [data.edges]);

  const incoming = useMemo(() => {
    const m = new Map<string, GraphEdge[]>();
    for (const e of data.edges) {
      const arr = m.get(e.target) ?? [];
      arr.push(e);
      m.set(e.target, arr);
    }
    return m;
  }, [data.edges]);

  const triFacilities = useMemo(
    () =>
      data.nodes
        .filter((n) => n.type.toLowerCase().includes('facility'))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [data.nodes],
  );

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(() => {
    return triFacilities[0]?.id ?? '';
  });

  const selectedFacility = useMemo(() => {
    if (!selectedFacilityId) return null;
    return nodesById.get(selectedFacilityId) ?? null;
  }, [nodesById, selectedFacilityId]);

  const threshold = useMemo(() => {
    const regulation = data.nodes.find((n) =>
      n.type.toLowerCase().includes('regulation'),
    );
    const t = regulation
      ? safeNumber(regulation.properties.reportingThreshold)
      : null;
    return t ?? 25000;
  }, [data.nodes]);

  const facilityReports = useMemo(() => {
    if (!selectedFacility) return [] as GraphNode[];

    const reportIds = new Set<string>();

    for (const e of outgoing.get(selectedFacility.id) ?? []) {
      if (e.predicate === 'reports') reportIds.add(e.target);
    }

    for (const e of incoming.get(selectedFacility.id) ?? []) {
      if (e.predicate === 'facility') reportIds.add(e.source);
    }

    const reports = Array.from(reportIds)
      .map((id) => nodesById.get(id))
      .filter((n): n is GraphNode => Boolean(n))
      .filter((n) => n.type.toLowerCase().includes('report'))
      .sort((a, b) => {
        const ay = safeNumber(a.properties.reportingYear) ?? 0;
        const by = safeNumber(b.properties.reportingYear) ?? 0;
        return by - ay;
      });

    return reports;
  }, [incoming, nodesById, outgoing, selectedFacility]);

  const activeReport = useMemo(() => {
    return facilityReports[0] ?? null;
  }, [facilityReports]);

  const facilityReleases = useMemo(() => {
    if (!selectedFacility) return [] as GraphNode[];

    const releaseIds = new Set<string>();

    for (const e of incoming.get(selectedFacility.id) ?? []) {
      if (e.predicate === 'facility') releaseIds.add(e.source);
    }

    if (activeReport) {
      for (const e of outgoing.get(activeReport.id) ?? []) {
        if (e.predicate === 'releases') releaseIds.add(e.target);
      }
    }

    const releases = Array.from(releaseIds)
      .map((id) => nodesById.get(id))
      .filter((n): n is GraphNode => Boolean(n))
      .filter((n) => n.type.toLowerCase().includes('release'))
      .sort((a, b) => (b.label ?? '').localeCompare(a.label ?? ''));

    return releases;
  }, [activeReport, incoming, nodesById, outgoing, selectedFacility]);

  const releasesWithChemicals = useMemo(() => {
    const rows = facilityReleases.map((release) => {
      const chemEdge = (outgoing.get(release.id) ?? []).find(
        (e) => e.predicate === 'chemical',
      );
      const chemical = chemEdge
        ? (nodesById.get(chemEdge.target) ?? null)
        : null;

      return {
        release,
        chemical,
        total: safeNumber(release.properties.totalReleases) ?? 0,
        air: safeNumber(release.properties.airEmissions) ?? 0,
        water: safeNumber(release.properties.waterDischarges) ?? 0,
        land: safeNumber(release.properties.landDisposal) ?? 0,
        unit: safeString(release.properties.unit) || 'pounds',
      };
    });

    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [facilityReleases, nodesById, outgoing]);

  const totals = useMemo(() => {
    const total = releasesWithChemicals.reduce((sum, r) => sum + r.total, 0);
    const air = releasesWithChemicals.reduce((sum, r) => sum + r.air, 0);
    const water = releasesWithChemicals.reduce((sum, r) => sum + r.water, 0);
    const land = releasesWithChemicals.reduce((sum, r) => sum + r.land, 0);
    const unit = releasesWithChemicals[0]?.unit ?? 'pounds';
    return { total, air, water, land, unit };
  }, [releasesWithChemicals]);

  const reportingYear = useMemo(() => {
    return (
      safeNumber(activeReport?.properties.reportingYear) ??
      new Date().getFullYear()
    );
  }, [activeReport]);

  const questions = useMemo<Question[]>(() => {
    const facilityName = selectedFacility?.label ?? 'this facility';
    const reportName = activeReport?.label ?? `TRI report ${reportingYear}`;

    return [
      {
        id: 'facility_contact_name',
        section: 'Facility contacts',
        label: 'Who is the TRI reporting lead for this facility?',
        helper:
          'Name of the person coordinating data collection and submission.',
        type: 'text',
        required: true,
      },
      {
        id: 'facility_contact_email',
        section: 'Facility contacts',
        label: 'TRI reporting lead email',
        type: 'text',
        required: true,
      },
      {
        id: 'facility_contact_phone',
        section: 'Facility contacts',
        label: 'TRI reporting lead phone number',
        type: 'text',
        required: true,
      },
      {
        id: 'verify_facility_profile',
        section: 'Facility profile',
        label: `Confirm facility profile details for ${facilityName} are accurate`,
        helper: 'Address, NAICS code, and parent company are correct.',
        type: 'checkbox',
        required: true,
      },
      {
        id: 'verify_reporting_year',
        section: 'Reporting period',
        label: `Confirm reporting year ${reportingYear} (${reportName})`,
        helper:
          'If incorrect, contact corporate to align on the reporting cycle.',
        type: 'checkbox',
        required: true,
      },
      {
        id: 'threshold_applicability',
        section: 'Threshold determination',
        label: `Did ${facilityName} exceed the TRI threshold for any listed chemical (≥ ${threshold.toLocaleString()} lbs)?`,
        helper:
          'Consider manufactured, processed, or otherwise used quantities for the reporting year.',
        type: 'yesno',
        required: true,
      },
      {
        id: 'chemical_list_confirmed',
        section: 'Chemical inventory',
        label: 'Confirm the list of TRI chemicals and CAS numbers is complete',
        helper:
          'Include all reportable chemicals for the facility—even if releases are zero.',
        type: 'checkbox',
        required: true,
      },
      {
        id: 'calculation_method',
        section: 'Release estimation',
        label: 'How were releases calculated/estimated?',
        helper:
          'Examples: continuous emissions monitoring, mass balance, engineering calculations, supplier data, etc.',
        type: 'text',
        required: true,
      },
      {
        id: 'controls_changes',
        section: 'Release estimation',
        label:
          'Were there any process or control changes that materially affected releases?',
        helper:
          'If yes, describe the change and when it occurred (e.g., new scrubber, process optimization).',
        type: 'text',
      },
      {
        id: 'waste_mgmt_summary',
        section: 'Waste management',
        label:
          'Summarize waste management methods used (recycling/treatment/disposal)',
        type: 'text',
      },
      {
        id: 'certifier_name',
        section: 'Certification',
        label: 'Who will certify the TRI submission (name and title)?',
        helper: 'Corporate may require an authorized official for sign-off.',
        type: 'text',
        required: true,
      },
      {
        id: 'certify_accuracy',
        section: 'Certification',
        label:
          'I certify the information collected is complete and accurate to the best of my knowledge',
        type: 'checkbox',
        required: true,
      },
    ];
  }, [activeReport?.label, reportingYear, selectedFacility?.label, threshold]);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const sectionOrder = useMemo(() => {
    const order: string[] = [];
    for (const q of questions) {
      if (!order.includes(q.section)) order.push(q.section);
    }
    return order;
  }, [questions]);

  const progress = useMemo(() => {
    const required = questions.filter((q) => q.required);
    const requiredAnswered = required.filter((q) => {
      const v = answers[q.id];
      if (q.type === 'checkbox') return v === true;
      if (q.type === 'yesno') return v === true || v === false;
      const s = safeString(v).trim();
      return s.length > 0;
    }).length;

    return {
      requiredAnswered,
      requiredTotal: required.length,
      percent:
        required.length > 0
          ? Math.round((requiredAnswered / required.length) * 100)
          : 0,
    };
  }, [answers, questions]);

  const summaryText = useMemo(() => {
    const facilityId = safeString(selectedFacility?.properties.facilityId);
    const address = safeString(selectedFacility?.properties.address);
    const state = safeString(selectedFacility?.properties.state);
    const naics = safeString(selectedFacility?.properties.naicsCode);
    const submissionDate = safeString(activeReport?.properties.submissionDate);

    const lines: string[] = [];
    lines.push(`TRI Reporting Questionnaire Summary`);
    lines.push(`Facility: ${selectedFacility?.label ?? ''}`);
    if (facilityId) lines.push(`Facility ID: ${facilityId}`);
    if (address) lines.push(`Address: ${address}`);
    if (state) lines.push(`State: ${state}`);
    if (naics) lines.push(`NAICS: ${naics}`);
    lines.push(`Reporting year: ${reportingYear}`);
    if (submissionDate) lines.push(`Target submission date: ${submissionDate}`);
    lines.push('');

    for (const section of sectionOrder) {
      lines.push(section);
      for (const q of questions.filter((qq) => qq.section === section)) {
        const v = answers[q.id];
        const rendered =
          q.type === 'checkbox'
            ? v === true
              ? 'Yes'
              : 'No'
            : q.type === 'yesno'
              ? v === true
                ? 'Yes'
                : v === false
                  ? 'No'
                  : ''
              : safeString(v);
        lines.push(`- ${q.label}: ${rendered}`);
      }
      lines.push('');
    }

    if (releasesWithChemicals.length > 0) {
      lines.push('Release totals (from dataset)');
      lines.push(
        `- Total releases: ${totals.total.toLocaleString()} ${totals.unit}`,
      );
      lines.push(
        `- Air emissions: ${totals.air.toLocaleString()} ${totals.unit}`,
      );
      lines.push(
        `- Water discharges: ${totals.water.toLocaleString()} ${totals.unit}`,
      );
      lines.push(
        `- Land disposal: ${totals.land.toLocaleString()} ${totals.unit}`,
      );
    }

    return lines.join('\n');
  }, [
    activeReport?.properties.submissionDate,
    answers,
    questions,
    releasesWithChemicals.length,
    reportingYear,
    sectionOrder,
    selectedFacility?.label,
    selectedFacility?.properties.address,
    selectedFacility?.properties.facilityId,
    selectedFacility?.properties.naicsCode,
    selectedFacility?.properties.state,
    totals.air,
    totals.land,
    totals.total,
    totals.unit,
    totals.water,
  ]);

  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  function renderQuestion(q: Question) {
    const value = answers[q.id];

    if (q.type === 'checkbox') {
      return (
        <label className="flex items-start gap-3 select-none">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) =>
              setAnswers((prev) => ({ ...prev, [q.id]: e.target.checked }))
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
          />
          <div>
            <div className="text-sm text-slate-200">{q.label}</div>
            {q.helper && (
              <div className="text-xs text-slate-500">{q.helper}</div>
            )}
          </div>
        </label>
      );
    }

    if (q.type === 'yesno') {
      return (
        <div>
          <div className="text-sm text-slate-200">{q.label}</div>
          {q.helper && (
            <div className="text-xs text-slate-500 mt-1">{q.helper}</div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className={pillClass(value === true)}
              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: true }))}
            >
              Yes
            </button>
            <button
              type="button"
              className={pillClass(value === false)}
              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: false }))}
            >
              No
            </button>
          </div>
        </div>
      );
    }

    const isNumber = q.type === 'number';

    return (
      <div>
        <div className="text-sm text-slate-200">{q.label}</div>
        {q.helper && (
          <div className="text-xs text-slate-500 mt-1">{q.helper}</div>
        )}
        <input
          type={isNumber ? 'number' : 'text'}
          value={safeString(value)}
          onChange={(e) =>
            setAnswers((prev) => ({
              ...prev,
              [q.id]: isNumber ? e.target.value : e.target.value,
            }))
          }
          className="mt-2 w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full p-6 overflow-auto bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              <h1 className="text-2xl font-bold text-slate-100">
                TRI Reporting Questionnaire
              </h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              A facility-manager template to gather what corporate needs for
              compliant TRI reporting.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <div className="text-sm text-slate-200 font-medium">
                {progress.requiredAnswered} / {progress.requiredTotal}
              </div>
              <div className="text-xs text-slate-500">required</div>
            </div>
            <div className="w-40">
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 mt-1 text-right">
                {progress.percent}%
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Factory className="w-4 h-4 text-slate-300" />
                  <h2 className="text-lg font-semibold text-slate-100">
                    Facility selection
                  </h2>
                </div>

                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {triFacilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFacility && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      <div className="text-sm font-semibold text-slate-200">
                        Facility profile
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>
                        <span className="text-slate-500">Facility ID:</span>{' '}
                        {safeString(selectedFacility.properties.facilityId)}
                      </div>
                      <div>
                        <span className="text-slate-500">Address:</span>{' '}
                        {safeString(selectedFacility.properties.address)}
                      </div>
                      <div>
                        <span className="text-slate-500">NAICS:</span>{' '}
                        {safeString(selectedFacility.properties.naicsCode)}
                      </div>
                      <div>
                        <span className="text-slate-500">State:</span>{' '}
                        {safeString(selectedFacility.properties.state)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarClock className="w-4 h-4 text-amber-400" />
                      <div className="text-sm font-semibold text-slate-200">
                        Reporting context
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>
                        <span className="text-slate-500">Reporting year:</span>{' '}
                        {reportingYear}
                      </div>
                      <div>
                        <span className="text-slate-500">Submission date:</span>{' '}
                        {safeString(activeReport?.properties.submissionDate) ||
                          '—'}
                      </div>
                      <div>
                        <span className="text-slate-500">Threshold:</span> ≥{' '}
                        {threshold.toLocaleString()} lbs
                      </div>
                      <div>
                        <span className="text-slate-500">
                          Tracked chemicals:
                        </span>{' '}
                        {releasesWithChemicals.length}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <h2 className="text-lg font-semibold text-slate-100">
                  Required questionnaire
                </h2>
              </div>

              <div className="space-y-6">
                {sectionOrder.map((section) => (
                  <div key={section} className="space-y-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {section}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {questions
                        .filter((q) => q.section === section)
                        .map((q) => (
                          <div
                            key={q.id}
                            className="bg-slate-900/40 rounded-lg p-4 border border-slate-700"
                          >
                            {renderQuestion(q)}
                            {q.required && (
                              <div className="mt-2 text-[11px] text-slate-600">
                                Required
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical className="w-4 h-4 text-purple-400" />
                <h2 className="text-lg font-semibold text-slate-100">
                  Releases snapshot (from dataset)
                </h2>
              </div>

              {releasesWithChemicals.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No releases are linked to the selected facility.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-500">Total</div>
                      <div className="text-lg font-semibold text-slate-100">
                        {totals.total.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {totals.unit}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-500">Air</div>
                      <div className="text-lg font-semibold text-slate-100">
                        {totals.air.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {totals.unit}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-500">Water</div>
                      <div className="text-lg font-semibold text-slate-100">
                        {totals.water.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {totals.unit}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-500">Land</div>
                      <div className="text-lg font-semibold text-slate-100">
                        {totals.land.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {totals.unit}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-left">
                          <th className="px-3 py-2 text-slate-300 font-medium">
                            Chemical
                          </th>
                          <th className="px-3 py-2 text-slate-300 font-medium">
                            Total ({totals.unit})
                          </th>
                          <th className="px-3 py-2 text-slate-300 font-medium">
                            Air
                          </th>
                          <th className="px-3 py-2 text-slate-300 font-medium">
                            Water
                          </th>
                          <th className="px-3 py-2 text-slate-300 font-medium">
                            Land
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {releasesWithChemicals.map((r) => (
                          <tr
                            key={r.release.id}
                            className="border-t border-slate-700"
                          >
                            <td className="px-3 py-2 text-slate-200">
                              {r.chemical?.label ?? r.release.label}
                            </td>
                            <td className="px-3 py-2 text-slate-200">
                              {r.total.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {r.air.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {r.water.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {r.land.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-xs text-slate-500">
                    This table is a snapshot of graph data and should be
                    validated against production systems before submission.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-100">
                  Summary for corporate
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-slate-200 hover:border-slate-600"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <textarea
                value={summaryText}
                readOnly
                className="mt-3 w-full h-[520px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono focus:outline-none"
              />
              <div className="mt-3 text-xs text-slate-500">
                Copy/paste this into an email or ticket to corporate. (Not
                persisted.)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
