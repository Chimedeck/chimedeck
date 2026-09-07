# Trello Adapter Normalization Matrix

## Iteration 1 (Sprint 149) - Actions serializer gap analysis

| endpoint | required keys | current keys | missing keys | status |
| --- | --- | --- | --- | --- |
| `GET /actions/{id}` | `id`, `idMemberCreator`, `data`, `type`, `date`, `limits`, `memberCreator` | Returns action object from `serializeCommentAction` / `serializeActivityAction` with all required top-level keys | None (for required top-level keys) | PASS |
| `PUT /actions/{id}` | Same shape as `GET /actions/{id}` after update | Implemented for comment actions (root `PUT`), returns serialized comment action with required keys | Not supported for non-comment actions (returns text-unsupported error) | PARTIAL |
| `DELETE /actions/{id}` | `{}` | Implemented for comment actions (root `DELETE`), returns `{}` | Not supported for non-comment actions (returns text-unsupported error) | PARTIAL |
| `GET /actions/{id}/{field}` | Field-only payload; unsupported field returns Trello-style error | Only `GET /actions/{id}/text` exists and returns scalar text; other fields fall through to not-found | Generic field projection handler for arbitrary supported fields | PARTIAL |
| `GET /actions/{id}/board` | `id`, `name`, `desc`, `closed`, `idOrganization`, `prefs`, `shortLink`, `shortUrl`, `url` | Uses `serializeBoard`; includes all required minimum keys | None (for required minimum keys) | PASS |
| `GET /actions/{id}/card` | `id`, `name`, `desc`, `closed`, `idBoard`, `idList`, `idMembers`, `idLabels`, `badges`, `shortLink`, `shortUrl`, `url` | Uses `loadTrelloCardById` -> normalized card serializer with required minimum keys | None (for required minimum keys) | PASS |
| `GET /actions/{id}/list` | `id`, `name`, `idBoard`, `closed`, `pos` | Uses `serializeList`; includes required minimum keys | None (for required minimum keys) | PASS |
| `GET /actions/{id}/member` | `id`, `fullName`, `username`, `initials`, `memberType`, `avatarHash`, `avatarUrl`, `url` | Uses `serializeMember`; includes required minimum keys | None (for required minimum keys) | PASS |
| `GET /actions/{id}/memberCreator` | Same as member payload | Uses `serializeMember`; includes required minimum keys | None (for required minimum keys) | PASS |
| `GET /actions/{id}/organization` | `id`, `name`, `displayName`, `desc`, `prefs`, `url` | No handler in actions router | Entire endpoint missing | MISMATCH |
| `PUT /actions/{id}/text` | Updated Trello-compatible comment action object | Implemented (`subPath === "text"` shares root `PUT` path); returns serialized comment action | None for comment actions | PASS |
| `GET /actions/{idAction}/reactions` | Per item: `id`, `idMember`, `idModel`, `emoji` (optional `member`) | No `GET /reactions` handler (only `POST /reactions`) | Entire endpoint missing | MISMATCH |
| `POST /actions/{idAction}/reactions` | Created reaction object with stable `id` | Returns `id`, `idMember`, `idModel`, `member`, `emoji`, `shortName` | None for required keys | PASS |
| `GET /actions/{idAction}/reactions/{id}` | Single reaction object in list-item shape | No `GET /reactions/{id}` handler | Entire endpoint missing | MISMATCH |
| `DELETE /actions/{idAction}/reactions/{id}` | `{}` | Implemented and returns `{}` | None | PASS |
| `GET /actions/{idAction}/reactionsSummary` | Trello-compatible grouped summary with counts | Returns object keyed by emoji with `{ count, memberIds[] }` | Exact Trello summary envelope may differ; needs contract validation | PARTIAL |

## Iteration 2 (Sprint 149) - Actions contract test scaffolding

