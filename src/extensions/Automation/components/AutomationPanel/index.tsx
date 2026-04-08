// AutomationPanel — slide-in drawer with tabs (Rules / Buttons / Schedule / Log).
// Unimplemented tabs show a "Coming soon" placeholder.
import { useEffect, useState, useCallback } from 'react';
import { BoltIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Button from '../../../../common/components/Button';
import type { Automation, AutomationTab } from '../../types';
import { getAutomations } from '../../api';
import AutomationList from './AutomationList';
import AutomationEmptyState from './AutomationEmptyState';
import RuleBuilder from './RuleBuilder';
import ButtonsTab from './ButtonsTab';
import SchedulePanel from '../SchedulePanel';
import LogPanel from '../LogPanel';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
  isOpen: boolean;
  activeTab: AutomationTab;
  onClose: () => void;
  onTabChange: (tab: AutomationTab) => void;
}

const TABS: { id: AutomationTab; label: string }[] = [
  { id: 'rules', label: translations['automation.panel.tab.rules'] },
  { id: 'buttons', label: translations['automation.panel.tab.buttons'] },
  // TODO: unhide schedule tab when feature is ready
  { id: 'log', label: translations['automation.panel.tab.log'] },
];

const ComingSoon = ({ tab }: { tab: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
    <p className="text-subtle font-medium capitalize">{tab}</p>
    <p className="text-sm text-muted">Coming soon</p>
  </div>
);

const AutomationPanel = ({ boardId, isOpen, activeTab, onClose, onTabChange }: Props) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = list view; undefined = new rule; Automation object = edit mode
  const [editingRule, setEditingRule] = useState<Automation | null | undefined>(null);

  const loadAutomations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAutomations({ boardId });
      setAutomations(res.data);
    } catch {
      setError(translations['automation.panel.error.loadFailed']);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  // Reload whenever the panel is opened or boardId changes.
  useEffect(() => {
    if (isOpen) loadAutomations();
  }, [isOpen, loadAutomations]);

  // Trap focus and close on Escape when panel is open.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rules = automations.filter((a) => a.automationType === 'RULE');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="absolute right-0 top-0 h-full w-96 bg-bg-base border-l border-border flex flex-col shadow-2xl z-40"
        role="dialog"
        aria-modal="true"
        aria-label={translations['automation.panel.title']}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BoltIcon className="h-5 w-5 text-subtle" aria-hidden="true" />
            <h2 className="text-base font-semibold text-sm">{translations['automation.panel.title']}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={translations['automation.panel.close']}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border px-4 pt-2 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`rounded-t px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-muted hover:text-subtle'
              }`}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto" role="tabpanel">
          {activeTab === 'rules' && (
            <>
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted">{translations['automation.panel.loading']}</p>
                </div>
              )}
              {!loading && error && (
                <div className="p-4">
                  <p className="text-sm text-danger">{error}</p>
                  <button
                    className="mt-2 text-xs text-blue-400 hover:underline"
                    onClick={loadAutomations}
                  >
                    {translations['automation.panel.retry']}
                  </button>
                </div>
              )}
              {!loading && !error && editingRule !== null && editingRule !== undefined && (
                /* RuleBuilder (edit mode) */
                <RuleBuilder
                  boardId={boardId}
                  initialAutomation={editingRule}
                  onSaved={() => {
                    setEditingRule(null);
                    loadAutomations();
                  }}
                  onCancel={() => setEditingRule(null)}
                />
              )}
              {!loading && !error && editingRule === undefined && (
                /* RuleBuilder (create mode) */
                <RuleBuilder
                  boardId={boardId}
                  onSaved={() => {
                    setEditingRule(null);
                    loadAutomations();
                  }}
                  onCancel={() => setEditingRule(null)}
                />
              )}
              {!loading && !error && editingRule === null && rules.length === 0 && (
                <AutomationEmptyState onCreateRule={() => setEditingRule(undefined)} />
              )}
              {!loading && !error && editingRule === null && rules.length > 0 && (
                <AutomationList
                  boardId={boardId}
                  automations={automations}
                  onCreateRule={() => setEditingRule(undefined)}
                  onEditRule={(a) => setEditingRule(a)}
                  onChanged={loadAutomations}
                />
              )}
            </>
          )}
          {activeTab === 'buttons' && (
            <ButtonsTab
              boardId={boardId}
              automations={automations}
              onChanged={loadAutomations}
            />
          )}
          {activeTab === 'schedule' && (
            <SchedulePanel
              boardId={boardId}
              automations={automations}
              onChanged={loadAutomations}
            />
          )}
          {activeTab === 'log' && <LogPanel boardId={boardId} automations={automations} />}
        </div>
      </div>
    </>
  );
};

export default AutomationPanel;
