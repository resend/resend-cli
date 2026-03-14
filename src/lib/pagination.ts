export function buildPaginationOpts(
  limit: number,
  after?: string,
  before?: string,
) {
  return after ? { limit, after } : before ? { limit, before } : { limit };
}

export function printPaginationHint(list: {
  has_more: boolean;
  data: Array<{ id: string }>;
}): void {
  if (list.has_more && list.data.length > 0) {
    const last = list.data[list.data.length - 1];
    console.log(
      `\nMore results available. Use --after ${last.id} to fetch the next page.`,
    );
  }
}
