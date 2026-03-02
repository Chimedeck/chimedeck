// Hashes a plaintext password with bcrypt (cost factor 12).
// Uses Bun's built-in Bun.password API — no external bcrypt package needed.
export async function hashPassword({ password }: { password: string }): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 });
}
