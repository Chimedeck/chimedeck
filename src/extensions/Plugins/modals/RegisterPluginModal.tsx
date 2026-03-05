// Modal form for platform admins to register a new plugin in the registry.
import { useState, useCallback, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { RegisterPluginBody } from '../api';

interface Props {
  open: boolean;
  isSubmitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (body: RegisterPluginBody) => void;
}

const SLUG_REGEX = /^[a-z0-9-]+$/;
const HTTPS_REGEX = /^https:\/\//;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const RegisterPluginModal = ({ open, isSubmitting, serverError, onClose, onSubmit }: Props) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [connectorUrl, setConnectorUrl] = useState('');
  const [manifestUrl, setManifestUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [author, setAuthor] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNameChange = useCallback((val: string) => {
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(deriveSlug(val));
    }
  }, [slugManuallyEdited]);

  const handleSlugChange = useCallback((val: string) => {
    setSlug(val);
    setSlugManuallyEdited(true);
  }, []);

  const addCategory = useCallback((raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (tag && !categories.includes(tag)) {
      setCategories((prev) => [...prev, tag]);
    }
    setCategoryInput('');
  }, [categories]);

  const handleCategoryKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCategory(categoryInput);
    }
  }, [categoryInput, addCategory]);

  const removeCategory = useCallback((tag: string) => {
    setCategories((prev) => prev.filter((c) => c !== tag));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!slug.trim()) errs.slug = 'Slug is required.';
    else if (!SLUG_REGEX.test(slug)) errs.slug = 'Slug must be lowercase letters, numbers, and hyphens only.';
    if (!description.trim()) errs.description = 'Description is required.';
    if (!connectorUrl.trim()) errs.connectorUrl = 'Connector URL is required.';
    else if (!HTTPS_REGEX.test(connectorUrl)) errs.connectorUrl = 'Connector URL must start with https://';
    if (!author.trim()) errs.author = 'Author name is required.';
    if (authorEmail && !EMAIL_REGEX.test(authorEmail)) errs.authorEmail = 'Invalid email address.';
    if (supportEmail && !EMAIL_REGEX.test(supportEmail)) errs.supportEmail = 'Invalid email address.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    // Flush any pending category input
    const finalCategories = [...categories];
    if (categoryInput.trim()) {
      const tag = categoryInput.trim().toLowerCase();
      if (!finalCategories.includes(tag)) finalCategories.push(tag);
    }
    onSubmit({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      connectorUrl: connectorUrl.trim(),
      ...(manifestUrl.trim() ? { manifestUrl: manifestUrl.trim() } : {}),
      ...(iconUrl.trim() ? { iconUrl: iconUrl.trim() } : {}),
      author: author.trim(),
      ...(authorEmail.trim() ? { authorEmail: authorEmail.trim() } : {}),
      ...(supportEmail.trim() ? { supportEmail: supportEmail.trim() } : {}),
      categories: finalCategories,
      isPublic,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, slug, description, connectorUrl, manifestUrl, iconUrl, author, authorEmail, supportEmail, categories, categoryInput, isPublic, onSubmit]);

  if (!open) return null;

  const field = (label: string, required: boolean, input: React.ReactNode, err?: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-300">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {input}
      {err && <p className="text-red-400 text-xs">{err}</p>}
    </div>
  );

  const inputCls = (err?: string) =>
    `bg-slate-800 border ${err ? 'border-red-500' : 'border-slate-600'} rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Register Plugin"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-slate-900 rounded-lg shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-slate-100 font-semibold text-base">Register a Plugin</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none" aria-label="Close">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {serverError && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm">
              {serverError === 'plugin-slug-taken'
                ? 'This slug is already taken. Please choose a different slug.'
                : serverError === 'invalid-connector-url'
                ? 'The connector URL is invalid. It must start with https://.'
                : serverError}
            </div>
          )}

          {field('Plugin Name', true,
            <input
              className={inputCls(errors.name)}
              placeholder="My Awesome Plugin"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.name,
          )}

          {field('Slug', true,
            <input
              className={inputCls(errors.slug)}
              placeholder="my-awesome-plugin"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.slug,
          )}

          {field('Description', true,
            <textarea
              className={`${inputCls(errors.description)} resize-none`}
              rows={3}
              placeholder="What does this plugin do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.description,
          )}

          {field('Connector URL', true,
            <input
              className={inputCls(errors.connectorUrl)}
              placeholder="https://my-plugin.example.com/connector"
              value={connectorUrl}
              onChange={(e) => setConnectorUrl(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.connectorUrl,
          )}

          {field('Manifest URL', false,
            <input
              className={inputCls()}
              placeholder="https://my-plugin.example.com/manifest.json"
              value={manifestUrl}
              onChange={(e) => setManifestUrl(e.target.value)}
              disabled={isSubmitting}
            />,
          )}

          {field('Icon URL', false,
            <div className="flex gap-2 items-center">
              <input
                className={`${inputCls()} flex-1`}
                placeholder="https://my-plugin.example.com/icon.png"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                disabled={isSubmitting}
              />
              {iconUrl && (
                <img
                  src={iconUrl}
                  alt="icon preview"
                  className="w-8 h-8 rounded object-cover border border-slate-600 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>,
          )}

          {field('Author', true,
            <input
              className={inputCls(errors.author)}
              placeholder="Jane Doe"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.author,
          )}

          {field('Author Email', false,
            <input
              type="email"
              className={inputCls(errors.authorEmail)}
              placeholder="jane@example.com"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.authorEmail,
          )}

          {field('Support Email', false,
            <input
              type="email"
              className={inputCls(errors.supportEmail)}
              placeholder="support@example.com"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.supportEmail,
          )}

          {field('Categories', false,
            <div>
              <div className="flex flex-wrap gap-1 mb-1">
                {categories.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-blue-800 text-blue-200 text-xs rounded px-2 py-0.5">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeCategory(tag)}
                      className="hover:text-white leading-none"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                className={inputCls()}
                placeholder="Type and press Enter or comma to add"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={handleCategoryKeyDown}
                onBlur={() => { if (categoryInput.trim()) addCategory(categoryInput); }}
                disabled={isSubmitting}
              />
            </div>,
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={isSubmitting}
              className="w-4 h-4 accent-blue-500"
            />
            <label htmlFor="isPublic" className="text-sm text-slate-300 cursor-pointer">
              Public (visible to all users)
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-700 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-4 py-2"
          >
            {isSubmitting ? 'Registering…' : 'Register Plugin'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RegisterPluginModal;
