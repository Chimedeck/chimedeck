// Page for accepting a workspace invite via a token URL parameter.
// Accessible without authentication so unauthenticated users can preview the invite.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Page from '~/components/Page';
import FooterContainer from '~/containers/FooterContainer/FooterContainer';
import TopbarContainer from '~/containers/TopbarContainer/TopbarContainer';
import LayoutSingleColumn from '~/layout/LayoutSingleColumn';
import { inspectInvite, acceptInvite, type Invite } from '../../api';
import RoleBadge from '../../components/RoleBadge';

// TODO: replace with real api instance from context/store extras once wired in.
declare const api: Parameters<typeof inspectInvite>[0]['api'];

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; invite: Invite }
  | { status: 'accepting' }
  | { status: 'success' }
  | { status: 'error'; errorName: string };

const AcceptInvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', errorName: 'invite-not-found' });
      return;
    }
    inspectInvite({ api, token })
      .then((res) => setState({ status: 'ready', invite: res.data }))
      .catch((err) => {
        const errorName =
          err?.response?.data?.error?.code ?? 'unknown-error';
        setState({ status: 'error', errorName });
      });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setState({ status: 'accepting' });
    try {
      await acceptInvite({ api, token });
      setState({ status: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { code?: string } } } };
      const errorName =
        e?.response?.data?.error?.code ?? 'unknown-error';
      setState({ status: 'error', errorName });
    }
  };

  const bodyContent = (() => {
    switch (state.status) {
      case 'loading':
        return <p className="text-muted">Validating invite…</p>;

      case 'ready': {
        const { invite } = state;
        return (
          <div className="space-y-4">
            <p className="text-base">
              You have been invited to join{' '}
              <strong>{invite.workspaceName}</strong> as{' '}
              <RoleBadge role={invite.role} />.
            </p>
            <p className="text-sm text-muted">
              Invite expires: {new Date(invite.expiresAt).toLocaleString()}
            </p>
            <button
              onClick={handleAccept}
              className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover"
            >
              Accept Invitation
            </button>
          </div>
        );
      }

      case 'accepting':
        return <p className="text-muted">Accepting invite…</p>;

      case 'success':
        return (
          <p className="font-medium text-success">
            You have joined the workspace.
          </p>
        );

      case 'error': {
        const message = (() => {
          switch (state.errorName) {
            case 'invite-expired':
              return 'This invite has expired.';
            case 'invite-already-used':
              return 'This invite has already been used.';
            default:
              return 'Failed to process invite. Please try again.';
          }
        })();
        return (
          <p role="alert" className="text-danger">
            {message}
          </p>
        );
      }
    }
  })();

  return (
    <Page title="Accept Invite">
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        contentClassName="p-6"
      >
        <div className="mx-auto max-w-md space-y-4">
          <h1 className="text-2xl font-bold">Accept Invite</h1>
          {bodyContent}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default AcceptInvitePage;
