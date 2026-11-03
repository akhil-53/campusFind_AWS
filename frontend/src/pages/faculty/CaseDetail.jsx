import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCaseDossier,
  updateMatchStatus,
  scheduleVerification,
  completeVerification,
  declareNotFound,
  downloadHandoverPdf,
  getMeta
} from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Tag,
  ShieldCheck,
  Check,
  X,
  FileCheck,
  AlertTriangle,
  Download,
  Boxes,
  HelpCircle,
  Sparkles,
  Eye,
  Maximize2
} from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

export function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modals state
  const [scheduleModalMatch, setScheduleModalMatch] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [venue, setVenue] = useState('SJT G03');

  const [outcomeModalVerif, setOutcomeModalVerif] = useState(null);
  const [outcome, setOutcome] = useState('VERIFIED');
  const [marksObserved, setMarksObserved] = useState('');
  const [remarks, setRemarks] = useState('');
  const [generatedLetter, setGeneratedLetter] = useState(null);

  const [notFoundConfirmOpen, setNotFoundConfirmOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [comparisonModal, setComparisonModal] = useState(null);

  const { data: metaData } = useQuery({ queryKey: ['meta'], queryFn: getMeta });

  const { data, isLoading } = useQuery({
    queryKey: ['caseDossier', id],
    queryFn: () => getCaseDossier(id)
  });

  const { report, matches = [], verifications = [], escalationHistory = [], roomVisits = [] } = data || {};

  // Mutations
  const matchStatusMutation = useMutation({
    mutationFn: ({ matchId, status }) => updateMatchStatus(matchId, status),
    onSuccess: () => {
      toast.success('Match status updated');
      queryClient.invalidateQueries(['caseDossier', id]);
    }
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload) => scheduleVerification(payload),
    onSuccess: () => {
      toast.success('Verification visit scheduled! Student notified.');
      queryClient.invalidateQueries(['caseDossier', id]);
      setScheduleModalMatch(null);
    }
  });

  const outcomeMutation = useMutation({
    mutationFn: (payload) => completeVerification(outcomeModalVerif.verificationId, payload),
    onSuccess: (res) => {
      toast.success(`Verification outcome recorded: ${res.outcome}`);
      queryClient.invalidateQueries(['caseDossier', id]);
      if (res.letter) {
        setGeneratedLetter(res.letter);
      } else {
        setOutcomeModalVerif(null);
      }
    }
  });

  const notFoundMutation = useMutation({
    mutationFn: () => declareNotFound(id),
    onSuccess: () => {
      toast.success('Case declared NOT_FOUND. Student instructed to visit SJT room.');
      queryClient.invalidateQueries(['caseDossier', id]);
      setNotFoundConfirmOpen(false);
    }
  });

  if (isLoading) {
    return <div className="py-16 text-center text-xs text-slate-400">Loading case dossier...</div>;
  }

  if (!report) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/faculty')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-slate-400">CASE #{report.reportId}</span>
              <StatusBadge status={report.status} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {report.category?.categoryName}
              {report.categoryCustom ? ` (${report.categoryCustom})` : ''}
            </h1>
          </div>
        </div>

        {/* Top Actions */}
        {['ASSIGNED', 'VISIT_SCHEDULED'].includes(report.status) && (
          <button
            type="button"
            onClick={() => setNotFoundConfirmOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl transition"
          >
            <HelpCircle className="w-4 h-4 mr-1.5 text-amber-600" /> Declare Not Found
          </button>
        )}
      </div>

      {/* Main Grid: Left Dossier / Right Candidates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Report info & marks (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-800">Claimant & Item Information</h2>

            {/* Student info */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">{report.student?.fullName}</span>
                <span className="font-mono text-brand-600 font-semibold">{report.student?.regNo}</span>
              </div>
              <span className="text-[11px] text-slate-400 block">{report.student?.email}</span>
            </div>

            {/* Description */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Student Stated Description
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">{report.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block font-semibold">Color</span>
                <span className="font-medium text-slate-700">{report.color || 'Unspecified'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Brand</span>
                <span className="font-medium text-slate-700">{report.brand || 'Unspecified'}</span>
              </div>
            </div>

            <div className="text-xs space-y-2 pt-2 border-t border-slate-100 text-slate-600">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                <span>Reported Room: <strong>{report.location ? `${report.location.block} - ${report.location.roomName}` : (report.locationText || 'Not specified')}</strong></span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-slate-400" />
                <span>
                  Lost Window: <strong>{dayjs(report.lostFrom).format('DD MMM, hh:mm A')}</strong> to{' '}
                  <strong>{dayjs(report.lostTo).format('DD MMM, hh:mm A')}</strong>
                </span>
              </div>
            </div>

            {/* Confidential Claimed Marks Box */}
            <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200/90 space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-800">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Confidential Claimed Marks
                </span>
              </div>
              <p className="text-xs text-amber-950 font-medium leading-relaxed italic bg-white/70 p-3 rounded-xl border border-amber-200/60">
                "{report.identifyingMarks}"
              </p>
              <p className="text-[10px] text-amber-700">
                Compare these exact marks with the physical item during the scheduled verification.
              </p>
            </div>

            {/* Student Uploaded Photos Section */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Student Uploaded Photo{report.images?.length > 1 ? 's' : ''}
                </span>
                {report.aiLabels ? (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    <span>AWS AI Tagged</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">No Photo Uploaded</span>
                )}
              </div>

              {report.images && report.images.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex gap-2.5 overflow-x-auto pb-1">
                    {report.images.map((img, idx) => (
                      <div
                        key={img.imageId || idx}
                        onClick={() => setPreviewImage(img.url)}
                        className="group relative w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-500 transition flex-shrink-0 shadow-sm"
                      >
                        <img src={img.url} alt="Student Reference" className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Maximize2 className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {report.aiLabels && (
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-800">Visual Labels:</span> {report.aiLabels}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                  Student did not provide a reference photo
                </div>
              )}
            </div>
          </div>

          {/* Pending Verifications */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800">Verification Visits</h2>
            {verifications.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No verification visits scheduled yet.</p>
            ) : (
              <div className="space-y-3">
                {verifications.map((v) => (
                  <div key={v.verificationId} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{v.venue}</span>
                      <StatusBadge status={v.outcome} size="sm" />
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Scheduled: {dayjs(v.scheduledAt).format('DD MMM YYYY, hh:mm A')}
                    </span>

                    {v.outcome === 'SCHEDULED' && (
                      <button
                        onClick={() => {
                          setOutcomeModalVerif(v);
                          setGeneratedLetter(null);
                          setMarksObserved('');
                        }}
                        className="mt-2 w-full py-1.5 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-sm transition"
                      >
                        Record Verification Outcome
                      </button>
                    )}

                    {v.handoverLetter && (
                      <button
                        onClick={() => downloadHandoverPdf(v.verificationId, v.handoverLetter.letterNo)}
                        className="mt-2 w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Letter ({v.handoverLetter.letterNo})
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Suggested Match Candidates (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Suggested Match Candidates</h2>
                <p className="text-xs text-slate-400">
                  Calculated based on location, time window proximity, trgm text similarity, and color.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {matches.length} Candidates
              </span>
            </div>

            {matches.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 italic">
                No matching candidate items found in inventory yet.
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((m) => {
                  const item = m.foundItem;
                  const scoreColor =
                    m.score >= 80 ? 'bg-emerald-500 text-emerald-700' :
                    m.score >= 50 ? 'bg-amber-500 text-amber-700' : 'bg-slate-400 text-slate-600';

                  return (
                    <div
                      key={m.matchId}
                      className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-brand-300 transition shadow-sm space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center space-x-3">
                          <div
                            onClick={() => item.images?.[0]?.url && setPreviewImage(item.images[0].url)}
                            className={`w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 ${item.images?.[0]?.url ? 'cursor-pointer hover:ring-2 hover:ring-brand-500 transition group relative' : ''}`}
                            title={item.images?.[0]?.url ? 'Click to view full photo' : ''}
                          >
                            {item.images?.[0]?.url ? (
                              <>
                                <img src={item.images[0].url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </div>
                              </>
                            ) : (
                              <Boxes className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                                {item.shelfCode}
                              </span>
                              <StatusBadge status={m.status} size="sm" />
                            </div>
                            <p className="text-xs font-semibold text-slate-800 mt-1">{item.description}</p>
                            <span className="text-[10px] text-slate-400 block">
                              Found in {item.roomName} on {dayjs(item.foundAt).format('DD MMM, hh:mm A')}
                            </span>
                          </div>
                        </div>

                        {/* Match Score Badge */}
                        <div className="text-right flex-shrink-0">
                          <span className="text-lg font-extrabold text-slate-800 block">
                            {m.score}%
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                            Match Score
                          </span>
                        </div>
                      </div>

                      {/* Score Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            m.score >= 80 ? 'bg-emerald-500' : m.score >= 50 ? 'bg-amber-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${m.score}%` }}
                        />
                      </div>

                      {/* Factor Breakdown Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                          Factors:
                        </span>

                        {/* Category */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Category: {report?.category?.categoryName || 'Spectacles'}</span>
                        </span>

                        {/* Color */}
                        {item.color && report?.color && (
                          item.color.toLowerCase() === report.color.toLowerCase() ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Color: {item.color} (+5 pts)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-slate-50 text-slate-500 border border-slate-200">
                              <X className="w-3 h-3 text-slate-400" />
                              <span>Color: {item.color} vs {report.color}</span>
                            </span>
                          )
                        )}

                        {/* Brand */}
                        {item.brand && report?.brand && (
                          item.brand.toLowerCase() === report.brand.toLowerCase() ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Brand: {item.brand} matched</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-amber-50/70 text-amber-700 border border-amber-200/60">
                              <X className="w-3 h-3 text-amber-500" />
                              <span>Brand: {item.brand} (claimed: {report.brand})</span>
                            </span>
                          )
                        )}

                        {/* Location / Room */}
                        {item.roomName && (report?.roomName || report?.locationText) && (
                          (item.roomName.toLowerCase().includes((report.roomName || report.locationText).toLowerCase()) ||
                           (report.roomName || report.locationText).toLowerCase().includes(item.roomName.toLowerCase())) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Room: {item.roomName} (+20 pts)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-slate-50 text-slate-500 border border-slate-200">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>Room: {item.roomName} (lost: {report.roomName || report.locationText})</span>
                            </span>
                          )
                        )}

                        {/* Time */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>Turnover: {dayjs(item.foundAt).format('DD MMM, hh:mm A')} (+10 pts)</span>
                        </span>

                        {/* Visual AI Badge */}
                        {item.aiLabels && report?.aiLabels ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-purple-50 text-purple-700 border border-purple-200/80">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>Visual AI: Matched (+35 pts)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-slate-50 text-slate-500 border border-slate-200">
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                            <span>Visual AI: No image tags (shifted to text)</span>
                          </span>
                        )}
                      </div>

                      {/* Match Actions */}
                      {!['CONFIRMED', 'FAILED'].includes(m.status) && (
                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 text-xs">
                          {/* Compare Photos Button */}
                          {(report?.images?.length > 0 || item.images?.length > 0) && (
                            <button
                              type="button"
                              onClick={() => setComparisonModal({
                                studentImg: report?.images?.[0]?.url,
                                staffImg: item.images?.[0]?.url,
                                shelfCode: item.shelfCode,
                                description: item.description,
                                marks: report?.identifyingMarks,
                                studentAi: report?.aiLabels,
                                staffAi: item.aiLabels
                              })}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold transition inline-flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>Compare Photos</span>
                            </button>
                          )}

                          {m.status === 'SUGGESTED' && (
                            <button
                              onClick={() => matchStatusMutation.mutate({ matchId: m.matchId, status: 'SHORTLISTED' })}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-violet-50 hover:text-violet-700 text-slate-600 font-semibold transition"
                            >
                              Shortlist
                            </button>
                          )}

                          {m.status !== 'DISMISSED' && (
                            <button
                              onClick={() => matchStatusMutation.mutate({ matchId: m.matchId, status: 'DISMISSED' })}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 font-semibold transition"
                            >
                              Dismiss
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setScheduleModalMatch(m);
                              setScheduledAt(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
                            }}
                            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-sm transition"
                          >
                            Schedule Visit
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Escalation History Log */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-slate-800">Escalation Log</h2>
            <div className="divide-y divide-slate-100 text-xs">
              {escalationHistory.map((e) => (
                <div key={e.assignmentId} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">Level {e.level} ({e.designation})</span>
                    <span className="text-slate-500 block">{e.assigneeName}</span>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={e.status} size="sm" />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Due: {dayjs(e.dueAt).format('DD MMM, hh:mm A')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Verification Modal */}
      {scheduleModalMatch && (
        <Modal
          isOpen={!!scheduleModalMatch}
          onClose={() => setScheduleModalMatch(null)}
          title={`Schedule Verification: Shelf ${scheduleModalMatch.foundItem.shelfCode}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scheduleMutation.mutate({
                matchId: scheduleModalMatch.matchId,
                scheduledAt: new Date(scheduledAt).toISOString(),
                venue
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Appointment Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Meeting Venue / Room *</label>
              <input
                type="text"
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. SJT G03"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setScheduleModalMatch(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={scheduleMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-sm transition"
              >
                {scheduleMutation.isPending ? 'Scheduling...' : 'Confirm Appointment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Outcome Modal */}
      {outcomeModalVerif && (
        <Modal
          isOpen={!!outcomeModalVerif}
          onClose={() => setOutcomeModalVerif(null)}
          title="Record Verification Outcome"
        >
          {generatedLetter ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Handover Completed & Letter Issued!</h4>
                <p className="text-xs text-slate-500 font-mono mt-1">Letter #{generatedLetter.letterNo}</p>
              </div>
              <button
                onClick={() => downloadHandoverPdf(outcomeModalVerif.verificationId, generatedLetter.letterNo)}
                className="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                <Download className="w-4 h-4 mr-2" /> Download Official Letter PDF
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                outcomeMutation.mutate({ outcome, marksObserved, remarks });
              }}
              className="space-y-4"
            >
              {/* Claimed Marks Reference */}
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-0.5">Student's Claimed Marks:</span>
                <p className="text-amber-800 italic">"{report.identifyingMarks}"</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Marks Observed by You on the Physical Item *
                </label>
                <textarea
                  rows={2}
                  required
                  value={marksObserved}
                  onChange={(e) => setMarksObserved(e.target.value)}
                  placeholder="Describe exact stickers, engravings, or verified match marks..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Outcome *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutcome('VERIFIED')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      outcome === 'VERIFIED'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-1 ring-emerald-400'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    VERIFIED
                  </button>

                  <button
                    type="button"
                    onClick={() => setOutcome('FAILED')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      outcome === 'FAILED'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 ring-1 ring-rose-400'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    FAILED
                  </button>

                  <button
                    type="button"
                    onClick={() => setOutcome('NO_SHOW')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      outcome === 'NO_SHOW'
                        ? 'bg-amber-50 border-amber-400 text-amber-800 ring-1 ring-amber-400'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    NO_SHOW
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Additional Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional verifier notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOutcomeModalVerif(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={outcomeMutation.isPending || !marksObserved}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                >
                  {outcomeMutation.isPending ? 'Recording...' : 'Submit Verification Result'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Confirm Declare Not Found Dialog */}
      <ConfirmDialog
        isOpen={notFoundConfirmOpen}
        onClose={() => setNotFoundConfirmOpen(false)}
        onConfirm={() => notFoundMutation.mutate()}
        loading={notFoundMutation.isPending}
        title="Declare Case Not Found?"
        message="This action will dismiss current suggested matches, close active review assignments, and direct the student to visit SJT G03 in person within 7 days."
        confirmText="Confirm Not Found"
        isDestructive={false}
      />

      {/* Full Photo Preview Modal */}
      {previewImage && (
        <Modal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          title="Item Photo Preview"
          size="lg"
        >
          <div className="flex flex-col items-center justify-center p-2">
            <img
              src={previewImage}
              alt="Item Preview"
              className="max-h-[70vh] w-auto rounded-2xl object-contain shadow-md"
            />
          </div>
        </Modal>
      )}

      {/* Side-by-Side Visual Comparison Modal */}
      {comparisonModal && (
        <Modal
          isOpen={!!comparisonModal}
          onClose={() => setComparisonModal(null)}
          title={`Visual Comparison: Claim vs Shelf ${comparisonModal.shelfCode}`}
          size="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Student Claim */}
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Student Claimed Reference
                </span>
                <div className="w-full h-64 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                  {comparisonModal.studentImg ? (
                    <img
                      src={comparisonModal.studentImg}
                      alt="Student Claimed Item"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-xs text-slate-400 p-4">
                      No reference photo submitted by student
                    </div>
                  )}
                </div>
                {comparisonModal.studentAi && (
                  <p className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-200">
                    <span className="font-bold">AI Labels:</span> {comparisonModal.studentAi}
                  </p>
                )}
              </div>

              {/* Right: Staff Logged Item */}
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Physical Item ({comparisonModal.shelfCode})
                  </span>
                  <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                    {comparisonModal.shelfCode}
                  </span>
                </div>
                <div className="w-full h-64 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                  {comparisonModal.staffImg ? (
                    <img
                      src={comparisonModal.staffImg}
                      alt="Physical Found Item"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-xs text-slate-400 p-4">
                      No staff photos attached
                    </div>
                  )}
                </div>
                {comparisonModal.staffAi && (
                  <p className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-200">
                    <span className="font-bold">AI Labels:</span> {comparisonModal.staffAi}
                  </p>
                )}
              </div>
            </div>

            {/* Confidential Claimed Marks Check */}
            {comparisonModal.marks && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Confidential Claimed Marks to Verify:</span>
                </div>
                <p className="italic text-amber-950 font-medium pl-5.5">
                  "{comparisonModal.marks}"
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
