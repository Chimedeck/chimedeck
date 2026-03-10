import { v7 as uuidv7 } from 'uuid';

/** Generate a new time-ordered UUID v7 for use as a database entity ID. */
export function generateId(): string {
  return uuidv7();
}
