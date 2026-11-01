/** "senate:TX" -> "senate-tx", "house:TX-15" -> "house-tx-15", "ballot:CA-x" -> "ballot-ca-x". */
export const raceSlug = (meta: { id: string }): string => meta.id.replace(":", "-").toLowerCase();

/** The race's own page: candidates, campaigns, polls and news. */
export const raceHref = (id: string): string => `/race/${raceSlug({ id })}`;
