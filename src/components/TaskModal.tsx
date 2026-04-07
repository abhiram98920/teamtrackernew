'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Calendar, User, Briefcase, Activity, Layers, Plus, CheckCircle2 } from 'lucide-react';
import { Task, isValidProjectDate } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Combobox from './ui/Combobox';
import Checkbox from './ui/Checkbox';
import { getHubstaffNameFromQA } from '@/lib/hubstaff-name-mapping';
import { useGuestMode } from '@/contexts/GuestContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmationModal from './ConfirmationModal';
import { format } from 'date-fns';
import { DatePicker } from './DatePicker';
import { Button } from './ui/button';
import Loader from './ui/Loader';
import CloseButton from './ui/CloseButton';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task?: Task | null;
    onSave: (task: Partial<Task> | Partial<Task>[]) => Promise<void>;
    onDelete?: (taskId: number) => Promise<void>;
}

type AssigneeData = {
    name: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
    includeSaturday: boolean;
    includeSunday: boolean;
    actualCompletionDate: string | null;
};

const initialState: Partial<Task> = {
    // Global fields
    projectName: '',
    projectType: '',
    subPhase: '',
    priority: 'Medium',
    pc: '',
    bugCount: 0,
    htmlBugs: 0,
    functionalBugs: 0,
    deviationReason: '',
    comments: '',
    currentUpdates: '',
    sprintLink: '',
    daysAllotted: 0,
    timeTaken: '00:00:00',
    daysTaken: 0,
    deviation: 0,
    activityPercentage: 0,
    teamId: '',
};

