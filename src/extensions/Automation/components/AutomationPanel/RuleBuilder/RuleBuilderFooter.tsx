// RuleBuilderFooter — Save / Cancel bar at the bottom of the RuleBuilder.
import { useState } from 'react';
import Button from '../../../../../common/components/Button';
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
  <div className="shrink-0 border-t border-border bg-bg-base px-4 py-3 flex flex-col gap-3">
    {/* Rule name input */}
    <div>
      <label
        htmlFor="rule-name"
        className="mb-1 block text-xs font-medium text-muted"
      >
        {translations['automation.ruleBuilderFooter.ruleNameLabel']}
      </label>
      <input
        id="rule-name"
        type="text"
        className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
        onClick={onCancel}
        disabled={saving}
      >
        {translations['automation.ruleBuilderFooter.cancel']}
      </button>
      <Button
        variant="primary"
        type="button"
        disabled={!canSave || saving}
        onClick={onSave}
        aria-busy={saving}
      >
        {saving ? translations['automation.ruleBuilderFooter.saving'] : translations['automation.ruleBuilderFooter.save']}
      </Button>
    </div>
  </div>
);

export default RuleBuilderFooter;