| endpoint | contract smoke coverage | status |
| --- | --- | --- |
| `GET /actions/{id}` | Added smoke contract tests for comment and activity action payload shapes using deterministic fixtures and required-key assertions | PASS |

## Iteration 2 (Sprint 150 Phase 1) - Actions normalization execution

| endpoint | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /actions/{id}` | `id`, `idMemberCreator`, `data`, `type`, `date`, `limits`, `memberCreator` | Serializer now normalizes payload input to object-only data and preserves full required key set for comment/activity actions | PASS |
| `PUT /actions/{id}` | Same shape as `GET /actions/{id}` for mutable comment actions | Comment update responses are validated by contract tests; non-comment mutation remains rejected as required by Trello rule | PASS |
| `DELETE /actions/{id}` | `{}` for mutable comment actions | Comment delete returns Trello-compatible `{}`; non-comment delete remains rejected as expected | PASS |
| `GET /actions/{id}/{field}` | Field-only response; unsupported field returns Trello-style error | Added generic top-level action field projection handler (`id`, `type`, `date`, `memberCreator`, etc.) with Trello-style invalid-field error envelope | PASS |

## Iteration 3 (Sprint 150 Phase 2) - Actions sub-resources and reactions normalization

| endpoint | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /actions/{id}/board` | `id`, `name`, `desc`, `closed`, `idOrganization`, `prefs`, `shortLink`, `shortUrl`, `url` | Existing board sub-resource continues to use normalized `serializeBoard` payload shape | PASS |
| `GET /actions/{id}/card` | `id`, `name`, `desc`, `closed`, `idBoard`, `idList`, `idMembers`, `idLabels`, `badges`, `shortLink`, `shortUrl`, `url` | Existing card sub-resource continues to use normalized card serializer via `loadTrelloCardById` | PASS |
| `GET /actions/{id}/list` | `id`, `name`, `idBoard`, `closed`, `pos` | Existing list sub-resource continues to use normalized `serializeList` with numeric `pos` | PASS |
| `GET /actions/{id}/member` | `id`, `fullName`, `username`, `initials`, `memberType`, `avatarHash`, `avatarUrl`, `url` | Existing member sub-resource continues to use normalized `serializeMember` | PASS |
| `GET /actions/{id}/memberCreator` | Same as member payload | Existing memberCreator sub-resource continues to use normalized `serializeMember` | PASS |
| `GET /actions/{id}/organization` | `id`, `name`, `displayName`, `desc`, `prefs`, `url` | Added organization sub-resource handler and wired it to normalized `serializeOrganization` | PASS |
| `GET /actions/{idAction}/reactions` | Per item: `id`, `idMember`, `idModel`, `emoji` | Added reactions list endpoint returning normalized reaction array from `serializeReaction` | PASS |
| `POST /actions/{idAction}/reactions` | Created reaction object with stable `id`, Trello reaction keys | Normalized create response through `serializeReaction` (`id`, `idMember`, `idModel`, `emoji`) | PASS |
| `GET /actions/{idAction}/reactions/{id}` | Single reaction object in list-item shape | Added reaction detail endpoint with id/emoji fallback lookup and normalized response | PASS |
| `DELETE /actions/{idAction}/reactions/{id}` | `{}` | Existing delete behavior retained and extracted into reaction module with permission checks | PASS |
| `GET /actions/{idAction}/reactionsSummary` | Trello-compatible grouping with counts | Summary now normalized through reaction serializer (`emoji`, `idModel`, `count`, `idMembers`) keyed by emoji | PASS |

## Iteration 4 (Sprint 151 Phase 1) - Board serializer normalization

