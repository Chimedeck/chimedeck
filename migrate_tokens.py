import re, os

BASE = "/Users/user/Work/Projects/sharetribe-horizon/servers/agentic-trello-replacement/src/extensions/Automation/components"

files = [
    "AutomationHeaderButton.tsx",
    "AutomationPanel/AutomationEmptyState.tsx",
    "AutomationPanel/AutomationList.tsx",
    "AutomationPanel/ButtonsTab.tsx",
    "AutomationPanel/index.tsx",
    "AutomationPanel/RuleBuilder/ActionConfig.tsx",
    "AutomationPanel/RuleBuilder/ActionItem.tsx",
    "AutomationPanel/RuleBuilder/ActionList.tsx",
    "AutomationPanel/RuleBuilder/ActionPicker.tsx",
    "AutomationPanel/RuleBuilder/configFieldRenderer.tsx",
    "AutomationPanel/RuleBuilder/index.tsx",
    "AutomationPanel/RuleBuilder/RuleBuilderFooter.tsx",
    "AutomationPanel/RuleBuilder/TriggerConfig.tsx",
    "AutomationPanel/RuleBuilder/TriggerPicker.tsx",
    "BoardButtons/BoardButtonBuilder.tsx",
    "BoardButtons/BoardButtonItem.tsx",
    "BoardButtons/BoardButtonsBar.tsx",
    "CardButtons/AddCardButtonButton.tsx",
    "CardButtons/CardButtonBuilder.tsx",
    "CardButtons/CardButtonItem.tsx",
    "CardButtons/CardButtonsSection.tsx",
    "LogPanel/AutomationRunsPanel.tsx",
    "LogPanel/index.tsx",
    "LogPanel/QuotaBar.tsx",
    "LogPanel/RunCountChip.tsx",
    "LogPanel/RunLogDetail.tsx",
    "LogPanel/RunLogRow.tsx",
    "LogPanel/RunLogTable.tsx",
    "SchedulePanel/builders/DueDateCommandBuilder.tsx",
    "SchedulePanel/builders/ScheduledCommandBuilder.tsx",
    "SchedulePanel/index.tsx",
    "SchedulePanel/QuickStartTemplates.tsx",
    "SchedulePanel/ScheduleEmptyState.tsx",
    "SchedulePanel/ScheduleItem.tsx",
    "SchedulePanel/ScheduleList.tsx",
    "shared/IconPicker.tsx",
]

# A Tailwind class boundary: not preceded/followed by [a-zA-Z0-9_-]
# We use negative lookbehind/lookahead for word chars and hyphen
def tw(cls):
    """Return regex pattern that matches exactly the Tailwind class cls."""
    # Escape special regex chars in cls (mainly the colon in hover:)
    escaped = re.escape(cls)
    # Match surrounded by non-class characters (space, quote, backtick, newline, end)
    # A class char is [a-zA-Z0-9_:/-\[\].!]
    # We just check not preceded by [-a-zA-Z0-9] and not followed by [-a-zA-Z0-9/\[]
    return r'(?<![a-zA-Z0-9_-])' + escaped + r'(?![a-zA-Z0-9_\-\[/])'

