// Compares a plaintext password against a bcrypt hash.
export async function verifyPassword({
  password,
  hash,
}: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return Bun.password.verify(password, hash);
}