| endpoint | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /boards/{id}` | `id`, `name`, `desc`, `closed`, `idMemberCreator`, `idOrganization`, `prefs`, `labelNames`, `memberships`, `shortLink`, `shortUrl`, `url`, `starred`, `subscribed`, `limits` | Board serializer audited and contract-tested for required Trello keys; serializer now prefers persisted `short_id` for `shortLink`/`shortUrl` while preserving Trello-compatible defaults (`idTags`, `powerUps`, `limits`, prefs booleans/background fields, full `labelNames`) | PASS |
| `GET /boards/{id}/{field}` | Field-only response semantics | Existing board field projection only supports a subset (`name`, `desc`, `closed`, `idOrganization`, `url`) and returns not-found for other fields | PARTIAL |

## Iteration 5 (Sprint 151 Phase 2) - Card serializer normalization

| endpoint | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /cards/{id}` | `id`, `name`, `desc`, `closed`, `idBoard`, `idList`, `idMembers`, `idLabels`, `idChecklists`, `badges`, `due`, `dueComplete`, `start`, `pos`, `shortLink`, `shortUrl`, `url`, `cover`, `limits` | `serializeCard` now guarantees Trello-compatible scalar/object defaults for card payload keys (including `badges` and `cover` sub-keys), preserves numeric `pos`, emits `nodeId`, `start`, `dueReminder`, and normalizes `idChecklists`/`idLabels`/`idMembers` as string arrays; covered by `cards.contract.test.ts` | PASS |
| `GET /cards/{id}/{field}` | Field-only response semantics | No generic card field-projection route is implemented; adapter currently handles specific sub-resources (e.g. `/board`, `/list`, `/checklists`) but not Trello-style arbitrary field lookups | MISMATCH |
| Card nested resources (`/cards/{id}/comments|actions|checklists|members|labels|customFieldItems`) | Must reuse normalized serializers for nested entities | Nested resources exist and are partially normalized, but final serializer parity still depends on remaining Sprint 151/152 normalization work (lists/checklists/members/custom fields) | PARTIAL |

## Iteration 6 (Sprint 151 Phase 3) - List and Checklist serializer normalization

