'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ClipboardList,
    Calendar,
    BarChart3,
    Search,
    CalendarDays,
    CheckSquare,
    XSquare,
    Target,
    PlusCircle,
    UserSquare,
    Settings,
    ChevronDown,
    ChevronRight,
    Menu,
    X,
    Database,
    Shield,
    LogOut,
    TrendingUp,
    Eye,
    Folder,
    FolderKanban,
    Users,
    PauseCircle,
    Bug,
    Plane,
    ChevronLeft,
    Bell
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGuestMode } from '@/contexts/GuestContext';
import { useSidebar } from '@/contexts/SidebarContext';
import ManageTeamModal from './ManageTeamModal';
import { TeamSelector } from './TeamSelector';
import CloseButton from './ui/CloseButton';
import { ModeToggle } from './ModeToggle';
import NotificationBell from './NotificationBell';
import { useNotifications } from '@/contexts/NotificationContext';

interface NavItem {
    label: string;
    icon: React.ReactNode;
    href: string;
    badge?: number;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

export function Sidebar() {
    const pathname = usePathname();
    const { isGuest, selectedTeamName, setGuestSession, clearGuestSession, isPCMode, setPCModeSession } = useGuestMode();
    const { isCollapsed, setCollapsed, toggleSidebar } = useSidebar();

    // Hide sidebar on login and guest selection pages
    if (pathname === '/login' || pathname === '/guest') return null;

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        main: true,
        analytics: true,
        projects: true,
        requests: true,
        labels: true
    });

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const [userRole, setUserRole] = useState<string | null>(null);
    const [sidebarTitle, setSidebarTitle] = useState('Team Tracker');
    const [showManageTeam, setShowManageTeam] = useState(false);

    // Guest Mode Team Switcher State
    interface Team {
        id: string;
        name: string;
    }
    const [teams, setTeams] = useState<Team[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);

    useEffect(() => {
        // Fetch user role for sidebar visibility
        const fetchRole = async () => {
            // Dynamic import to avoid circular dependency if any (though usually fine here)
            const { supabase } = await import('@/lib/supabase');
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('user_profiles').select('role, team_id').eq('id', user.id).single();
                if (profile) {
                    setUserRole(profile.role);

                    if (profile.team_id) {
                        const { data: team } = await supabase.from('teams').select('name').eq('id', profile.team_id).single();
                        if (team && team.name !== 'QA Team') {
                            setSidebarTitle(team.name); // Use team name if not QA Team
                        }
                    }
                }
            }
        };
        fetchRole();
    }, []);

    // Fetch teams for Manager Mode dropdown
    useEffect(() => {
        if (isGuest) {
            const fetchTeams = async () => {
                setLoadingTeams(true);
                try {
                    const { data, error } = await supabase.from('teams').select('id, name').order('name');
                    if (error) throw error;
                    if (data) {
                        const filteredTeams = data.filter(team =>
                            !['cochin', 'dubai'].includes(team.name.toLowerCase())
                        );
                        setTeams(filteredTeams);
                    }
                } catch (error) {
                    console.error('Error fetching teams for sidebar:', error);
                } finally {
                    setLoadingTeams(false);
                }
            };
            fetchTeams();
        }
    }, [isGuest]);

    const navSections: Record<string, NavSection> = {
        main: {
            title: 'MAIN',
            items: [
                { label: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/' },
                { label: 'Task Tracker', icon: <ClipboardList size={20} />, href: '/tracker' },
                { label: 'Schedule', icon: <CalendarDays size={20} />, href: '/schedule' },
                ...(!isPCMode && (userRole === 'super_admin' || isGuest) ? [{ label: 'Super Admin', icon: <Shield size={20} />, href: '/super-admin' }] : []),
                // Checklists — admin only (Supabase super_admin login, not guest mode)
                ...(!isGuest && !isPCMode && userRole === 'super_admin' ? [{ label: 'Checklists', icon: <CheckSquare size={20} />, href: '/checklists' }] : []),
            ]
        },
        projects: {
            title: 'PROJECTS',
            items: [
                // ...(!isPCMode ? [{ label: 'Project Overview', icon: <FolderKanban size={18} />, href: '/project-overview' }] : []),
                { label: 'Budget', icon: <FolderKanban size={20} />, href: '/budget-and-activity' },
                ...(!isPCMode ? [{ label: 'Manage Projects', icon: <Database size={20} />, href: '/projects' }] : []),
                { label: 'On Hold', icon: <PauseCircle size={20} />, href: '/projects/on-hold' },
                { label: 'Completed', icon: <CheckSquare size={20} />, href: '/projects/completed' },
                { label: 'Rejected', icon: <XSquare size={20} />, href: '/projects/rejected' },
                { label: 'Forecast', icon: <TrendingUp size={20} />, href: '/projects/forecast' },
                { label: 'Milestones', icon: <Target size={20} />, href: '/projects/milestones' },
            ]
        },
        analytics: {
            title: 'ANALYTICS',
            items: [
                { label: 'Reports', icon: <BarChart3 size={20} />, href: '/reports' },
                { label: 'Analytics', icon: <Search size={20} />, href: '/analytics' },
                // Enable Bugs Report for Super Admin AND Managers (isGuest) regardless of team
                ...((isGuest) || (sidebarTitle === 'QA Team') || userRole === 'super_admin'
                    ? [{ label: 'Bugs Report', icon: <Bug size={20} />, href: '/analytics/bugs' }]
                    : []
                ),
                // Checklist Status — visible to all authenticated and guest users
                { label: 'Corrections', icon: <AlertCircle size={20} />, href: '/corrections' },
                { label: 'Checklist Status', icon: <ClipboardList size={20} />, href: '/checklist-status' },
            ]
        },
        requests: {
            title: 'REQUESTS',
            items: [
                { label: 'Leaves and WFH', icon: <Plane size={20} />, href: '/requests/new' },
                ...(isPCMode ? [{ label: 'Notifications', icon: <Bell size={20} />, href: '/notifications' }] : []),
            ]
        }
    };

    const [isHovered, setIsHovered] = useState(false);
    const [ignoreHover, setIgnoreHover] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Derived state for visual expansion
    // On desktop: Expand if not collapsed (pinned) OR if collapsed but hovered (unless ignored)
    // On mobile: Ignore hover, rely on collapsed state (which is handled by overlay/toggle)
    const showExpanded = !isCollapsed || ((isHovered || isDropdownOpen) && !ignoreHover);

    // Reset ignoreHover when mouse interactions occur
    const handleMouseEnter = () => {
        setIsHovered(true);
        setIgnoreHover(false);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setIgnoreHover(false);
    };

    // When collapsing, temporarily ignore hover to allow visual shrinking
    useEffect(() => {
        if (isCollapsed) {
            setIgnoreHover(true);
        }
    }, [isCollapsed]);

    return (
        <div id="app-sidebar-container">
            {/* Floating Toggle Button (Visible only when collapsed on mobile) */}
            <button
                onClick={() => setCollapsed(false)}
                className={`lg:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-indigo-900 text-white shadow-lg transition-all duration-300 hover:bg-indigo-800 ${!isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                aria-label="Open Sidebar"
            >
                <Menu size={24} />
            </button>

            {/* Sidebar */}
            <ManageTeamModal isOpen={showManageTeam} onClose={() => setShowManageTeam(false)} />

            <nav
                className={`
                    fixed top-0 left-0 h-full flex flex-col z-50 bg-white border-r border-slate-100 dark:bg-slate-900 dark:border-slate-800 transition-all duration-300 ease-in-out
                    ${showExpanded ? 'translate-x-0 w-[16.25rem]' : '-translate-x-full lg:translate-x-0 lg:w-20'}
                `}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className={`p-4 border-b border-transparent shrink-0 flex items-center justify-between gap-3 ${!showExpanded ? 'justify-center px-2' : ''}`}>

                    {/* Logo Area */}
                    {showExpanded && (
                        <div className="logo flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-yellow-500 rounded-lg text-white shrink-0">
                                    {isGuest ? <Eye size={20} /> : <LayoutDashboard size={20} />}
                                </div>

                                {isGuest ? (
                                    <div className="flex-1 min-w-0 relative group">
                                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                            <ChevronDown size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                        </div>
                                        <TeamSelector
                                            teams={teams}
                                            selectedTeamName={selectedTeamName}
                                            onSelect={(newTeamName) => {
                                                const selectedTeam = teams.find(t => t.name === newTeamName);

                                                if (selectedTeam) {
                                                    let targetTeamId = selectedTeam.id;

                                                    // QA Team -> Super Admin mapping logic
                                                    if (newTeamName.toLowerCase() === 'qa team') {
                                                        const superAdminTeam = teams.find(t => t.name.toLowerCase() === 'super admin');
                                                        if (superAdminTeam) {
                                                            targetTeamId = superAdminTeam.id;
                                                        }
                                                    }

                                                    if (isPCMode) {
                                                        setPCModeSession(targetTeamId, newTeamName);
                                                    } else {
                                                        setGuestSession(targetTeamId, newTeamName);
                                                    }
                                                    // Force reload to ensure all components and data fetchers update with new context
                                                    setTimeout(() => {
                                                        window.location.reload();
                                                    }, 100);
                                                }
                                            }}
                                            onOpenChange={setIsDropdownOpen}
                                        />
                                    </div>
                                ) : <span className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{sidebarTitle}</span>}
                            </div>
                        </div>
                    )}

                    {/* Collapsed Logo (Icon Only) - Show only when strictly collapsed AND not hovered */}
                    {!showExpanded && (
                        <div className="p-1.5 bg-yellow-500 rounded-lg text-white shrink-0 mb-4 cursor-pointer" onClick={toggleSidebar}>
                            {isGuest ? <Eye size={24} /> : <LayoutDashboard size={24} />}
                        </div>
                    )}

                    {/* Toggle Button (Desktop) - Show if expanded */}
                    {showExpanded && (
                        <button
                            onClick={toggleSidebar}
                            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            {/* If visually expanded but logic collapsed (hover state), show 'Pin' icon or similar? keeping sidebar chevron for now which toggles logic state */}
                            {isCollapsed ? <ChevronRight size={20} className="rotate-180" /> : <ChevronLeft size={20} />}
                        </button>
                    )}

                    {/* Close Button (Mobile) */}
                    <div className="lg:hidden ml-auto">
                        <CloseButton onClick={() => setCollapsed(true)} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                    {Object.entries(navSections).map(([key, section]) => (
                        <div key={key} className={`mb-2 ${!showExpanded ? 'mb-4 text-center' : ''}`}>
                            {showExpanded && (
                                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-4 mb-2 px-3">
                                    <span>{section.title}</span>
                                </div>
                            )}
                            {/* In collapsed mode, maybe show a separator or just space */}
                            {!showExpanded && <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-2"></div>}

                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`
                                                flex items-center rounded-lg cursor-pointer transition-all duration-200 font-medium text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-100 relative overflow-hidden group
                                                ${isActive ? 'text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 font-semibold active-nav-item' : ''}
                                                ${!showExpanded ? 'justify-center p-3' : 'px-3 py-2.5'}
                                            `}
                                            title={!showExpanded ? item.label : ''}
                                        >
                                            {isActive && showExpanded && (
                                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500 dark:bg-yellow-600 rounded-r-full" />
                                            )}

                                            <span className={`nav-icon flex items-center justify-center ${showExpanded ? 'mr-3' : ''} ${isActive ? 'text-yellow-600 dark:text-yellow-500' : ''}`}>
                                                {item.icon}
                                            </span>

                                            {showExpanded && <span className="nav-text truncate">{item.label}</span>}

                                            {showExpanded && item.badge && (
                                                <span className="ml-auto bg-sky-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                                    {item.badge}
                                                </span>
                                            )}

                                            {/* Tooltip on hover when collapsed - ONLY when NOT expanded (which implies not hovered, so this practically never shows on desktop if hover-expand is on, but keeps for mobile/edge cases) */}
                                            {!showExpanded && (
                                                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                                                    {item.label}
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className={`mt-auto border-t border-slate-100 dark:border-slate-800 p-4 space-y-2 ${!showExpanded ? 'px-2' : ''}`}>
                    {showExpanded && (
                        <div className="px-2 mb-2">
                            <ModeToggle />
                        </div>
                    )}

                    {/* Allow Manage Team for Super Admin AND Managers (isGuest) but NOT PC Mode */}
                    {!isPCMode && (userRole !== 'super_admin' || isGuest) && (
                        <button
                            onClick={() => setShowManageTeam(true)}
                            className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all ${!showExpanded ? 'justify-center' : ''}`}
                            title={!showExpanded ? "Manage Team" : ""}
                        >
                            <Users size={20} className="transition-colors" />
                            {showExpanded && <span className="font-medium text-sm">Manage Team</span>}
                        </button>
                    )}

                    {/* Notification Bell - PC Mode only */}
                    {isPCMode && showExpanded && (
                        <div className="flex items-center gap-3 px-2 py-1">
                            <NotificationBell />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Notifications</span>
                        </div>
                    )}

                    <button
                        onClick={async () => {
                            try {
                                await fetch('/api/auth/logout', { method: 'POST' });
                            } catch (e) {
                                console.error('Failed to clear server cookies:', e);
                            }

                            if (isGuest) {
                                clearGuestSession();
                                window.location.href = '/login';
                            } else {
                                await supabase.auth.signOut();
                                window.location.href = '/login';
                            }
                        }}
                        className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all ${!showExpanded ? 'justify-center' : ''}`}
                        title={!showExpanded ? (isPCMode ? 'Exit PC Mode' : isGuest ? 'Exit Manager Mode' : 'Sign Out') : ""}
                    >
                        <LogOut size={20} />
                        {showExpanded && <span className="font-medium text-sm">{isPCMode ? 'Exit Mode' : isGuest ? 'Exit Mode' : 'Sign Out'}</span>}
                    </button>

                    {!showExpanded && (
                        <div className="flex justify-center pt-2">
                            <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Overlay for mobile */}
            {!isCollapsed && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
                    onClick={() => setCollapsed(true)}
                />
            )}
        </div>
    );
}

