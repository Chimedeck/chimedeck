// Shared types for the board feature.

export type MonetizationType = 'pre-paid' | 'pay-to-paid';

export interface Board {
  id: string;
  workspace_id: string;
  title: string;
  state: 'ACTIVE' | 'ARCHIVED';
  monetization_type: MonetizationType | null;
  created_at: string;
}
