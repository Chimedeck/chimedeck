// useAutomationPanel — manages open/close and active tab state for the Automation side panel.
import { useState, useCallback } from 'react';
import type { AutomationTab } from '../types';

export interface AutomationPanelState {
  isOpen: boolean;
  activeTab: AutomationTab;
  openPanel: (tab?: AutomationTab) => void;
  closePanel: () => void;
  setActiveTab: (tab: AutomationTab) => void;
}

export function useAutomationPanel(): AutomationPanelState {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AutomationTab>('rules');

  const openPanel = useCallback((tab: AutomationTab = 'rules') => {
    setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  return { isOpen, activeTab, openPanel, closePanel, setActiveTab };
}
