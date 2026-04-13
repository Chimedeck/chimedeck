// Modal form for platform admins to register a new plugin in the registry.
import { useState, useCallback, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../common/components/Button';
import IconButton from '../../../common/components/IconButton';
import translations from '../translations/en.json';
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
    if (!name.trim()) errs.name = translations['plugins.registerModal.validation.nameRequired'];
    if (!slug.trim()) errs.slug = translations['plugins.registerModal.validation.slugRequired'];
    else if (!SLUG_REGEX.test(slug)) errs.slug = translations['plugins.registerModal.validation.slugInvalid'];
    if (!description.trim()) errs.description = translations['plugins.registerModal.validation.descriptionRequired'];
    if (!connectorUrl.trim()) errs.connectorUrl = translations['plugins.registerModal.validation.connectorUrlRequired'];
    else if (!HTTPS_REGEX.test(connectorUrl)) errs.connectorUrl = translations['plugins.registerModal.validation.connectorUrlInvalid'];
    if (!author.trim()) errs.author = translations['plugins.registerModal.validation.authorRequired'];
    if (authorEmail && !EMAIL_REGEX.test(authorEmail)) errs.authorEmail = translations['plugins.registerModal.validation.emailInvalid'];
    if (supportEmail && !EMAIL_REGEX.test(supportEmail)) errs.supportEmail = translations['plugins.registerModal.validation.emailInvalid'];
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
      aria-label={translations['plugins.registerModal.ariaLabel']}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-bg-base rounded-lg shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold">{translations['plugins.registerModal.title']}</h2>
          <IconButton
            aria-label={translations['plugins.registerModal.closeAriaLabel']}
            icon={<span aria-hidden="true">✕</span>}
            onClick={onClose}
          />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {serverError && (
            // [theme-exception]: light text on dark red error bg
            <div className="bg-danger/10 border border-danger/40 rounded p-3 text-danger text-sm">
              {serverError === 'plugin-slug-taken'
                ? translations['plugins.registerModal.error.slugTaken']
                : serverError === 'invalid-connector-url'
                ? translations['plugins.registerModal.error.invalidConnectorUrl']
                : serverError}
            </div>
          )}

          {field(translations['plugins.registerModal.field.pluginName'], true,
            <input
              className={inputCls(errors.name)}
              placeholder={translations['plugins.registerModal.placeholder.pluginName']}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.name,
          )}

          {field(translations['plugins.registerModal.field.slug'], true,
            <input
              className={inputCls(errors.slug)}
              placeholder={translations['plugins.registerModal.placeholder.slug']}
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.slug,
          )}

          {field(translations['plugins.registerModal.field.description'], true,
            <textarea
              className={`${inputCls(errors.description)} resize-none`}
              rows={3}
              placeholder={translations['plugins.registerModal.placeholder.description']}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.description,
          )}

          {field(translations['plugins.registerModal.field.connectorUrl'], true,
            <input
              className={inputCls(errors.connectorUrl)}
              placeholder={translations['plugins.registerModal.placeholder.connectorUrl']}
              value={connectorUrl}
              onChange={(e) => setConnectorUrl(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.connectorUrl,
          )}

          {field(translations['plugins.registerModal.field.manifestUrl'], false,
            <input
              className={inputCls()}
              placeholder={translations['plugins.registerModal.placeholder.manifestUrl']}
              value={manifestUrl}
              onChange={(e) => setManifestUrl(e.target.value)}
              disabled={isSubmitting}
            />,
          )}

          {field(translations['plugins.registerModal.field.iconUrl'], false,
            <div className="flex gap-2 items-center">
              <input
                className={`${inputCls()} flex-1`}
                placeholder={translations['plugins.registerModal.placeholder.iconUrl']}
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

          {field(translations['plugins.registerModal.field.author'], true,
            <input
              className={inputCls(errors.author)}
              placeholder={translations['plugins.registerModal.placeholder.author']}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.author,
          )}

          {field(translations['plugins.registerModal.field.authorEmail'], false,
            <input
              type="email"
              className={inputCls(errors.authorEmail)}
              placeholder={translations['plugins.registerModal.placeholder.authorEmail']}
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.authorEmail,
          )}

          {field(translations['plugins.registerModal.field.supportEmail'], false,
            <input
              type="email"
              className={inputCls(errors.supportEmail)}
              placeholder={translations['plugins.registerModal.placeholder.supportEmail']}
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              disabled={isSubmitting}
            />,
            errors.supportEmail,
          )}

          {field(translations['plugins.registerModal.field.categories'], false,
            <div>
              <div className="flex flex-wrap gap-1 mb-1">
                {categories.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-blue-800 text-blue-200 text-xs rounded px-2 py-0.5">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeCategory(tag)}
                      className="hover:text-base leading-none"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                className={inputCls()}
                placeholder={translations['plugins.registerModal.placeholder.categories']}
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
            <label htmlFor="isPublic" className="text-sm text-subtle cursor-pointer">
              {translations['plugins.registerModal.field.isPublic']}
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
            {translations['plugins.registerModal.cancel']}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? translations['plugins.registerModal.registering'] : translations['plugins.registerModal.submit']}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RegisterPluginModal;
