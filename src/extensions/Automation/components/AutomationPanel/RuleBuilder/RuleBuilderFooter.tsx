// RuleBuilderFooter — Save / Cancel bar at the bottom of the RuleBuilder.
import { useState } from 'react';
import translations from '../../../translations/en.json';

interface Props {
  ruleName: string;
  onRuleNameChange: (name: string) => void;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const RuleBuilderFooter = ({
  ruleName,
  onRuleNameChange,
  canSave,
  saving,
  onSave,
  onCancel,
}: Props) => (
  <div className="shrink-0 border-t border-slate-700 bg-slate-900 px-4 py-3 flex flex-col gap-3">
    {/* Rule name input */}
    <div>
      <label
        htmlFor="rule-name"
        className="mb-1 block text-xs font-medium text-slate-400"
      >
        {translations['automation.ruleBuilderFooter.ruleNameLabel']}
      </label>
      <input
        id="rule-name"
        type="text"
        className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={translations['automation.ruleBuilderFooter.ruleNamePlaceholder']}
        value={ruleName}
        onChange={(e) => onRuleNameChange(e.target.value)}
        maxLength={100}
      />
    </div>

    {/* Buttons */}
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        onClick={onCancel}
        disabled={saving}
      >
        {translations['automation.ruleBuilderFooter.cancel']}
      </button>
      <button
        type="button"
        className={`rounded-md px-4 py-1.5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
          canSave && !saving
            ? 'bg-blue-600 hover:bg-blue-500'
            : 'cursor-not-allowed bg-blue-600/40'
        }`}
        onClick={onSave}
        disabled={!canSave || saving}
        aria-busy={saving}
      >
        {saving ? translations['automation.ruleBuilderFooter.saving'] : translations['automation.ruleBuilderFooter.save']}
      </button>
    </div>
  </div>
);

export default RuleBuilderFooter;
