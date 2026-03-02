// CreateWorkspaceModal — Radix Dialog for creating a new workspace.
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  createWorkspaceThunk,
  selectCreateWorkspaceInProgress,
  selectCreateWorkspaceError,
} from '../duck/workspaceDuck';
import translations from '../translations/en.json';

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateWorkspaceModal({ open, onOpenChange }: CreateWorkspaceModalProps) {
  const dispatch = useAppDispatch();
  const inProgress = useAppSelector(selectCreateWorkspaceInProgress);
  const error = useAppSelector(selectCreateWorkspaceError);

  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await dispatch(createWorkspaceThunk({ name: name.trim() }));
    if (createWorkspaceThunk.fulfilled.match(result)) {
      setName('');
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl focus:outline-none"
          aria-describedby="create-workspace-description"
        >
          <Dialog.Title className="mb-1 text-lg font-bold text-white">
            {translations['CreateWorkspaceModal.title']}
          </Dialog.Title>
          <p id="create-workspace-description" className="mb-5 text-sm text-slate-400">
            {translations['CreateWorkspaceModal.description']}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="workspace-name" className="mb-1.5 block text-sm font-medium text-slate-300">
                {translations['CreateWorkspaceModal.nameLabel']}
              </label>
              <input
                id="workspace-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={translations['CreateWorkspaceModal.namePlaceholder']}
                required
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <p className="mb-3 text-sm text-red-400">
                {translations['CreateWorkspaceModal.errorGeneric']}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                {translations['CreateWorkspaceModal.cancelButton']}
              </button>
              <button
                type="submit"
                disabled={inProgress || !name.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {inProgress
                  ? translations['CreateWorkspaceModal.submitting']
                  : translations['CreateWorkspaceModal.submitButton']}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
