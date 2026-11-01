import { ExternalLink, LinkRow, RowList } from "./link-row";
import { VOTE_GOV, VOTE_ORG } from "./links";

const STEPS = [
  { href: VOTE_ORG.checkRegistration, title: "Check your registration", desc: "Make sure your registration shows your current address." },
  { href: VOTE_ORG.register, title: "Register to vote", desc: "Most states' deadlines have passed. Many still allow same-day registration." },
  { href: VOTE_ORG.pollingPlace, title: "Find your polling place", desc: "Find out where you vote on Election Day." },
  { href: VOTE_ORG.voterId, title: "Voter ID rules", desc: "Check whether your state requires ID at the polls, and which kind." },
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
          that helps Americans register and vote. Each link opens in a new tab.
        </p>
      </div>

      <RowList label="Voter tools from Vote.org">
        {STEPS.map((s) => (
          <LinkRow key={s.href} href={s.href} title={s.title} desc={s.desc} external />
        ))}
      </RowList>

      <div className="space-y-3 text-[15px] leading-relaxed text-ink-muted">
        <p>
          <strong className="font-semibold text-foreground">Not registered yet?</strong> Election Day is close, and most
          states&apos; registration deadlines have passed. Many states still let you register and vote the same day, including on
          Election Day itself. Rules differ by state. <ExternalLink href={VOTE_ORG.register}>Check yours on Vote.org</ExternalLink>.
        </p>
        <p>
          <strong className="font-semibold text-foreground">Official source:</strong>{" "}
          <ExternalLink href={VOTE_GOV}>Vote.gov</ExternalLink> is the official U.S. government site for voter registration. It links to
          every state&apos;s election office.
        </p>
      </div>
    </section>
  );
}
