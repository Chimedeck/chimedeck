export class ReferencedCardError extends Error {
  readonly response: Response;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ReferencedCardError';
    this.response = Response.json({ name: code, data: { message } }, { status });
  }
}
