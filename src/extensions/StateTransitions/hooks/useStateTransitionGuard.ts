import { useCallback, useMemo } from 'react';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectLists } from '~/extensions/Board/slices/boardSlice';
import { selectStateTransitionsEnabled } from '~/slices/featureFlagsSlice';
import { useGetStateTransitionRulesQuery, type StateTransitionRule } from '../api';

export interface AllowedNextState {
  id: string;
  name: string;
}

export interface StateTransitionRejectionReason {
  fromListId: string;
  fromListName: string;
  toListId: string;
  toListName: string;
  allowedNextStates: AllowedNextState[];
}

export interface StateTransitionGuardSnapshot {
  isEnforcementActive: boolean;
  isRulesLoaded: boolean;
  listNameById: Map<string, string>;
  knownListIds: Set<string>;
  ruleByCurrentStateId: Map<string, StateTransitionRule>;
}

function getUniqueAllowedStateIds(rule: StateTransitionRule): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const nextId of rule.allowedNextStateIds) {
    const normalizedId = String(nextId ?? '').trim();
    if (!normalizedId || seen.has(normalizedId)) continue;
    seen.add(normalizedId);
    unique.push(normalizedId);
  }
  return unique;
}

export function buildStateTransitionGuardSnapshot({
  stateTransitionsFeatureEnabled,
  boardEnforced,
  rules,
  knownLists,
}: {
  stateTransitionsFeatureEnabled: boolean;
  boardEnforced: boolean;
  rules: StateTransitionRule[] | null;
  knownLists: Array<{ id: string; title: string }>;
}): StateTransitionGuardSnapshot {
  const listNameById = new Map<string, string>();
  for (const list of knownLists) {
    listNameById.set(list.id, list.title);
  }
  for (const rule of rules ?? []) {
    if (!listNameById.has(rule.currentStateId)) {
      listNameById.set(rule.currentStateId, rule.currentState);
    }
    rule.allowedNextStateIds.forEach((nextId, index) => {
      if (!listNameById.has(nextId)) {
        const nextName = rule.allowedNextStates[index] ?? nextId;
        listNameById.set(nextId, nextName);
      }
    });
  }

  return {
    isEnforcementActive: stateTransitionsFeatureEnabled && boardEnforced,
    isRulesLoaded: rules !== null,
    listNameById,
    knownListIds: new Set(knownLists.map((list) => list.id)),
    ruleByCurrentStateId: new Map((rules ?? []).map((rule) => [rule.currentStateId, rule])),
  };
}

export function canMoveWithSnapshot(
  snapshot: StateTransitionGuardSnapshot,
  fromListId: string,
  toListId: string
): boolean {
  if (fromListId === toListId) return true;
  if (!snapshot.isEnforcementActive) return true;
  if (!snapshot.isRulesLoaded) return true;
  if (!snapshot.knownListIds.has(fromListId)) return true;

  const rule = snapshot.ruleByCurrentStateId.get(fromListId);
  if (!rule) return false;
  return getUniqueAllowedStateIds(rule).includes(toListId);
}

export function getAllowedNextStatesWithSnapshot(
  snapshot: StateTransitionGuardSnapshot,
  fromListId: string
): AllowedNextState[] {
  const rule = snapshot.ruleByCurrentStateId.get(fromListId);
  if (!rule) return [];
  return getUniqueAllowedStateIds(rule).map((id) => ({
    id,
    name: snapshot.listNameById.get(id) ?? id,
  }));
}

export function isListLockedWithSnapshot(
  snapshot: StateTransitionGuardSnapshot,
  listId: string
): boolean {
  if (!snapshot.isEnforcementActive) return false;
  if (!snapshot.isRulesLoaded) return false;
  if (!snapshot.knownListIds.has(listId)) return false;
  const rule = snapshot.ruleByCurrentStateId.get(listId);
  if (!rule) return true;
  return getUniqueAllowedStateIds(rule).length === 0;
}

export function getRejectionReasonWithSnapshot(
  snapshot: StateTransitionGuardSnapshot,
  fromListId: string,
  toListId: string
): StateTransitionRejectionReason {
  return {
    fromListId,
    fromListName: snapshot.listNameById.get(fromListId) ?? fromListId,
    toListId,
    toListName: snapshot.listNameById.get(toListId) ?? toListId,
    allowedNextStates: getAllowedNextStatesWithSnapshot(snapshot, fromListId),
  };
}

export function useStateTransitionGuard(boardId: string) {
  const stateTransitionsFeatureEnabled = useAppSelector(selectStateTransitionsEnabled);
  const listsById = useAppSelector(selectLists);
  const knownLists = useMemo(
    () => Object.values(listsById).map((list) => ({ id: list.id, title: list.title })),
    [listsById]
  );
  const {
    data: rulesData,
    isFetching,
    isLoading,
  } = useGetStateTransitionRulesQuery(boardId, {
    skip: boardId.trim().length === 0 || !stateTransitionsFeatureEnabled,
  });

  const snapshot = useMemo(
    () =>
      buildStateTransitionGuardSnapshot({
        stateTransitionsFeatureEnabled,
        boardEnforced: rulesData?.enabled ?? false,
        rules: rulesData?.rules ?? null,
        knownLists,
      }),
    [knownLists, rulesData?.enabled, rulesData?.rules, stateTransitionsFeatureEnabled]
  );

  const canMove = useCallback(
    (fromListId: string, toListId: string): boolean =>
      canMoveWithSnapshot(snapshot, fromListId, toListId),
    [snapshot]
  );

  const getRejectionReason = useCallback(
    (fromListId: string, toListId: string): StateTransitionRejectionReason =>
      getRejectionReasonWithSnapshot(snapshot, fromListId, toListId),
    [snapshot]
  );

  const isListLocked = useCallback(
    (listId: string): boolean => isListLockedWithSnapshot(snapshot, listId),
    [snapshot]
  );

  return {
    isEnforcementActive: snapshot.isEnforcementActive,
    isLoading: stateTransitionsFeatureEnabled && (isLoading || isFetching),
    canMove,
    getRejectionReason,
    isListLocked,
  };
}