replacements = [
    # ── Background ──
    # Opacity variants: bg-slate-800/N → bg-bg-surface/N  (handles hover: too via the whole token)
    # Process these FIRST with a special func-based replace
    # Handled below via regex with capture group

    # Plain bg mappings (900/950 → base)
    (tw('bg-slate-950'), 'bg-bg-base'),
    (tw('bg-gray-950'),  'bg-bg-base'),
    (tw('bg-slate-900'), 'bg-bg-base'),
    (tw('bg-gray-900'),  'bg-bg-base'),
    (tw('bg-zinc-900'),  'bg-bg-base'),
    # 800 → surface
    (tw('bg-slate-800'), 'bg-bg-surface'),
    (tw('bg-gray-800'),  'bg-bg-surface'),
    (tw('bg-zinc-800'),  'bg-bg-surface'),
    # 700 → overlay
    (tw('bg-slate-700'), 'bg-bg-overlay'),
    (tw('bg-gray-700'),  'bg-bg-overlay'),
    (tw('bg-zinc-700'),  'bg-bg-overlay'),
    # 600 → sunken
    (tw('bg-slate-600'), 'bg-bg-sunken'),
    (tw('bg-gray-600'),  'bg-bg-sunken'),
    (tw('bg-zinc-600'),  'bg-bg-sunken'),

    # hover: bg variants
    (tw('hover:bg-slate-800'), 'hover:bg-bg-surface'),
    (tw('hover:bg-gray-800'),  'hover:bg-bg-surface'),
    (tw('hover:bg-slate-700'), 'hover:bg-bg-overlay'),
    (tw('hover:bg-gray-700'),  'hover:bg-bg-overlay'),

    # Remove dark: bg variants (with optional leading space)
    (r'[ ]?dark:bg-slate-\d+(?![a-zA-Z0-9_\-\[/])', ''),
    (r'[ ]?dark:bg-gray-\d+(?![a-zA-Z0-9_\-\[/])',  ''),

    # ── Text ──
    (tw('text-slate-100'), 'text-base'),
    (tw('text-gray-100'),  'text-base'),
    (tw('text-slate-200'), 'text-subtle'),
    (tw('text-gray-200'),  'text-subtle'),
    (tw('text-slate-300'), 'text-subtle'),
    (tw('text-gray-300'),  'text-subtle'),
    (tw('text-slate-400'), 'text-muted'),
    (tw('text-gray-400'),  'text-muted'),
    (tw('text-zinc-400'),  'text-muted'),
    (tw('text-slate-500'), 'text-muted'),
    (tw('text-gray-500'),  'text-muted'),

    # hover: text
    (tw('hover:text-slate-200'), 'hover:text-subtle'),
    (tw('hover:text-gray-200'),  'hover:text-subtle'),
    (tw('hover:text-slate-300'), 'hover:text-subtle'),
    (tw('hover:text-gray-300'),  'hover:text-subtle'),

    # Remove dark: text variants
    (r'[ ]?dark:text-white(?![a-zA-Z0-9_\-\[/])',    ''),
    (r'[ ]?dark:text-gray-\d+(?![a-zA-Z0-9_\-\[/])', ''),
    (r'[ ]?dark:text-slate-\d+(?![a-zA-Z0-9_\-\[/])', ''),

    # ── Border ──
    (tw('border-slate-200'), 'border-border'),
    (tw('border-slate-400'), 'border-border'),
    (tw('border-slate-500'), 'border-border'),
    (tw('border-slate-600'), 'border-border'),
    (tw('border-slate-700'), 'border-border'),
    (tw('border-slate-800'), 'border-border'),
    (tw('border-gray-200'),  'border-border'),
    (tw('border-gray-600'),  'border-border'),
    (tw('border-gray-700'),  'border-border'),
    (tw('border-gray-800'),  'border-border'),

    # hover: border
    (tw('hover:border-slate-400'), 'hover:border-border'),
    (tw('hover:border-slate-500'), 'hover:border-border'),
    (tw('hover:border-slate-600'), 'hover:border-border'),
    (tw('hover:border-slate-700'), 'hover:border-border'),

    # Remove dark: border variants
    (r'[ ]?dark:border-gray-\d+(?![a-zA-Z0-9_\-\[/])',   ''),
    (r'[ ]?dark:border-slate-\d+(?![a-zA-Z0-9_\-\[/])',  ''),

    # ── Placeholder ──
    (tw('placeholder:text-slate-500'), 'placeholder:text-muted'),
    (tw('placeholder:text-slate-400'), 'placeholder:text-muted'),
    # v2 style without colon
    (r'(?<![a-zA-Z0-9_-])placeholder-slate-500(?![a-zA-Z0-9_\-\[/])', 'placeholder-text-muted'),
]

def apply_opacity_bg_replacements(content):
    """
    Handle bg-slate-800/N and hover:bg-slate-800/N opacity variants.
    Maps: {prefix}bg-slate-800/N → {prefix}bg-bg-surface/N
          {prefix}bg-slate-900/N → {prefix}bg-bg-base/N
          {prefix}bg-slate-700/N → {prefix}bg-bg-overlay/N
    """
    mapping = {
        'slate-950': 'bg-base', 'gray-950': 'bg-base',
        'slate-900': 'bg-base', 'gray-900': 'bg-base', 'zinc-900': 'bg-base',
        'slate-800': 'bg-surface', 'gray-800': 'bg-surface', 'zinc-800': 'bg-surface',
        'slate-700': 'bg-overlay', 'gray-700': 'bg-overlay', 'zinc-700': 'bg-overlay',
        'slate-600': 'bg-sunken', 'gray-600': 'bg-sunken', 'zinc-600': 'bg-sunken',
    }
    def replacer(m):
        color = m.group(1)
        opacity = m.group(2)
        token = mapping.get(color)
        if token:
            return f'bg-{token}/{opacity}'
        return m.group(0)  # keep as-is
    
    # Match bg-<color>/<opacity> where color is one of our target colors
    color_pat = '|'.join(re.escape(c) for c in mapping.keys())
    pattern = r'(?<![a-zA-Z0-9_-])bg-(' + color_pat + r')/(\d+)(?![a-zA-Z0-9_\-\[])'
    return re.sub(pattern, replacer, content)

for filename in files:
    filepath = os.path.join(BASE, filename)
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {filename}")
        continue

    with open(filepath, 'r') as f:
        content = f.read()
    original = content

    # Apply opacity bg replacements first
    content = apply_opacity_bg_replacements(content)

    # Apply all other replacements
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"UPDATED: {filename}")
    else:
        print(f"NO CHANGES: {filename}")

print("Done.")
