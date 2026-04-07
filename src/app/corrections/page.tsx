'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
    AlertCircle, CheckCircle2, Clock, ClipboardList, 
    RefreshCw, Search, Calendar, User, Trash2 
} from 'lucide-react';
import Loader from '@/components/ui/Loader';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Correction {
    id: string;
    project_name: string;
    submitter_name: string;
    correction_text: string;
    is_completed: boolean;
    created_at: string;
    completed_at: string | null;
}

interface ProjectGroup {
    projectName: string;
    open: Correction[];
    completed: Correction[];
}

export default function CorrectionsPage() {
    const [corrections, setCorrections] = useState<Correction[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchCorrections = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/project-corrections');
            const data = await res.json();
            setCorrections(data.corrections || []);
        } catch (err) {
            console.error('Error fetching corrections:', err);
            toast.error('Failed to load corrections');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCorrections();
    }, [fetchCorrections]);

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        setUpdatingId(id);
        try {
            const res = await fetch('/api/project-corrections', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_completed: !currentStatus }),
            });
            if (res.ok) {
                const updated = await res.json();
                setCorrections(prev => prev.map(c => c.id === id ? updated.correction : c));
                toast.success(currentStatus ? 'Marked as pending' : 'Marked as completed');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            toast.error('Update failed');
        } finally {
            setUpdatingId(null);
        }
    };

    const deleteCorrection = async (id: string) => {
        if (!confirm('Are you sure you want to delete this correction?')) return;
        try {
            const res = await fetch(`/api/project-corrections?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setCorrections(prev => prev.filter(c => c.id !== id));
                toast.success('Correction deleted');
            }
        } catch (err) {
            console.error('Error deleting:', err);
            toast.error('Delete failed');
        }
    };

    // Group by project
    const projectGroups: ProjectGroup[] = [];
    const groups: Record<string, { open: Correction[], completed: Correction[] }> = {};

    corrections.forEach(c => {
        if (!groups[c.project_name]) {
            groups[c.project_name] = { open: [], completed: [] };
        }
        if (c.is_completed) {
            groups[c.project_name].completed.push(c);
        } else {
            groups[c.project_name].open.push(c);
        }
    });

    Object.entries(groups).forEach(([name, data]) => {
        if (name.toLowerCase().includes(search.toLowerCase())) {
            projectGroups.push({ projectName: name, ...data });
        }
    });

    // Sort project groups alphabetically
    projectGroups.sort((a, b) => a.projectName.localeCompare(b.projectName));

    return (
        <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <AlertCircle className="text-amber-500" size={32} />
                        Project Corrections
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Manage and track corrections across projects.
                    </p>
                </div>
                <button
                    onClick={fetchCorrections}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Stats Overview */}
            {!loading && corrections.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Corrections</p>
                        <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{corrections.length}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</p>
                        <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                             {corrections.filter(c => !c.is_completed).length}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Completed</p>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                            {corrections.filter(c => c.is_completed).length}
                        </p>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-100 transition-all"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-24">
                        <Loader size="lg" />
                    </div>
                ) : projectGroups.length === 0 ? (
                    <div className="py-24 text-center text-slate-400">
                        <ClipboardList size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-lg font-medium">
                            {search ? 'No matching projects found.' : 'No corrections have been added yet.'}
                        </p>
                        <p className="text-sm mt-1">Add corrections from the Task edit form.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">Project</th>
                                <th className="px-6 py-4 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider w-1/3">Pending Corrections</th>
                                <th className="px-6 py-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider w-5/12">Completed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {projectGroups.map(group => (
                                <tr key={group.projectName} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                    <td className="px-6 py-4 align-top">
                                        <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{group.projectName}</div>
                                        <div className="text-xs text-slate-400 mt-1">{group.open.length + group.completed.length} total corrections</div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="space-y-3">
                                            {group.open.length === 0 ? (
                                                <span className="text-slate-400 italic text-xs">No pending corrections</span>
                                            ) : (
                                                group.open.map(c => (
                                                    <div key={c.id} className="flex items-start gap-3 group animate-in fade-in slide-in-from-left-2 duration-300">
                                                        <button 
                                                            onClick={() => toggleStatus(c.id, false)}
                                                            disabled={updatingId === c.id}
                                                            className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                                                updatingId === c.id ? 'opacity-50' : 'hover:border-amber-500'
                                                            } border-slate-300 dark:border-slate-600`}
                                                        >
                                                            {updatingId === c.id && <RefreshCw size={10} className="animate-spin text-amber-500" />}
                                                        </button>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-slate-700 dark:text-slate-300 font-medium break-words">{c.correction_text}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 flex items-center gap-1">
                                                                    <User size={10} /> {c.submitter_name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                    <Calendar size={10} /> {format(new Date(c.created_at), 'MMM d, HH:mm')}
                                                                </span>
                                                                <button onClick={() => deleteCorrection(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500">
                                                                    <Trash2 size={10} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="space-y-4">
                                            {group.completed.length === 0 ? (
                                                <span className="text-slate-400 italic text-xs">None completed yet</span>
                                            ) : (
                                                group.completed.map(c => (
                                                    <div key={c.id} className="flex items-start gap-3 p-3 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20 group">
                                                        <CheckCircle2 className="mt-0.5 text-emerald-500 flex-shrink-0" size={16} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-slate-500 dark:text-slate-400 line-through decoration-emerald-500/50 break-words">{c.correction_text}</p>
                                                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-100/30 dark:border-emerald-900/20">
                                                                <div>
                                                                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Added</span>
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{format(new Date(c.created_at), 'MMM d, yyyy')}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] uppercase font-bold text-emerald-500 block">Completed</span>
                                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{c.completed_at ? format(new Date(c.completed_at), 'MMM d, yyyy') : 'Recently'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => deleteCorrection(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
