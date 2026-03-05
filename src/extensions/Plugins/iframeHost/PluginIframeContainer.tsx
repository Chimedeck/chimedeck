// PluginIframeContainer — mounts one hidden <iframe> per active board plugin
// and provides the PluginBridgeContext to the subtree so UI injection points
// (CardPluginBadges, CardPluginButtons, etc.) can request capability results.
//
// Also owns modal/popup state — when a plugin calls t.modal() or t.popup() the
// corresponding overlay is rendered here via createPortal.
//
// Mounted once at the root of BoardPage alongside the Kanban columns.

import { useEffect, useState, useCallback } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  fetchBoardPluginsThunk,
  selectBoardPlugins,
} from '../containers/PluginDashboardPage/PluginDashboardPage.duck';
import { PluginBridgeContext, usePluginBridge } from './usePluginBridge';
import PluginIframeHost from './PluginIframeHost';
import PluginModal, { type PluginModalState } from '../modals/PluginModal';
import PluginPopup, { type PluginPopupState } from '../modals/PluginPopup';

interface Props {
  boardId: string;
}

const defaultModal: PluginModalState = {
  open: false,
  url: '',
  title: '',
  fullscreen: false,
  pluginId: '',
};

const defaultPopup: PluginPopupState = {
  open: false,
  url: '',
  title: '',
  pluginId: '',
  x: 100,
  y: 100,
};

const PluginIframeContainerInner = ({ boardId }: Props) => {
  const boardPlugins = useAppSelector(selectBoardPlugins);
  const [modal, setModal] = useState<PluginModalState>(defaultModal);
  const [popup, setPopup] = useState<PluginPopupState>(defaultPopup);

  const handleOpenModal = useCallback((state: Omit<PluginModalState, 'open'>) => {
    setModal({ ...state, open: true });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModal((m) => ({ ...m, open: false }));
  }, []);

  const handleUpdateModal = useCallback(
    (update: Partial<Pick<PluginModalState, 'title' | 'fullscreen' | 'accentColor'>>) => {
      setModal((m) => ({ ...m, ...update }));
    },
    [],
  );

  const handleOpenPopup = useCallback((state: Omit<PluginPopupState, 'open'>) => {
    setPopup({ ...state, open: true });
  }, []);

  const handleClosePopup = useCallback(() => {
    setPopup((p) => ({ ...p, open: false }));
  }, []);

  const bridge = usePluginBridge({
    boardId,
    plugins: boardPlugins,
    onOpenModal: handleOpenModal,
    onCloseModal: handleCloseModal,
    onUpdateModal: handleUpdateModal,
    onOpenPopup: handleOpenPopup,
    onClosePopup: handleClosePopup,
  });

  return (
    <PluginBridgeContext.Provider value={bridge}>
      {/* Hidden iframes — one per active plugin */}
      {boardPlugins.map((bp) => (
        <PluginIframeHost key={bp.plugin.id} boardPlugin={bp} boardId={boardId} />
      ))}
      {/* Plugin overlays — rendered via createPortal so z-index works correctly */}
      <PluginModal modal={modal} onClose={handleCloseModal} />
      <PluginPopup popup={popup} onClose={handleClosePopup} />
    </PluginBridgeContext.Provider>
  );
};

const PluginIframeContainer = ({ boardId }: Props) => {
  const dispatch = useAppDispatch();

  // Load active plugins when the board opens; refresh whenever boardId changes.
  useEffect(() => {
    if (boardId) {
      dispatch(fetchBoardPluginsThunk({ boardId }));
    }
  }, [dispatch, boardId]);

  return <PluginIframeContainerInner boardId={boardId} />;
};

export default PluginIframeContainer;
