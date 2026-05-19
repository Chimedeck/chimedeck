import { describe, expect, it } from 'bun:test';
import { trelloError } from '../../../../../common/errors';
import { toTrelloErrorResponse } from '../../../../../middlewares/errorHandler';
import { serializeCard } from '../../../../../serializers/card';
import { serializeCustomField, serializeCustomFieldItem } from '../../../../../serializers/customField';
import { createCardFixture } from '../../../../../helpers/fixtures';

describe('trelloCompat custom fields adapter contract', () => {
  it('serializes custom field payload with Trello-compatible required keys and option shape', () => {
    const customField = serializeCustomField({
      id: 'cf-list-1',
      board_id: 'board-1',
      name: 'Priority',
      field_type: 'DROPDOWN',
      position: '49152',
      show_on_card: 'false' as unknown as boolean,
      options: [
        { id: 'opt-1', value: { text: 'High' }, color: 'green', pos: '16384' },
        { id: 'opt-2', value: 'Low', color: null },
      ],
    });

    expect(customField).toMatchObject({
      id: 'cf-list-1',
      idModel: 'board-1',
      modelType: 'board',
      fieldGroup: 'cf-list-1',
      name: 'Priority',
      type: 'list',
      pos: 49152,
      display: { cardFront: false },
    });
    expect(typeof customField.display.cardFront).toBe('boolean');
    expect(Array.isArray(customField.options)).toBe(true);
    expect(customField.options[0]).toMatchObject({
      id: 'opt-1',
      idCustomField: 'cf-list-1',
      value: { text: 'High' },
      color: 'green',
      pos: 16384,
    });
    expect(customField.options[1]?.idCustomField).toBe('cf-list-1');
    expect(typeof customField.options[1]?.pos).toBe('number');
  });

  it('serializes card custom field item values by field type in Trello-compatible shape', () => {
    const textItem = serializeCustomFieldItem({
      id: 'item-text-1',
      card_id: 'card-1',
      custom_field_id: 'cf-text-1',
      value_text: 'hello',
    }, 'TEXT');
    const numberItem = serializeCustomFieldItem({
      id: 'item-number-1',
      card_id: 'card-1',
      custom_field_id: 'cf-number-1',
      value_number: 12.5,
    }, 'NUMBER');
    const dateItem = serializeCustomFieldItem({
      id: 'item-date-1',
      card_id: 'card-1',
      custom_field_id: 'cf-date-1',
      value_date: 'not-a-date',
    }, 'DATE');
    const checkboxItem = serializeCustomFieldItem({
      id: 'item-checkbox-1',
      card_id: 'card-1',
      custom_field_id: 'cf-checkbox-1',
      value_checkbox: false,
    }, 'CHECKBOX');
    const listItem = serializeCustomFieldItem({
      id: 'item-list-1',
      card_id: 'card-1',
      custom_field_id: 'cf-list-1',
      value_option_id: 'opt-1',
    }, 'DROPDOWN');

    expect(textItem.value).toEqual({ text: 'hello' });
    expect(numberItem.value).toEqual({ number: '12.5' });
    expect(dateItem.value).toEqual({ date: null });
    expect(checkboxItem.value).toEqual({ checked: 'false' });
    expect(listItem.value).toEqual({ optionId: 'opt-1' });
    expect(listItem.idValue).toBe('opt-1');
  });

  it('normalizes card.customFieldItems to canonical typed value objects', () => {
    const card = serializeCard({
      ...createCardFixture(),
      customFieldItems: [
        {
          id: 'item-list-1',
          idCustomField: 'cf-list-1',
          idModel: 'card-1',
          modelType: 'card',
          value: { optionId: 'opt-1', text: 'ignored' },
        },
      ],
    });

    expect(card.customFieldItems).toEqual([
      {
        id: 'item-list-1',
        idCustomField: 'cf-list-1',
        idModel: 'card-1',
        modelType: 'card',
        idValue: 'opt-1',
        value: { optionId: 'opt-1' },
      },
    ]);
  });

  it('returns Trello-style adapter error envelope for known and unknown errors', async () => {
    const validationError = trelloError('invalid value for value', 400);
    const unexpectedError = toTrelloErrorResponse(new Error('unexpected custom field failure'));

    expect(validationError.status).toBe(400);
    expect(await validationError.json()).toEqual({
      message: 'invalid value for value',
      error: 'ERROR',
    });

    expect(unexpectedError.status).toBe(500);
    expect(await unexpectedError.json()).toEqual({
      message: 'unexpected custom field failure',
      error: 'ERROR',
    });
  });
});
