import { ExternalLink, LinkRow, RowList } from "./link-row";
import { VOTE_GOV, VOTE_ORG } from "./links";

const STEPS = [
  { href: VOTE_ORG.checkRegistration, title: "Check your registration", desc: "Confirm you're registered at the address where you live now." },
  { href: VOTE_ORG.register, title: "Register to vote", desc: "Deadlines have passed in most states, but many allow same-day registration." },
  { href: VOTE_ORG.pollingPlace, title: "Find your polling place", desc: "See where you vote on Election Day." },
  { href: VOTE_ORG.voterId, title: "Voter ID rules", desc: "Find out which ID, if any, your state asks for at the polls." },
];

export function GetReady() {
  return (
    <section aria-labelledby="get-ready" className="space-y-5">
      <div className="space-y-2">
        <h2 id="get-ready" className="section-title">
          Get ready to vote
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          These tools come from <strong className="font-semibold text-foreground">Vote.org</strong>, a nonpartisan 501(c)(3) nonprofit
          that helps Americans register and vote. Each link opens Vote.org in a new tab.
        </p>
      </div>

      <RowList label="Voter tools from Vote.org">
        {STEPS.map((s) => (
          <LinkRow key={s.href} href={s.href} title={s.title} desc={s.desc} external />
        ))}
      </RowList>

      <div className="space-y-3 text-[15px] leading-relaxed text-ink-muted">
        <p>
          <strong className="font-semibold text-foreground">Not registered yet?</strong> With Election Day this close, most
          states&apos; registration deadlines have passed. Many states still let you register and vote on the same day,
          including on Election Day itself. The rules differ by state, so{" "}
          <ExternalLink href={VOTE_ORG.register}>check yours on Vote.org</ExternalLink>.
        </p>
        <p>
          <strong className="font-semibold text-foreground">Official source:</strong>{" "}
          <ExternalLink href={VOTE_GOV}>Vote.gov</ExternalLink> is the U.S. government&apos;s voter registration site, with links to
          every state&apos;s election office.
        </p>
      </div>
    </section>
  );
}
