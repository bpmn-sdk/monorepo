let _seq = 0;

export function genId(prefix: string): string {
	return `${prefix}_${(++_seq).toString(36)}`;
}
