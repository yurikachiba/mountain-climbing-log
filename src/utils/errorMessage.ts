/** unknown な catch 値から安全にエラーメッセージを取り出す */
export function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