| endpoint | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /lists/{id}` | `id`, `name`, `idBoard`, `closed`, `pos`, `subscribed` (+ optional `softLimit`, `limits`) | `serializeList` now guarantees Trello-compatible list defaults (`nodeId`, `softLimit: null`, `status: null`, `subscribed: false`, `limits: {}`) with numeric `pos` and normalized ids | PASS |
| `GET /checklists/{id}` | `id`, `name`, `idBoard`, `idCard`, `pos`, `checkItems` | `serializeChecklist` emits numeric checklist `pos` and normalized top-level checklist keys with `checkItems` payload passthrough | PASS |
| CheckItem payload (`/checklists/*/checkItems*`) | `id`, `idChecklist`, `idCard`, `name`, `pos`, `state`, `due`, `idMember` (+ `dueReminder`) | `serializeCheckItem` enforces Trello state strings (`complete`/`incomplete`), numeric `pos`, and normalized assignee mapping into `idMember` with `dueReminder: null` default | PASS |

## Iteration 7 (Sprint 151 Phase 4) - Label serializer normalization and cross-serializer audit

| endpoint | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /labels/{id}` | `id`, `idBoard`, `name`, `color` | `serializeLabel` now remains the canonical source for label shape and enforces Trello key mapping for standalone label payloads | PASS |
| Board-scoped embedded labels | Embedded label objects should match standalone serializer shape | Added `serializeBoardLabels` helper to ensure board-scoped label objects normalize through the same canonical label serializer path | PASS |
| Card-scoped embedded labels (`labels` on card payloads) | Embedded labels must match standalone label shape in card responses | `serializeCard` now normalizes embedded labels through `serializeEmbeddedLabel` and always emits canonical `id/idBoard/name/color` objects | PASS |
| Action-scoped embedded labels (`data.label`, `data.labels`) | Embedded labels in action payloads should match standalone label shape | `serializeActivityAction` / `serializeAction` now normalize label payload blocks using canonical label serialization with board-id fallback | PASS |
| `GET /boards/{id}` | Board core payload + field projection semantics | Core board payload remains normalized; generic board field projection support is still partial | PARTIAL |
| `GET /cards/{id}/{field}` | Field-only card response semantics | Generic card field projection route is still missing for arbitrary Trello fields | MISMATCH |

## Iteration 9 (Sprint 152 Phase 2) - Organization serializer normalization

| endpoint | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /organizations/{id}` | `id`, `name`, `displayName`, `desc`, `prefs`, `url`, `memberships`, `idMemberCreator` | `serializeOrganization` now emits canonical Trello organization shape with normalized prefs defaults, website defaulting, `nodeId`, `powerUps`, and `billableMemberCount` from membership count | PASS |
| `GET /organizations/{id}/{field}` | Field-only scalar/object in Trello format | Field projection now resolves from canonical serialized organization payload to keep field values aligned with organization serializer output | PASS |
| `GET /organizations/{id}/boards` | Returns normalized board objects | Existing route continues to serialize via canonical `serializeBoard` | PASS |
| `GET /organizations/{id}/members` | Returns normalized member objects | Existing route continues to serialize via canonical `serializeMember` | PASS |
| `GET /organizations/{id}/memberships*` | Returns Trello membership shape | Existing route continues to serialize memberships via canonical organization membership mapping | PASS |

## Iteration 10 (Sprint 152 Phase 3) - Search response normalization

| endpoint | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /search` | `boards`, `cards`, `members`, `organizations`; each item uses normalized serializer shape | Added canonical search response serializer to guarantee all four arrays are always present and wired search router through existing normalized board/card/member/organization serializers | PASS |
| `GET /search` model type filtering | Accept model type filters with Trello-compatible singular/plural variants | Search router now parses both `modelType` and `modelTypes` params with singular/plural aliases (`board/boards`, `card/cards`, `member/members`, `organization/organizations`) | PASS |
| `GET /search/members` | Array of normalized member objects | Search members response now flows through search serializer helper and contract tests verify normalized member payload shape | PASS |

## Iteration 11 (Sprint 152 Phase 4) - CustomFields and adapter error envelope normalization

| endpoint / concern | required keys / behavior | implementation note | status |
| --- | --- | --- | --- |
| `GET /members/{id}`, `GET /members/me` | Member payload keys (`bio`, `confirmed`, `status`, `activityBlocked`, `nonPublic*`, `products`, `idEnterprise`, `idMemberReferrer`, `avatarHash`) | Member serializer normalization from Sprint 152 Phase 1 remains unchanged and compatible | PASS |
| `GET /organizations/{id}` (+ organization sub-resources/field projections) | Trello organization key set and normalized prefs defaults | Sprint 152 Phase 2 organization serializer and field projection normalization remains canonical | PASS |
| `GET /search`, `GET /search/members` | Four-array search envelope + normalized entity serializers + singular/plural model type parsing | Sprint 152 Phase 3 search normalization remains canonical | PASS |
| `/customFields/*` core payload | `id`, `idModel`, `modelType`, `fieldGroup`, `name`, `type`, `pos`, `display`, `options` | `serializeCustomField` now enforces stable `fieldGroup=id`, robust boolean coercion for `display.cardFront`, numeric `pos`, and list option normalization | PASS |
| `/customFields/*` option payload | `id`, `idCustomField`, `value`, `color`, `pos` | Option serializer now preserves `idCustomField`, emits Trello text value shape, and guarantees numeric `pos` from stored option position or deterministic fallback | PASS |
| `/cards/{id}/customFieldItems` item payload | `id`, `idCustomField`, `idModel`, `modelType`, typed `value` | `serializeCustomFieldItem` now normalizes invalid dates safely and maintains typed value mapping; card serializer now canonicalizes item values for embedded payload consistency | PASS |
| Adapter error envelope (`/trello/1/*`) | Error responses follow Trello envelope `{ message, error }` | Added trelloCompat error-handler middleware wrapping the root adapter router, and normalized disabled-path response through shared trello error helper | PASS |
