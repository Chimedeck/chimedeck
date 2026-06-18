import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

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

export const cardCustomFieldValueUpdatedTrigger: TriggerHandler = {
  type: 'card.custom_field_value_updated',
  label: 'Update custom fields value',
  configSchema,
  matches(event, config) {
    if (event.type !== 'card.custom_field_value_updated') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;

    const { fieldId, fieldType } = parsed.data;
    if (event.payload['fieldId'] !== fieldId) return false;
    if (event.payload['fieldType'] !== fieldType) return false;

    const newValue = event.payload['newValue'];

    if (fieldType === 'TEXT') return newValue === parsed.data.valueText;
    if (fieldType === 'NUMBER') return Number(newValue) === parsed.data.valueNumber;
    if (fieldType === 'DATE') {
      if (typeof parsed.data.valueDate !== 'string' || typeof newValue !== 'string') return false;
      return String(newValue).slice(0, 10) === parsed.data.valueDate.slice(0, 10);
    }
    if (fieldType === 'CHECKBOX') return newValue === parsed.data.valueCheckbox;
    return newValue === parsed.data.valueOptionId;
  },
};
