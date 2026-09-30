import React from 'react';
import { LayoutDashboard, Server as ServerIcon, Users, Network, ShieldAlert, Settings, Sliders } from 'lucide-react';
import { AdminOverview } from './admin/AdminOverview';
import { AdminServers } from './admin/AdminServers';
import { AdminUsers } from './admin/AdminUsers';
import { AdminNodes } from './admin/AdminNodes';
import { AdminAuditLogs } from './admin/AdminAuditLogs';
import { AdminSettings } from './admin/AdminSettings';

interface AdminPanelProps {
  activeTab: 'admin-dashboard' | 'admin-servers' | 'users' | 'admin-nodes' | 'audit' | 'admin-settings';
  setActiveTab: (tab: any) => void;
  servers: any[];
  usersList: any[];
  hostStats: any;
  auditLogs: any[];
  auditSearch: string;
  setAuditSearch: (val: string) => void;
  auditCategory: string;
  setAuditCategory: (val: string) => void;
  adminServerSearch: string;
  setAdminServerSearch: (val: string) => void;
  adminServerStatusFilter: string;
  setAdminServerStatusFilter: (val: string) => void;
  setShowWizard: (val: boolean) => void;
  setWizardStep: (step: number) => void;
  setShowCreateUserModal: (val: boolean) => void;
  setShowCreateNodeModal: (val: boolean) => void;
  setDeleteConfirmModalServer: (server: any) => void;
  onSelectServer: (id: string) => void;
  token?: string | null;
  currentUser?: any;
  onRefreshUsers?: () => void;
  showToast?: (type: 'success' | 'error' | 'info' | 'warn', message: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  activeTab,
  setActiveTab,
  servers,
  usersList,
  hostStats,
  auditLogs,
  adminServerSearch,
  setAdminServerSearch,
  setShowWizard,
  setWizardStep,
  setShowCreateUserModal,
  setShowCreateNodeModal,
  setDeleteConfirmModalServer,
  onSelectServer,
  token,
  currentUser,
  onRefreshUsers,
  showToast
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Navigation Sub-Header for Admin Area */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-purple-950/40 border border-purple-500/20 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-400/30 text-purple-300">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">System Administration Panel</h2>
            <p className="text-xs text-zinc-400">Global Infrastructure, Users, Nodes & Audit Controls</p>
          </div>
        </div>

        {/* Quick Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'admin-dashboard', label: 'Overview', icon: LayoutDashboard },
            { id: 'admin-servers', label: `Servers (${servers.length})`, icon: ServerIcon },
            { id: 'users', label: `Users (${usersList.length})`, icon: Users },
            { id: 'admin-nodes', label: 'Nodes', icon: Network },
            { id: 'audit', label: 'Audit Logs', icon: ShieldAlert },
            { id: 'admin-settings', label: 'System Settings', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md border border-purple-400/40'
                    : 'text-zinc-300 hover:text-white bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5'
                }`}
              >
                <Icon className="w-4 h-4 text-purple-300" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ADMIN OVERVIEW */}
      {activeTab === 'admin-dashboard' && (
        <AdminOverview
          servers={servers}
          usersList={usersList}
          hostStats={hostStats}
        />
      )}

      {/* ADMIN SERVERS LIST */}
      {activeTab === 'admin-servers' && (
        <AdminServers
          servers={servers}
          adminServerSearch={adminServerSearch}
          setAdminServerSearch={setAdminServerSearch}
          setShowWizard={setShowWizard}
          setWizardStep={setWizardStep}
          onSelectServer={onSelectServer}
          setDeleteConfirmModalServer={setDeleteConfirmModalServer}
        />
      )}

      {/* USER MANAGEMENT */}
      {activeTab === 'users' && (
        <AdminUsers
          usersList={usersList}
          setShowCreateUserModal={setShowCreateUserModal}
          token={token}
          currentUser={currentUser}
          onRefreshUsers={onRefreshUsers}
          showToast={showToast}
        />
      )}

      {/* NODE MANAGEMENT */}
      {activeTab === 'admin-nodes' && (
        <AdminNodes
          setShowCreateNodeModal={setShowCreateNodeModal}
        />
      )}

      {/* AUDIT LOGS */}
      {activeTab === 'audit' && (
        <AdminAuditLogs
          auditLogs={auditLogs}
        />
      )}

      {/* SYSTEM SETTINGS & SOFTWARE LOGO MANAGER */}
      {activeTab === 'admin-settings' && (
        <AdminSettings
          showToast={showToast}
        />
      )}
    </div>
  );
};
