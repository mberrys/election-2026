/** Voter tools from Vote.org, a nonpartisan 501(c)(3) nonprofit, plus the official government sources. */
export const VOTE_ORG = {
  checkRegistration: "https://www.vote.org/am-i-registered-to-vote/",
  register: "https://www.vote.org/register-to-vote/",
  pollingPlace: "https://www.vote.org/polling-place-locator/",
  voterId: "https://www.vote.org/voter-id-laws/",
} as const;

export const VOTE_GOV = "https://vote.gov";

/** House.gov's district finder (ZIP code lookup), for voters who don't know their congressional district. */
export const FIND_YOUR_REP = "https://www.house.gov/representatives/find-your-representative";
