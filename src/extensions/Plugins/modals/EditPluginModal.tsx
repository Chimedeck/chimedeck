// Modal form for platform admins to edit an existing plugin in the registry.
import { useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Plugin, UpdatePluginBody } from '../api';

interface Props {
  open: boolean;
  plugin: Plugin | null;
  isSubmitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (pluginId: string, body: UpdatePluginBody) => void;
}

const HTTPS_REGEX = /^https:\/\//;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EditPluginModal = ({ open, plugin, isSubmitting, serverError, onClose, onSubmit }: Props) => {
  const [name, setName] = useState('');
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
  const [whitelistedDomains, setWhitelistedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill form when plugin prop changes
  useEffect(() => {
    if (plugin) {
      setName(plugin.name ?? '');
      setDescription(plugin.description ?? '');
      setConnectorUrl(plugin.connectorUrl ?? '');
      setManifestUrl('');
      setIconUrl(plugin.iconUrl ?? '');
      setAuthor(plugin.author ?? '');
      setAuthorEmail(plugin.authorEmail ?? '');
      setSupportEmail(plugin.supportEmail ?? '');
      setCategories(plugin.categories ?? []);
      setCategoryInput('');
      setIsPublic(plugin.isPublic ?? true);
      setWhitelistedDomains(plugin.whitelistedDomains ?? []);
      setDomainInput('');
      setErrors({});
    }
  }, [plugin]);

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

  const addDomain = useCallback((raw: string) => {
    const domain = raw.trim();
    if (domain && !whitelistedDomains.includes(domain)) {
      setWhitelistedDomains((prev) => [...prev, domain]);
    }
    setDomainInput('');
  }, [whitelistedDomains]);

  const handleDomainKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addDomain(domainInput);
    }
  }, [domainInput, addDomain]);

  const removeDomain = useCallback((domain: string) => {
    setWhitelistedDomains((prev) => prev.filter((d) => d !== domain));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!description.trim()) errs.description = 'Description is required.';
    if (!connectorUrl.trim()) errs.connectorUrl = 'Connector URL is required.';
    else if (!HTTPS_REGEX.test(connectorUrl)) errs.connectorUrl = 'Connector URL must start with https://';
    if (!author.trim()) errs.author = 'Author name is required.';
    if (authorEmail && !EMAIL_REGEX.test(authorEmail)) errs.authorEmail = 'Invalid email address.';
    if (supportEmail && !EMAIL_REGEX.test(supportEmail)) errs.supportEmail = 'Invalid email address.';
    for (const domain of whitelistedDomains) {
      if (!HTTPS_REGEX.test(domain)) {
        errs.whitelistedDomains = 'All domains must start with https://';
        break;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = useCallback(() => {
    if (!plugin || !validate()) return;
    const finalCategories = [...categories];
    if (categoryInput.trim()) {
      const tag = categoryInput.trim().toLowerCase();
      if (!finalCategories.includes(tag)) finalCategories.push(tag);
    }
    const finalDomains = [...whitelistedDomains];
    if (domainInput.trim() && !finalDomains.includes(domainInput.trim())) {
      finalDomains.push(domainInput.trim());
    }
    onSubmit(plugin.id, {
      name: name.trim(),
      description: description.trim(),
      connectorUrl: connectorUrl.trim(),
      ...(manifestUrl.trim() ? { manifestUrl: manifestUrl.trim() } : {}),
      ...(iconUrl.trim() ? { iconUrl: iconUrl.trim() } : { iconUrl: '' }),
      author: author.trim(),
      ...(authorEmail.trim() ? { authorEmail: authorEmail.trim() } : {}),
      ...(supportEmail.trim() ? { supportEmail: supportEmail.trim() } : {}),
      categories: finalCategories,
      isPublic,
      whitelistedDomains: finalDomains,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin, name, description, connectorUrl, manifestUrl, iconUrl, author, authorEmail, supportEmail, categories, categoryInput, isPublic, whitelistedDomains, domainInput, onSubmit]);

  if (!open || !plugin) return null;

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
      aria-label="Edit Plugin"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-slate-900 rounded-lg shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-slate-100 font-semibold text-base">Edit Plugin</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none" aria-label="Close">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {serverError && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm">
              {serverError === 'invalid-connector-url'
                ? 'The connector URL is invalid. It must start with https://.'
                : serverError === 'invalid-whitelisted-domain'
                ? 'One or more domains are invalid. They must start with https://.'
                : serverError === 'too-many-whitelisted-domains'
                ? 'Too many whitelisted domains (max 20).'
                : serverError}
            </div>
          )}

          {field('Plugin Name', true,
            <input
              className={inputCls(errors.name)}
              placeholder="My Awesome Plugin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.name,
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

          {field('Whitelisted Domains', false,
            <div>
              <p className="text-xs text-slate-500 mb-1">
                External domains this plugin may load (https:// only, max 20).
              </p>
              <div className="flex flex-wrap gap-1 mb-1">
                {whitelistedDomains.map((domain) => (
                  <span key={domain} className="flex items-center gap-1 bg-slate-700 text-slate-200 text-xs rounded px-2 py-0.5">
                    {domain}
                    <button
                      type="button"
                      onClick={() => removeDomain(domain)}
                      className="hover:text-white leading-none"
                      aria-label={`Remove ${domain}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                className={inputCls(errors.whitelistedDomains)}
                placeholder="https://api.example.com — press Enter to add"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={handleDomainKeyDown}
                onBlur={() => { if (domainInput.trim()) addDomain(domainInput); }}
                disabled={isSubmitting}
              />
            </div>,
            errors.whitelistedDomains,
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={isSubmitting}
              className="w-4 h-4 accent-blue-500"
            />
            <label htmlFor="editIsPublic" className="text-sm text-slate-300 cursor-pointer">
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
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default EditPluginModal;
