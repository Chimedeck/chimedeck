import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { sanitizeText } from '../../../../../common/sanitize';
import type { ActionHandler, ActionContext } from '../../../common/types';

type FieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'CHECKBOX' | 'DROPDOWN';

interface DropdownOption {
  id: string;
  label?: string;
  color?: string;
}

const fieldTypeSchema = z.enum(['TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'DROPDOWN']);

const configSchema = z
  .object({
    fieldId: z.string().min(1),
    fieldType: fieldTypeSchema,
    valueText: z.string().optional(),
    valueNumber: z.number().optional(),
    valueDate: z.string().min(1).optional(),
    valueCheckbox: z.boolean().optional(),
    valueOptionId: z.string().min(1).optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.fieldType === 'TEXT' && typeof cfg.valueText !== 'string') {
      ctx.addIssue({
        code: 'custom',
        path: ['valueText'],
        message: 'valueText is required for TEXT fields',
      });
    }
    if (cfg.fieldType === 'NUMBER' && typeof cfg.valueNumber !== 'number') {
      ctx.addIssue({
        code: 'custom',
        path: ['valueNumber'],
        message: 'valueNumber is required for NUMBER fields',
      });
    }
    if (cfg.fieldType === 'DATE' && typeof cfg.valueDate !== 'string') {
      ctx.addIssue({
        code: 'custom',
        path: ['valueDate'],
        message: 'valueDate is required for DATE fields',
      });
    }
    if (cfg.fieldType === 'CHECKBOX' && typeof cfg.valueCheckbox !== 'boolean') {
      ctx.addIssue({
        code: 'custom',
        path: ['valueCheckbox'],
        message: 'valueCheckbox is required for CHECKBOX fields',
      });
    }
    if (cfg.fieldType === 'DROPDOWN' && typeof cfg.valueOptionId !== 'string') {
      ctx.addIssue({
        code: 'custom',
        path: ['valueOptionId'],
        message: 'valueOptionId is required for DROPDOWN fields',
      });
    }
  });

function parseFieldOptions(raw: unknown): DropdownOption[] {
  if (Array.isArray(raw)) return raw as DropdownOption[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as DropdownOption[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toValueColumns(config: z.infer<typeof configSchema>): Record<string, unknown> {
  const base: Record<string, unknown> = {
    value_text: null,
    value_number: null,
    value_date: null,
    value_checkbox: null,
    value_option_id: null,
  };

  if (config.fieldType === 'TEXT') {
    return { ...base, value_text: sanitizeText(config.valueText ?? '') };
  }

  if (config.fieldType === 'NUMBER') {
    return { ...base, value_number: config.valueNumber ?? null };
  }

  if (config.fieldType === 'DATE') {
    const d = new Date(config.valueDate as string);
    if (Number.isNaN(d.getTime())) throw new Error('value-date-invalid');
    return { ...base, value_date: d.toISOString() };
  }

  if (config.fieldType === 'CHECKBOX') {
    return { ...base, value_checkbox: config.valueCheckbox ?? false };
  }

  return { ...base, value_option_id: config.valueOptionId ?? null };
}

export const cardUpdateCustomFieldValueAction: ActionHandler = {
  type: 'card.update_custom_field_value',
  label: 'Change custom fields',
  category: 'card',
  configSchema,
  async execute({ action, automation, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);

    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const list = await trx('lists').where({ id: card.list_id }).first();
    if (list?.board_id !== automation.board_id) throw new Error('card-on-different-board');

    const field = await trx('custom_fields')
      .where({ id: config.fieldId, board_id: automation.board_id })
      .first();
    if (!field) throw new Error('custom-field-not-found');

    const dbFieldType = String(field.field_type) as FieldType;
    if (dbFieldType !== config.fieldType) throw new Error('custom-field-type-mismatch');

    if (config.fieldType === 'DROPDOWN') {
      const options = parseFieldOptions(field.options);
      const valid = options.some((opt) => opt.id === config.valueOptionId);
      if (!valid) throw new Error('custom-field-option-not-found');
    }

    const valueColumns = toValueColumns(config);

    const existing = await trx('card_custom_field_values')
      .where({ card_id: cardId, custom_field_id: config.fieldId })
      .first();

    if (existing) {
      await trx('card_custom_field_values')
        .where({ card_id: cardId, custom_field_id: config.fieldId })
        .update(valueColumns);
      return;
    }

    await trx('card_custom_field_values').insert({
      id: randomUUID(),
      card_id: cardId,
      custom_field_id: config.fieldId,
      ...valueColumns,
    });
  },
};
