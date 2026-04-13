// FormInputSample — shows text input, select, checkbox, and radio variants
// using the shared Input component and native form controls styled with tokens.
import Input from '~/common/components/Input';

export default function FormInputSample() {
  return (
    <div className="space-y-8 max-w-sm">
      {/* Text inputs */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Text Input
        </p>
        <Input label="Default" placeholder="Enter value" defaultValue="" />
        <Input
          label="With value"
          placeholder="Enter value"
          defaultValue="Hello world"
        />
        <Input
          label="Error state"
          placeholder="Enter value"
          error="This field is required"
        />
        <Input
          label="Disabled"
          placeholder="Cannot edit"
          disabled
          defaultValue="Disabled value"
        />
      </div>

      {/* Select */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Select
        </p>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="ds-select"
            className="text-sm font-medium text-muted"
          >
            Priority
          </label>
          <select
            id="ds-select"
            className="rounded-md border border-border bg-bg-overlay px-3 py-2 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select…</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="ds-select-disabled"
            className="text-sm font-medium text-muted"
          >
            Disabled
          </label>
          <select
            id="ds-select-disabled"
            disabled
            className="rounded-md border border-border bg-bg-overlay px-3 py-2 text-sm text-base disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
          >
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Checkbox */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Checkbox
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            defaultChecked={false}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-base">Unchecked</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-base">Checked</span>
        </label>
        <label className="flex items-center gap-2 cursor-not-allowed opacity-50">
          <input
            type="checkbox"
            disabled
            className="h-4 w-4 rounded border-border text-primary"
          />
          <span className="text-sm text-base">Disabled</span>
        </label>
      </div>

      {/* Radio */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Radio
        </p>
        <fieldset className="space-y-2">
          <legend className="sr-only">Notification preference</legend>
          {['All activity', 'Mentions only', 'None'].map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="ds-radio"
                defaultChecked={opt === 'All activity'}
                className="h-4 w-4 border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-base">{opt}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
