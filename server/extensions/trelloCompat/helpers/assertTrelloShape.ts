type TrelloEntityType =
  | 'action-comment'
  | 'action-activity'
  | 'board'
  | 'card'
  | 'list'
  | 'checklist'
  | 'checkitem'
  | 'member';

const REQUIRED_MEMBER_KEYS = [
  'id',
  'fullName',
  'username',
  'initials',
  'memberType',
  'avatarHash',
  'avatarUrl',
  'url',
] as const;

const REQUIRED_BOARD_LABEL_KEYS = [
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'blue',
  'sky',
  'lime',
  'pink',
  'black',
] as const;

const REQUIRED_BOARD_PREF_KEYS = [
  'permissionLevel',
  'calendarFeedEnabled',
  'background',
  'backgroundImage',
  'backgroundTile',
  'backgroundBrightness',
  'canBePublic',
  'canBeEnterprise',
  'canBeOrg',
  'canBePrivate',
] as const;

const REQUIRED_TOP_LEVEL_KEYS: Record<TrelloEntityType, readonly string[]> = {
  'action-comment': ['id', 'idMemberCreator', 'data', 'type', 'date', 'limits', 'memberCreator'],
  'action-activity': ['id', 'idMemberCreator', 'data', 'type', 'date', 'limits', 'memberCreator'],
  board: ['id', 'name', 'desc', 'closed', 'idOrganization', 'prefs', 'shortLink', 'shortUrl', 'url'],
  card: ['id', 'name', 'desc', 'closed', 'idBoard', 'idList', 'idMembers', 'idLabels', 'badges', 'shortLink', 'shortUrl', 'url'],
  list: ['id', 'name', 'idBoard', 'closed', 'pos', 'nodeId', 'softLimit', 'status', 'subscribed', 'limits'],
  checklist: ['id', 'name', 'idBoard', 'idCard', 'pos', 'checkItems'],
  checkitem: ['id', 'idChecklist', 'idCard', 'name', 'pos', 'state', 'due', 'dueReminder', 'idMember'],
  member: REQUIRED_MEMBER_KEYS,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function missingKeys(payload: Record<string, unknown>, requiredKeys: readonly string[]): string[] {
  return requiredKeys.filter((key) => !(key in payload));
}

function assertString(entity: TrelloEntityType, payload: Record<string, unknown>, key: string): void {
  if (typeof payload[key] !== 'string') {
    throw new Error(`[${entity}] ${key} must be a string`);
  }
}

export function assertTrelloShape(entity: TrelloEntityType, payload: unknown): void {
  if (!isObject(payload)) {
    throw new Error(`[${entity}] expected payload object`);
  }

  const missingTopLevel = missingKeys(payload, REQUIRED_TOP_LEVEL_KEYS[entity]);
  if (missingTopLevel.length > 0) {
    throw new Error(`[${entity}] missing keys: ${missingTopLevel.join(', ')}`);
  }

  if (entity === 'action-comment' || entity === 'action-activity') {
    assertString(entity, payload, 'id');
    assertString(entity, payload, 'idMemberCreator');
    assertString(entity, payload, 'type');
    assertString(entity, payload, 'date');
    if (!isObject(payload['data'])) throw new Error(`[${entity}] data must be an object`);
    if (!isObject(payload['limits'])) throw new Error(`[${entity}] limits must be an object`);
    if (Number.isNaN(Date.parse(payload['date'] as string))) {
      throw new Error(`[${entity}] date must be an ISO-8601 string`);
    }
  }

  if (entity === 'action-comment' || entity === 'action-activity') {
    const memberCreator = payload['memberCreator'];
    if (!isObject(memberCreator)) {
      throw new Error(`[${entity}] memberCreator must be an object`);
    }

    const missingMemberKeys = missingKeys(memberCreator, REQUIRED_MEMBER_KEYS);
    if (missingMemberKeys.length > 0) {
      throw new Error(`[${entity}] memberCreator missing keys: ${missingMemberKeys.join(', ')}`);
    }
  }

  if (entity === 'board') {
    assertString(entity, payload, 'id');
    assertString(entity, payload, 'name');
    assertString(entity, payload, 'desc');
    assertString(entity, payload, 'idOrganization');
    assertString(entity, payload, 'shortLink');
    assertString(entity, payload, 'shortUrl');
    assertString(entity, payload, 'url');
    if (typeof payload['closed'] !== 'boolean') {
      throw new Error('[board] closed must be a boolean');
    }
    if (!isObject(payload['limits'])) {
      throw new Error('[board] limits must be an object');
    }

    const labelNames = payload['labelNames'];
    if (!isObject(labelNames)) {
      throw new Error('[board] labelNames must be an object');
    }
    const missingLabelNames = missingKeys(labelNames, REQUIRED_BOARD_LABEL_KEYS);
    if (missingLabelNames.length > 0) {
      throw new Error(`[board] labelNames missing keys: ${missingLabelNames.join(', ')}`);
    }

    const prefs = payload['prefs'];
    if (!isObject(prefs)) {
      throw new Error('[board] prefs must be an object');
    }
    const missingPrefs = missingKeys(prefs, REQUIRED_BOARD_PREF_KEYS);
    if (missingPrefs.length > 0) {
      throw new Error(`[board] prefs missing keys: ${missingPrefs.join(', ')}`);
    }

    if (entity === 'list') {
      assertString(entity, payload, 'id');
      assertString(entity, payload, 'name');
      assertString(entity, payload, 'idBoard');
      assertString(entity, payload, 'nodeId');
      if (typeof payload['closed'] !== 'boolean') {
        throw new Error('[list] closed must be a boolean');
      }
      if (typeof payload['subscribed'] !== 'boolean') {
        throw new Error('[list] subscribed must be a boolean');
      }
      if (typeof payload['pos'] !== 'number') {
        throw new Error('[list] pos must be a number');
      }
      if (payload['softLimit'] !== null) {
        throw new Error('[list] softLimit must be null');
      }
      if (payload['status'] !== null) {
        throw new Error('[list] status must be null');
      }
      if (!isObject(payload['limits'])) {
        throw new Error('[list] limits must be an object');
      }
    }

    if (entity === 'checklist') {
      assertString(entity, payload, 'id');
      assertString(entity, payload, 'name');
      assertString(entity, payload, 'idBoard');
      assertString(entity, payload, 'idCard');
      if (typeof payload['pos'] !== 'number') {
        throw new Error('[checklist] pos must be a number');
      }
      if (!Array.isArray(payload['checkItems'])) {
        throw new Error('[checklist] checkItems must be an array');
      }
    }

    if (entity === 'checkitem') {
      assertString(entity, payload, 'id');
      assertString(entity, payload, 'idChecklist');
      assertString(entity, payload, 'idCard');
      assertString(entity, payload, 'name');
      if (typeof payload['pos'] !== 'number') {
        throw new Error('[checkitem] pos must be a number');
      }
      if (payload['state'] !== 'complete' && payload['state'] !== 'incomplete') {
        throw new Error('[checkitem] state must be complete or incomplete');
      }
      if (payload['due'] !== null && typeof payload['due'] !== 'string') {
        throw new Error('[checkitem] due must be null or string');
      }
      if (payload['dueReminder'] !== null && typeof payload['dueReminder'] !== 'number') {
        throw new Error('[checkitem] dueReminder must be null or number');
      }
      if (payload['idMember'] !== null && typeof payload['idMember'] !== 'string') {
        throw new Error('[checkitem] idMember must be null or string');
      }
    }
  }
}