export default function TaskModal({ isOpen, onClose, task, onSave, onDelete }: TaskModalProps) {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<{ id: string | number; label: string }[]>([]);
    const [isFetchingProjects, setIsFetchingProjects] = useState(false);
    const [hubstaffUsers, setHubstaffUsers] = useState<{ id: string; label: string }[]>([]);
    const [loadingHubstaffUsers, setLoadingHubstaffUsers] = useState(false);
    const [isQATeam, setIsQATeam] = useState(false);
    const [subPhases, setSubPhases] = useState<{ id: string; label: string }[]>([]);
    const [loadingSubPhases, setLoadingSubPhases] = useState(false);
    const [globalPCs, setGlobalPCs] = useState<{ id: string; label: string }[]>([]);
    const [loadingPCs, setLoadingPCs] = useState(false);
    const { isGuest, selectedTeamId } = useGuestMode();
    const [userTeamId, setUserTeamId] = useState<string | null>(null);
    const { error: toastError } = useToast();
    const [showEndDateWarning, setShowEndDateWarning] = useState(false);
    const [showCloseWarning, setShowCloseWarning] = useState(false);
    const [formData, setFormData] = useState<Partial<Task>>(initialState);

    // Checklist state
    const [projectChecklists, setProjectChecklists] = useState<{ id: string; title: string }[]>([]);
    const [checklistStatus, setChecklistStatus] = useState<Record<string, boolean>>({});
    const [savingChecklist, setSavingChecklist] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);

    // Default structure for a new assignee
    const defaultAssignee: AssigneeData = {
        name: null,
        startDate: null,
        endDate: null,
        status: 'Yet to Start',
        includeSaturday: false,
        includeSunday: false,
        actualCompletionDate: null
    };

    const [assignees, setAssignees] = useState<AssigneeData[]>([defaultAssignee]);

    // Correction state
    const [showCorrections, setShowCorrections] = useState(false);
    const [correctorName, setCorrectorName] = useState('');
    const [newCorrections, setNewCorrections] = useState<string[]>(['']);

    // Fetch Team ID
    useEffect(() => {
        const fetchTeam = async () => {
            const { getCurrentUserTeam } = await import('@/utils/userUtils');
            const team = await getCurrentUserTeam();
            if (team) setUserTeamId(team.team_id);
        };
        fetchTeam();
    }, []);

    const effectiveTeamId = isGuest ? selectedTeamId : userTeamId;
    console.log('[TaskModal] useEffect Debug:', { isGuest, selectedTeamId, userTeamId, effectiveTeamId });

    // Fetch Projects
    useEffect(() => {
        const fetchProjects = async () => {
            setIsFetchingProjects(true);
            try {
                let url = '/api/projects';
                if (effectiveTeamId) {
                    url += `?team_id=${effectiveTeamId}`;
                }
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.projects) {
                        setProjects(data.projects.map((p: any) => ({ id: p.id, label: p.name })));
                    }
                }
            } catch (error) {
                console.error('[TaskModal] Error fetching projects:', error);
            } finally {
                setIsFetchingProjects(false);
            }
        };
        if (isOpen) fetchProjects();
    }, [isOpen, effectiveTeamId]);

    // Fetch Users
    useEffect(() => {
        const fetchUsers = async () => {
            setLoadingHubstaffUsers(true);
            try {
                // QA Team (Super Admin View) or No Team Context -> Fetch All Hubstaff Users
                // QA Team ID: ba60298b-8635-4cca-bcd5-7e470fad60e6
                const isQATeamContext = effectiveTeamId === 'ba60298b-8635-4cca-bcd5-7e470fad60e6';

                if (isQATeamContext || !effectiveTeamId) {
                    const response = await fetch('/api/hubstaff/users');
                    if (response.ok) {
                        const data = await response.json();
                        const members = data.members?.map((u: any) => ({ id: u.name, label: u.name })) || [];
                        setHubstaffUsers(members);
                    }
                } else {
                    // Specific Team Context -> Fetch only team members
                    // Fallback to all users if team members are empty (Safety net for Manager Mode)
                    const { data: teamMembers, error } = await supabase
                        .from('team_members')
                        .select('name')
                        .eq('team_id', effectiveTeamId);

                    if (error) {
                        console.error('[TaskModal] Error fetching team members:', error);
                    }

                    if (teamMembers && teamMembers.length > 0) {
                        setHubstaffUsers(teamMembers.map(m => ({ id: m.name, label: m.name })));
                    } else {
                        // FALLBACK: If no team members found, fetch all Hubstaff users to avoid empty dropdown
                        console.warn('[TaskModal] No team members found for ID:', effectiveTeamId, 'Falling back to all users.');
                        const response = await fetch('/api/hubstaff/users');
                        if (response.ok) {
                            const data = await response.json();
                            const members = data.members?.map((u: any) => ({ id: u.name, label: u.name })) || [];
                            setHubstaffUsers(members);
                        }
                    }
                }
            } catch (error) {
                console.error('[TaskModal] Error fetching users:', error);
            } finally {
                setLoadingHubstaffUsers(false);
            }
        };
        if (isOpen) fetchUsers();
    }, [isOpen, effectiveTeamId]);

    // Fetch PCs
    useEffect(() => {
        const fetchPCs = async () => {
            setLoadingPCs(true);
            try {
                const response = await fetch('/api/pcs');
                if (response.ok) {
                    const data = await response.json();
                    if (data.pcs) {
                        setGlobalPCs(data.pcs.map((pc: any) => ({ id: pc.name, label: pc.name })));
                    }
                }
            } catch (error) {
                console.error('[TaskModal] Error fetching PCs:', error);
            } finally {
                setLoadingPCs(false);
            }
        };
        if (isOpen) fetchPCs();
    }, [isOpen]);

    // Fetch Subphases
    useEffect(() => {
        const fetchSubPhases = async () => {
            if (!effectiveTeamId) return;
            setLoadingSubPhases(true);
            try {
                const response = await fetch(`/api/subphases?team_id=${effectiveTeamId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.subphases) {
                        setSubPhases(data.subphases.map((sp: any) => ({ id: sp.name, label: sp.name })));
                    }
                }
            } catch (error) {
                console.error('[TaskModal] Error fetching sub-phases:', error);
            } finally {
                setLoadingSubPhases(false);
            }
        };
        if (isOpen) fetchSubPhases();
    }, [isOpen, effectiveTeamId]);

    // Check Role
    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('user_profiles').select('role, full_name').eq('id', user.id).single();
                setIsQATeam(profile?.role === 'super_admin');
                setCurrentUserName(profile?.full_name || user.email || null);
                if (!correctorName) setCorrectorName(profile?.full_name || '');
            }
        };
        if (isOpen) checkRole();
    }, [isOpen]);

    // Fetch checklists for a project whenever projectName changes
    useEffect(() => {
        const fetchProjectChecklists = async () => {
            const name = formData.projectName;
            if (!name || !isOpen) {
                setProjectChecklists([]);
                setChecklistStatus({});
                return;
            }
            try {
                const [assignRes, statusRes] = await Promise.all([
                    fetch(`/api/project-checklists?project_name=${encodeURIComponent(name)}`),
                    fetch(`/api/checklist-status?project_name=${encodeURIComponent(name)}`),
                ]);
                const assignData = await assignRes.json();
                const statusData = await statusRes.json();

                const items = (assignData.assignments || []).map((a: any) => ({
                    id: a.checklist_id,
                    title: a.checklist?.title || '',
                }));
                setProjectChecklists(items);

                const statusMap: Record<string, boolean> = {};
                for (const s of (statusData.statuses || [])) {
                    statusMap[s.checklist_id] = s.is_checked;
                }
                setChecklistStatus(statusMap);
            } catch (err) {
                console.error('[TaskModal] Error fetching project checklists:', err);
            }
        };
        fetchProjectChecklists();
    }, [formData.projectName, isOpen]);

    // Initialize Form Data
    useEffect(() => {
        if (isOpen && task) {
            setFormData({
                projectName: task.projectName,
                projectType: task.projectType,
                subPhase: task.subPhase,
                priority: task.priority,
                pc: task.pc,
                // Global fields only
                bugCount: task.bugCount,
                htmlBugs: task.htmlBugs,
                functionalBugs: task.functionalBugs,
                deviationReason: task.deviationReason,
                comments: task.comments,
                currentUpdates: task.currentUpdates,
                sprintLink: task.sprintLink,
                daysAllotted: task.daysAllotted || 0,
                timeTaken: task.timeTaken || '00:00:00',
                daysTaken: task.daysTaken || 0,
                deviation: task.deviation || 0,
                activityPercentage: task.activityPercentage || 0,
                teamId: task.teamId
            });

            const initialAssignees: AssigneeData[] = [
                {
                    name: task.assignedTo,
                    startDate: task.startDate || null,
                    endDate: task.endDate || null,
                    status: task.status,
                    includeSaturday: task.includeSaturday || false,
                    includeSunday: task.includeSunday || false,
                    actualCompletionDate: task.actualCompletionDate ? new Date(task.actualCompletionDate).toISOString().split('T')[0] : null
                },
                {
                    name: task.assignedTo2,
                    startDate: task.startDate || null,
                    endDate: task.endDate || null,
                    status: task.status,
                    includeSaturday: task.includeSaturday || false,
                    includeSunday: task.includeSunday || false,
                    actualCompletionDate: task.actualCompletionDate ? new Date(task.actualCompletionDate).toISOString().split('T')[0] : null
                },
                ...(task.additionalAssignees || []).map(a => ({
                    name: a,
                    startDate: task.startDate || null,
                    endDate: task.endDate || null,
                    status: task.status,
                    includeSaturday: task.includeSaturday || false,
                    includeSunday: task.includeSunday || false,
                    actualCompletionDate: task.actualCompletionDate ? new Date(task.actualCompletionDate).toISOString().split('T')[0] : null
                }))
            ].filter(a => a.name).map(a => ({
                ...a,
                name: getHubstaffNameFromQA(a.name!) || a.name
            })) as AssigneeData[];

            if (initialAssignees.length === 0) setAssignees([defaultAssignee]);
            else setAssignees(initialAssignees);

        } else if (isOpen && !task) {
            setFormData(initialState);
            setAssignees([defaultAssignee]);
        }
        if (isOpen) {
            setShowCorrections(false);
            setNewCorrections(['']);
        }
    }, [isOpen, task]);



    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            // Auto-calc logic
            if (name === 'timeTaken' || name === 'daysAllotted') {
                const timeStr = name === 'timeTaken' ? value : (newData.timeTaken || '00:00:00');
                const daysAllottedStr = name === 'daysAllotted' ? value : (newData.daysAllotted || 0);
                const [hours, minutes, seconds] = (timeStr as string).split(':').map(Number);
                const totalHours = (hours || 0) + (minutes || 0) / 60 + (seconds || 0) / 3600;
                const daysTakenVal = parseFloat((totalHours / 8).toFixed(2));
                const deviationVal = parseFloat((daysTakenVal - Number(daysAllottedStr)).toFixed(2));
                newData.daysTaken = daysTakenVal;
                newData.deviation = deviationVal;
            }
            return newData;
        });
    };

    const handleDynamicAssigneeChange = (index: number, field: keyof AssigneeData, value: any) => {
        const newAssignees = [...assignees];
        newAssignees[index] = { ...newAssignees[index], [field]: value };

        // Auto-set actualCompletionDate if status becomes 'Completed'
        if (field === 'status' && value === 'Completed' && !newAssignees[index].actualCompletionDate) {
            newAssignees[index].actualCompletionDate = new Date().toISOString().split('T')[0];
        }

        setAssignees(newAssignees);
    };

    const addAssignee = () => {
        setAssignees([...assignees, { ...defaultAssignee }]);
    };

    const removeAssignee = (index: number) => {
        const newAssignees = assignees.filter((_, i) => i !== index);
        setAssignees(newAssignees.length ? newAssignees : [{ ...defaultAssignee }]);
    };

    const executeSave = async () => {
        setLoading(true);
        try {
            let teamId = task?.teamId || effectiveTeamId;
            if (!teamId) {
                const { getCurrentUserTeam } = await import('@/utils/userUtils');
                const userTeam = await getCurrentUserTeam();
                if (userTeam) teamId = userTeam.team_id;
            }
            if (!teamId) {
                toastError('Error: Could not determine Team ID.');
                setLoading(false);
                setShowEndDateWarning(false);
                return;
            }

            const validAssignees = assignees.filter(a => !!a.name);
            if (validAssignees.length === 0) {
                validAssignees.push({ ...defaultAssignee });
            }

            // Common data for all tasks
            // Common data for all tasks
            const sharedData = {
                projectName: formData.projectName,
                projectType: formData.projectType,
                subPhase: formData.subPhase,
                priority: formData.priority,
                pc: formData.pc,
                bugCount: formData.bugCount,
                htmlBugs: formData.htmlBugs,
                functionalBugs: formData.functionalBugs,
                deviationReason: formData.deviationReason,
                comments: formData.comments,
                currentUpdates: formData.currentUpdates,
                sprintLink: formData.sprintLink,
                daysAllotted: formData.daysAllotted,
                timeTaken: formData.timeTaken,
                daysTaken: formData.daysTaken,
                deviation: formData.deviation,
                activityPercentage: formData.activityPercentage,
                teamId
            };

            const payloads: any[] = [];

            // If editing an existing task, the first assignee updates the main task
            // Subsequent assignees create new tasks
            if (task) {
                const first = validAssignees[0];
                const mainTaskPayload = {
                    ...sharedData,
                    assignedTo: first?.name || null,
                    assignedTo2: null,
                    additionalAssignees: [],
                    startDate: first?.startDate || null,
                    endDate: first?.endDate || null,
                    status: first?.status || 'Yet to Start',
                    includeSaturday: first?.includeSaturday || false,
                    includeSunday: first?.includeSunday || false,
                    actualCompletionDate: first?.actualCompletionDate || null,
                };
                payloads.push(mainTaskPayload);

                for (let i = 1; i < validAssignees.length; i++) {
                    const assignee = validAssignees[i];
                    payloads.push({
                        ...sharedData,
                        id: undefined, // Ensure new ID
                        assignedTo: assignee.name,
                        assignedTo2: null,
                        additionalAssignees: [],
                        startDate: assignee.startDate || null,
                        endDate: assignee.endDate || null,
                        status: assignee.status || 'Yet to Start',
                        includeSaturday: assignee.includeSaturday || false,
                        includeSunday: assignee.includeSunday || false,
                        actualCompletionDate: assignee.actualCompletionDate || null,
                    });
                }
            } else {
                // Creating new tasks
                validAssignees.forEach(assignee => {
                    payloads.push({
                        ...sharedData,
                        assignedTo: assignee.name,
                        assignedTo2: null,
                        additionalAssignees: [],
                        startDate: assignee.startDate || null,
                        endDate: assignee.endDate || null,
                        status: assignee.status || 'Yet to Start',
                        includeSaturday: assignee.includeSaturday || false,
                        includeSunday: assignee.includeSunday || false,
                        actualCompletionDate: assignee.actualCompletionDate || null,
                    });
                });
            }

            // Save corrections if any
            if (showCorrections && correctorName && newCorrections.some(c => c.trim())) {
                const correctionsToSave = newCorrections.filter(c => c.trim());
                await Promise.all(correctionsToSave.map(text => 
                    fetch('/api/project-corrections', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            project_name: formData.projectName,
                            submitter_name: correctorName,
                            correction_text: text
                        }),
                    })
                ));
            }

            await onSave(payloads as any);

            const isUpdate = !!task;
            toast.custom((t) => (
                <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l-4 border-emerald-500 rounded-lg shadow-lg p-4 flex items-start gap-4 animate-in slide-in-from-right-5 duration-300">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full flex-shrink-0">
                        <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={20} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                            {isUpdate ? 'Task Updated Successfully' : (payloads.length > 1 ? `${payloads.length} Tasks Created` : 'Task Created Successfully')}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{formData.projectName}</p>
                    </div>
                    <button onClick={() => toast.dismiss(t)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={18} />
                    </button>
                </div>
            ), { duration: 4000 });

            if (!task) {
                setFormData(initialState);
                setAssignees([{ ...defaultAssignee }]);
            }
            setShowEndDateWarning(false);
        } catch (error) {
            console.error('Error saving task:', error);
            toastError('Failed to save task.');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseAttempt = () => {
        if (formData.projectName || formData.comments || assignees[0].name || task) {
            setShowCloseWarning(true);
        } else {
            onClose();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const hasMissingEndDate = assignees.some(a => a.startDate && !a.endDate);
        if (hasMissingEndDate && !showEndDateWarning) {
            setShowEndDateWarning(true);
            return;
        }
        await executeSave();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <ConfirmationModal
                isOpen={showEndDateWarning}
                onClose={() => setShowEndDateWarning(false)}
                onConfirm={executeSave}
                title="End date missing"
                message="One or more assignees have a start date but no end date. They won't appear on the Schedule."
                confirmText="Continue Anyway"
                cancelText="Go Back"
                type="warning"
                isLoading={loading}
            />
            <ConfirmationModal
                isOpen={showCloseWarning}
                onClose={() => setShowCloseWarning(false)}
                onConfirm={() => {
                    setShowCloseWarning(false);
                    onClose();
                }}
                title="Discard Unsaved Changes?"
                message="Are you sure you want to close without saving? Any unsaved progress will be lost."
                confirmText="Yes, Discard"
                cancelText="Keep Editing"
                type="danger"
            />


            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90dvh] overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                {/* Header */}
                <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10 flex items-center justify-between p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${task ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'} shadow-sm`}>
                            {task ? <Activity size={24} /> : <Briefcase size={24} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{task ? 'Edit Task' : 'New Project Task'}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{task ? 'Update task details' : 'Kickoff a new project'}</p>
                        </div>
                    </div>
                    <CloseButton onClick={handleCloseAttempt} />
                </div>

                <form onSubmit={handleSubmit} className="p-4 pb-10 md:p-6 space-y-8">
                    {/* Project & Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Briefcase size={16} className="text-indigo-500" /> <span>Project Name</span> <span className="text-red-500">*</span>
                            </label>
                            <Combobox
                                options={projects}
                                value={projects.find(p => p.label === formData.projectName)?.id || formData.projectName}
                                onChange={(val) => {
                                    const selected = projects.find(p => p.id == val);
                                    setFormData(prev => ({ ...prev, projectName: selected ? selected.label : (val ? String(val) : null!) }));
                                }}
                                placeholder={isFetchingProjects ? "Loading..." : "Select Project..."}
                                searchPlaceholder="Search projects..."
                                allowCustomValue={true}
                                isLoading={isFetchingProjects}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Activity size={16} className="text-indigo-500" /> Project Type
                            </label>
                            <input type="text" name="projectType" value={formData.projectType || ''} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl outline-none" placeholder="e.g. Web Development" />
                        </div>
                    </div>

                    {/* Priority & PC */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Priority</label>
                            <Combobox
                                options={[{ id: 'Low', label: 'Low' }, { id: 'Medium', label: 'Medium' }, { id: 'High', label: 'High' }, { id: 'Urgent', label: 'Urgent' }]}
                                value={formData.priority || ''}
                                onChange={(val) => {
                                    // Ensure value is treated as string and state is updated
                                    const newPriority = val ? String(val) : null;
                                    console.log('[TaskModal] Setting Priority:', newPriority);
                                    setFormData(prev => ({ ...prev, priority: newPriority }));
                                }}
                                placeholder="Select priority..."
                                allowCustomValue={true}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><User size={16} className="text-indigo-500" /> PC</label>
                            <Combobox options={globalPCs} value={formData.pc || ''} onChange={(val) => setFormData(prev => ({ ...prev, pc: val ? String(val) : '' }))} placeholder="Select PC..." allowCustomValue={true} isLoading={loadingPCs} />
                        </div>
                    </div>

                    {/* Phase */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Layers size={16} className="text-indigo-500" /> Phase/Task</label>
                        <Combobox options={subPhases} value={formData.subPhase || ''} onChange={(val) => setFormData(prev => ({ ...prev, subPhase: val ? String(val) : '' }))} placeholder="Select phase..." allowCustomValue={true} isLoading={loadingSubPhases} />
                    </div>

                    {/* Project Checklists */}
                    {projectChecklists.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                Project Checklists
                                <span className="ml-auto text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    {projectChecklists.filter(c => checklistStatus[c.id]).length}/{projectChecklists.length} passed
                                </span>
                            </label>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                                {projectChecklists.map(item => {
                                    const isChecked = !!checklistStatus[item.id];
                                    const isSaving = savingChecklist === item.id;
                                    return (
                                        <label
                                            key={item.id}
                                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white dark:hover:bg-slate-800 rounded-xl ${
                                                isChecked ? 'opacity-70' : ''
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={async () => {
                                                    const newVal = !isChecked;
                                                    setSavingChecklist(item.id);
                                                    try {
                                                        await fetch('/api/checklist-status', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                project_name: formData.projectName,
                                                                checklist_id: item.id,
                                                                is_checked: newVal,
                                                                checked_by: currentUserName,
                                                            }),
                                                        });
                                                        setChecklistStatus(prev => ({ ...prev, [item.id]: newVal }));
                                                    } finally {
                                                        setSavingChecklist(null);
                                                    }
                                                }}
                                                className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                                    isChecked
                                                        ? 'bg-emerald-500 border-emerald-500'
                                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                                } ${isSaving ? 'opacity-50' : 'hover:border-emerald-400'}`}
                                            >
                                                {isChecked && (
                                                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </button>
                                            <span className={`text-sm flex-1 ${
                                                isChecked
                                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                                    : 'text-slate-700 dark:text-slate-300'
                                            }`}>
                                                {item.title}
                                            </span>
                                            {isSaving && (
                                                <svg className="animate-spin text-emerald-500" width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="30" />
                                                </svg>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Dynamic Assignees - REDESIGNED */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <User size={16} className="text-indigo-500" /> <span>Assignees & Details</span>
                            </label>
                            <button type="button" onClick={addAssignee} className="text-sm font-semibold text-indigo-600 flex items-center gap-2 px-2 py-1 hover:bg-indigo-50 rounded-lg">
                                <Plus size={16} /> <span>Add Assignee</span>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {assignees.map((assignee, index) => (
                                <div key={index} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 relative group">
                                    {assignees.length > 1 && (
                                        <button type="button" onClick={() => removeAssignee(index)} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X size={16} />
                                        </button>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                        {/* Name & Status */}
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignee</label>
                                                <Combobox
                                                    options={hubstaffUsers}
                                                    value={assignee.name || ''}
                                                    onChange={(val) => handleDynamicAssigneeChange(index, 'name', val ? String(val) : null)}
                                                    placeholder="Select developer..."
                                                    searchPlaceholder="Search developers..."
                                                    allowCustomValue={true}
                                                    isLoading={loadingHubstaffUsers}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                                                <Combobox
                                                    options={['Yet to Start', 'Being Developed', 'Ready for QA', 'Assigned to QA', 'In Progress', 'On Hold', 'Completed', 'Forecast', 'Rejected'].map(s => ({ id: s, label: s }))}
                                                    value={assignee.status || 'Yet to Start'}
                                                    onChange={(val) => handleDynamicAssigneeChange(index, 'status', val ? String(val) : 'Yet to Start')}
                                                    placeholder="Select status..."
                                                />
                                            </div>
                                        </div>

                                        {/* Dates & Schedule */}
                                        <div className="space-y-4">
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <div className="flex-1 space-y-2 min-w-0">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</label>
                                                    <DatePicker
                                                        date={assignee.startDate ? new Date(assignee.startDate) : undefined}
                                                        setDate={(date) => {
                                                            const dateStr = date ? format(date, 'yyyy-MM-dd') : null;
                                                            handleDynamicAssigneeChange(index, 'startDate', dateStr);
                                                        }}
                                                        placeholder="Start"
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-2 min-w-0">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">End Date</label>
                                                    <DatePicker
                                                        date={assignee.endDate ? new Date(assignee.endDate) : undefined}
                                                        setDate={(date) => {
                                                            const dateStr = date ? format(date, 'yyyy-MM-dd') : null;
                                                            handleDynamicAssigneeChange(index, 'endDate', dateStr);
                                                        }}
                                                        placeholder="End"
                                                        align="end"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-end gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Weekend Work</label>
                                                    <div className="flex gap-4">
                                                        <Checkbox checked={assignee.includeSaturday} onChange={c => handleDynamicAssigneeChange(index, 'includeSaturday', c)} label="Sat" />
                                                        <Checkbox checked={assignee.includeSunday} onChange={c => handleDynamicAssigneeChange(index, 'includeSunday', c)} label="Sun" />
                                                    </div>
                                                </div>

                                                {assignee.status !== 'Rejected' && (
                                                    <div className="flex-1 min-w-[140px] space-y-2">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Achievement Date</label>
                                                        <DatePicker
                                                            date={assignee.actualCompletionDate ? new Date(assignee.actualCompletionDate) : undefined}
                                                            setDate={(date) => {
                                                                const dateStr = date ? format(date, 'yyyy-MM-dd') : null;
                                                                handleDynamicAssigneeChange(index, 'actualCompletionDate', dateStr);
                                                            }}
                                                            placeholder="Actual Completion"
                                                            align="end"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Comments */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Comments</label>
                        <textarea name="comments" value={formData.comments || ''} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none min-h-[100px]" />
                    </div>
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Updates</label>
                        <textarea name="currentUpdates" value={formData.currentUpdates || ''} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none min-h-[100px]" />
                    </div>

                    {/* Deviation & Sprint */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Deviation Reason</label>
                            <textarea name="deviationReason" value={formData.deviationReason || ''} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sprint Link</label>
                            <input type="text" name="sprintLink" value={formData.sprintLink || ''} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none" />
                        </div>
                    </div>

                    {/* Edit Mode Fields */}
                    {task && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Days Allotted</label>
                                <input type="number" name="daysAllotted" step="0.01" value={formData.daysAllotted || 0} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Time Taken</label>
                                <input type="text" name="timeTaken" value={formData.timeTaken || '00:00:00'} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Activity %</label>
                                <input type="number" name="activityPercentage" min="0" max="100" value={formData.activityPercentage || 0} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none" />
                            </div>
                        </div>
                    )}

                    {/* QA Fields */}
                    {isQATeam && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="space-y-3"> <label className="text-sm dark:text-slate-300">Total Bugs</label> <input type="number" name="bugCount" value={formData.bugCount || 0} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none" /> </div>
                            <div className="space-y-3"> <label className="text-sm dark:text-slate-300">HTML Bugs</label> <input type="number" name="htmlBugs" value={formData.htmlBugs || 0} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none" /> </div>
                            <div className="space-y-3"> <label className="text-sm dark:text-slate-300">Func. Bugs</label> <input type="number" name="functionalBugs" value={formData.functionalBugs || 0} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none" /> </div>
                        </div>
                    )}

                    {/* Correction Section */}
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-4">
                            <Checkbox 
                                checked={showCorrections} 
                                onChange={setShowCorrections} 
                                label={<span className="font-semibold text-slate-700 dark:text-slate-300">Add Corrections</span>} 
                            />
                        </div>

                        {showCorrections && (
                            <div className="space-y-4 bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-900/30 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Your Name</label>
                                    <input 
                                        type="text" 
                                        value={correctorName} 
                                        onChange={(e) => setCorrectorName(e.target.value)}
                                        className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none"
                                        placeholder="Enter your name..."
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Corrections</label>
                                    {newCorrections.map((text, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={text} 
                                                onChange={(e) => {
                                                    const updated = [...newCorrections];
                                                    updated[idx] = e.target.value;
                                                    setNewCorrections(updated);
                                                }}
                                                className="flex-1 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl outline-none"
                                                placeholder={`Correction #${idx + 1}`}
                                            />
                                            {idx === newCorrections.length - 1 ? (
                                                <button 
                                                    type="button" 
                                                    onClick={() => setNewCorrections([...newCorrections, ''])}
                                                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                                                >
                                                    <Plus size={20} />
                                                </button>
                                            ) : (
                                                <button 
                                                    type="button" 
                                                    onClick={() => setNewCorrections(newCorrections.filter((_, i) => i !== idx))}
                                                    className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={20} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="pt-6 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-8">
                        <button type="button" onClick={handleCloseAttempt} className="btn btn-secondary px-6 py-3 rounded-xl text-sm h-auto">Cancel</button>
                        {task && onDelete && (
                            <Button type="button" variant="destructive" onClick={async () => { if (confirm('Delete?')) { setLoading(true); await onDelete(task.id); setLoading(false); } }} className="btn btn-danger px-6 py-3 rounded-xl shadow-none h-auto">Delete</Button>
                        )}
                        <button type="submit" disabled={loading} className="btn btn-primary px-8 py-3 w-auto h-auto rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 text-sm active:scale-95 duration-200">
                            <span className="flex items-center justify-center gap-2"> <Save size={18} /> <span>{loading ? 'Saving...' : 'Save Task'}</span> </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
