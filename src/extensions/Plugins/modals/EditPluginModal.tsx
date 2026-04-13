// Modal form for platform admins to edit an existing plugin in the registry.
import { useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../common/components/Button';
import IconButton from '../../../common/components/IconButton';
import translations from '../translations/en.json';
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
    if (!name.trim()) errs.name = translations['plugins.editModal.validation.nameRequired'];
    if (!description.trim()) errs.description = translations['plugins.editModal.validation.descriptionRequired'];
    if (!connectorUrl.trim()) errs.connectorUrl = translations['plugins.editModal.validation.connectorUrlRequired'];
    else if (!HTTPS_REGEX.test(connectorUrl)) errs.connectorUrl = translations['plugins.editModal.validation.connectorUrlInvalid'];
    if (!author.trim()) errs.author = translations['plugins.editModal.validation.authorRequired'];
    if (authorEmail && !EMAIL_REGEX.test(authorEmail)) errs.authorEmail = translations['plugins.editModal.validation.emailInvalid'];
    if (supportEmail && !EMAIL_REGEX.test(supportEmail)) errs.supportEmail = translations['plugins.editModal.validation.emailInvalid'];
    for (const domain of whitelistedDomains) {
      if (!HTTPS_REGEX.test(domain)) {
        errs.whitelistedDomains = translations['plugins.editModal.validation.domainsInvalid'];
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
      <label className="text-xs font-medium text-subtle">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {input}
      {err && <p className="text-danger text-xs">{err}</p>}
    </div>
  );

  const inputCls = (err?: string) =>
    `bg-bg-overlay border ${err ? 'border-danger' : 'border-border'} rounded px-3 py-2 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={translations['plugins.editModal.ariaLabel']}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-bg-base rounded-lg shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold">{translations['plugins.editModal.title']}</h2>
          <IconButton
            aria-label={translations['plugins.editModal.closeAriaLabel']}
            icon={<span aria-hidden="true">✕</span>}
            onClick={onClose}
          />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {serverError && (
            // [theme-exception]: light text on dark red error bg
            <div className="bg-danger/10 border border-danger/40 rounded p-3 text-danger text-sm">
              {serverError === 'invalid-connector-url'
                ? translations['plugins.editModal.error.invalidConnectorUrl']
                : serverError === 'invalid-whitelisted-domain'
                ? translations['plugins.editModal.error.invalidWhitelistedDomain']
                : serverError === 'too-many-whitelisted-domains'
                ? translations['plugins.editModal.error.tooManyWhitelistedDomains']
                : serverError}
            </div>
          )}

          {field(translations['plugins.editModal.field.pluginName'], true,
            <input
              className={inputCls(errors.name)}
              placeholder={translations['plugins.editModal.placeholder.pluginName']}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.name,
          )}

          {field(translations['plugins.editModal.field.description'], true,
            <textarea
              className={`${inputCls(errors.description)} resize-none`}
              rows={3}
              placeholder={translations['plugins.editModal.placeholder.description']}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.description,
          )}

          {field(translations['plugins.editModal.field.connectorUrl'], true,
            <input
              className={inputCls(errors.connectorUrl)}
              placeholder={translations['plugins.editModal.placeholder.connectorUrl']}
              value={connectorUrl}
              onChange={(e) => setConnectorUrl(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.connectorUrl,
          )}

          {field(translations['plugins.editModal.field.manifestUrl'], false,
            <input
              className={inputCls()}
              placeholder={translations['plugins.editModal.placeholder.manifestUrl']}
              value={manifestUrl}
              onChange={(e) => setManifestUrl(e.target.value)}
              disabled={isSubmitting}
            />,
          )}

          {field(translations['plugins.editModal.field.iconUrl'], false,
            <div className="flex gap-2 items-center">
              <input
                className={`${inputCls()} flex-1`}
                placeholder={translations['plugins.editModal.placeholder.iconUrl']}
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                disabled={isSubmitting}
              />
              {iconUrl && (
                <img
                  src={iconUrl}
                  alt="icon preview"
                  className="w-8 h-8 rounded object-cover border border-border flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>,
          )}

          {field(translations['plugins.editModal.field.author'], true,
            <input
              className={inputCls(errors.author)}
              placeholder={translations['plugins.editModal.placeholder.author']}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.author,
          )}

          {field(translations['plugins.editModal.field.authorEmail'], false,
            <input
              type="email"
              className={inputCls(errors.authorEmail)}
              placeholder={translations['plugins.editModal.placeholder.authorEmail']}
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.authorEmail,
          )}

          {field(translations['plugins.editModal.field.supportEmail'], false,
            <input
              type="email"
              className={inputCls(errors.supportEmail)}
              placeholder={translations['plugins.editModal.placeholder.supportEmail']}
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.supportEmail,
          )}

          {field(translations['plugins.editModal.field.categories'], false,
            <div>
              <div className="flex flex-wrap gap-1 mb-1">
                {categories.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-blue-800 text-blue-200 text-xs rounded px-2 py-0.5">
                    {tag}
                    <IconButton
                      icon={<span aria-hidden className="leading-none">×</span>}
                      aria-label={`Remove ${tag}`}
                      onClick={() => removeCategory(tag)}
                      className="h-auto w-auto p-0 hover:text-base"
                    />
                  </span>
                ))}
              </div>
              <input
                className={inputCls()}
                placeholder={translations['plugins.editModal.placeholder.categories']}
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={handleCategoryKeyDown}
                onBlur={() => { if (categoryInput.trim()) addCategory(categoryInput); }}
                disabled={isSubmitting}
              />
            </div>,
          )}

          {field(translations['plugins.editModal.field.whitelistedDomains'], false,
            <div>
              <p className="text-xs text-muted mb-1">
                {translations['plugins.editModal.whitelistedDomains.hint']}
              </p>
              <div className="flex flex-wrap gap-1 mb-1">
                {whitelistedDomains.map((domain) => (
                  <span key={domain} className="flex items-center gap-1 bg-bg-overlay text-subtle text-xs rounded px-2 py-0.5">
                    {domain}
                    <IconButton
                      icon={<span aria-hidden className="leading-none">×</span>}
                      aria-label={`Remove ${domain}`}
                      onClick={() => removeDomain(domain)}
                      className="h-auto w-auto p-0 hover:text-base"
                    />
                  </span>
                ))}
              </div>
              <input
                className={inputCls(errors.whitelistedDomains)}
                placeholder={translations['plugins.editModal.placeholder.whitelistedDomains']}
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
            <label htmlFor="editIsPublic" className="text-sm text-subtle cursor-pointer">
              {translations['plugins.editModal.field.isPublic']}
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {translations['plugins.editModal.cancel']}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? translations['plugins.editModal.saving'] : translations['plugins.editModal.submit']}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default EditPluginModal;
