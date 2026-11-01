/**
 * English message catalog: the source of truth for every user-facing string on the international guides (`/world`,
 * `/{lang}/world`) and the shared site chrome. Translators copy `{lang}.json` files key for key; anything missing from
 * a translation falls back to the English here.
 *
 * Rules for translators (and for anyone adding a key):
 *  - Keep every key exactly as written. Only change the text on the right.
 *  - Keep every `{placeholder}` (curly braces, same name) in the translation. Move it wherever your grammar needs it;
 *    placeholders are filled with numbers, names, dates or times when the page renders.
 *  - Keep `[label](/path)` links as they are: translate `label`, never the part in brackets after it.
 *  - No HTML, no code. A string is one plain sentence, phrase or label.
 *  - Strings are whole sentences on purpose, so the word order can follow your language. Do not split or merge them.
 *  - Plain numbers (435, 218) are inserted as digits. Dates and clock times arrive already formatted for your language.
 *  - Party initials in `margin.*` (D for Democrats, R for Republicans) may be changed if your language uses other ones.
 *
 * Do not add code, markup (other than links) or conditionals to strings. Optional clauses are separate keys
 * (`qa.what_a` / `qa.what_a_specials`) so each variant reads naturally.
 */
export const en = {
  // ---------------------------------------------------------------------------------------------------------------
  // Site chrome: header, footer, language menu. (Components are wired to these in a later pass.)
  // ---------------------------------------------------------------------------------------------------------------
  "nav.board": "Board",
  "nav.senate": "Senate",
  "nav.house": "House",
  "nav.governors": "Governors",
  "nav.states": "States & Measures",
  "nav.flashback": "Flashback",
  "nav.ballot": "My Ballot",
  "nav.method": "Method",
  /** Accessible name of the logo link. */
  "header.logo_label": "Big Board, 2026 midterms",
  /** Shown in the header before the polls open. */
  "header.election_day": "Election Day · Tue, Nov 3",
  "footer.about":
    "An independent, free-data tracker. Vote counts come from official state and county election offices; projections are our own model, not race calls by AP or any network.",
  /** Accessible name of the footer link group. */
  "footer.nav_label": "Footer",
  "footer.link_closing_times": "Poll closing times",
  "footer.link_explainers": "Explainers",
  "footer.link_methodology": "Methodology",
  "footer.link_sources": "Sources & licenses",
  "footer.link_source_code": "Source code",
  /** Accessible name prefix of the language button: "Language: Español". The button itself shows only the language name. */
  "menu.label": "Language",
  /** Shown under the language list on pages that have no translated version. */
  "menu.translate_note": "Other pages open in Google Translate",

  // ---------------------------------------------------------------------------------------------------------------
  // Shared by the world pages.
  // ---------------------------------------------------------------------------------------------------------------
  "crumb.home": "Home",
  "crumb.world": "Outside the US",
  /** Accessible name of the breadcrumb. */
  "crumb.label": "Breadcrumb",
  /** Between items in a plain list of names, e.g. "Georgia, Indiana, Kentucky". Keep the space after the comma, or use your language's list mark. */
  "list.separator": ", ",
  /** The four moments of election night, in the visitor's time zone and in each country's. */
  "moment.first": "First polls close",
  "moment.big": "Biggest wave",
  "moment.west": "West Coast closes",
  "moment.last": "Last polls close",
  /** {zone} = the visitor's time zone, e.g. "Europe/Madrid". */
  "your_time.heading": "In your time zone ({zone})",
  "section.catch_up": "Catch up in two minutes",
  "section.watch": "Races to watch",
  "section.watch_intro": "The Senate and governor races the forecasters rate as Toss-ups. Each page has the campaigns, polls and latest news.",
  "cta.live_board": "Open the live results board",
  /** {city} = the country's main city, e.g. "London". Column headings of the election-night table. */
  "table.local_time": "{city} time",
  "table.us_eastern": "US Eastern",
  "table.closes_in": "Polls close in",
  "table.races": "Races to watch",
  "table.none_close": "None rated close",
  /** Which office a race is for, shown beside the race name. */
  "office.senate": "Senate",
  "office.governor": "Governor",
  /** {state} = state name. Names of races (the "(special)" variant is a special election to fill a vacated seat). */
  "race.senate": "{state} Senate",
  "race.senate_special": "{state} Senate (special)",
  "race.governor": "{state} Governor",
  /** {state} = two-letter US state code, {rating} = a rating from `rating.*` below. */
  "watch.senate": "{state} Senate ({rating})",
  "watch.governor": "{state} governor ({rating})",
  /** Forecasters' ratings of how close a race is. */
  "rating.lean-d": "Lean D",
  "rating.tilt-d": "Tilt D",
  "rating.tossup": "Toss-up",
  "rating.tilt-r": "Tilt R",
  "rating.lean-r": "Lean R",
  /** {n} = a percentage-point margin such as "8.6". D = Democrats, R = Republicans. */
  "margin.d": "D+{n}",
  "margin.r": "R+{n}",
  "margin.even": "Even",
  "party.democrats": "Democrats",
  "party.republicans": "Republicans",

  // ---------------------------------------------------------------------------------------------------------------
  // The hub page: /world
  // ---------------------------------------------------------------------------------------------------------------
  /** Browser title and search-result headline. */
  "hub.title": "US Midterms 2026 Explained for the Rest of the World",
  /** Search-result snippet and social preview text. */
  "hub.description":
    "Catching up on the 2026 US midterm elections from outside America: what is being decided, who is favoured in the Senate and House, when results arrive in your time zone, and how to follow along live.",
  "hub.h1": "The 2026 US midterms, explained for the rest of the world",
  "hub.lede":
    "Americans vote on Tuesday, November 3. If you are following from outside the US, here is what is being decided, where the races stand, and when results arrive where you are.",
  "hub.section_countries": "Election night in your country's time",
  "hub.countries_intro": "Every poll-closing time on election night, converted to local time.",
  "hub.section_faq": "Questions people ask about the US midterms",

  // ---------------------------------------------------------------------------------------------------------------
  // A country page: /world/{country}
  // {country} = country name, {place} = the country with its preposition ("in Spain"), {city} = its main city,
  // {time} = a clock time and {day} = a weekday and date, both already formatted for the page's language.
  // ---------------------------------------------------------------------------------------------------------------
  "country.title": "US Midterm Election Results 2026: Times and Guide for {country}",
  "country.description":
    "When US midterm results come in {place}: polls start closing at {time} {city} time on {day}. What is being decided in the Senate and House, the races to watch, and how to follow live.",
  /** {country} = a short form of the country name ("UK"). */
  "country.h1": "US midterms 2026 in {country} time",
  /** {firstTime}/{lastTime} = clock times, {firstDay}/{lastDay} = weekday and date. */
  "country.lede":
    "Polls close from {firstTime} on {firstDay} to {lastTime} on {lastDay}, {city} time. Here is when results arrive {place}, what is being decided, and the races to watch.",
  "country.section_night": "Election night in {city} time",
  "country.night_note": "Results start within minutes of each closing. Close races, and states that count mail ballots slowly, can take days.",
  "country.section_faq": "Questions people {place} ask",
  "country.section_other": "Other countries",

  // ---------------------------------------------------------------------------------------------------------------
  // "Catch up in two minutes" (both page types). Each item has a bold lead-in and a body.
  // {house}, {senate}, {governors}, {chambers}, {measures}, {needD}, {needR}, {tossups} etc. are counts.
  // ---------------------------------------------------------------------------------------------------------------
  "catchup.decided_lead": "What is being decided.",
  /** {house} House seats, {senate} Senate seats (of 100), {governors} governors, {chambers} state legislative chambers, {measures} ballot measures. */
  "catchup.decided_body":
    "All {house} seats in the House of Representatives, {senate} of 100 Senate seats, {governors} governors, {chambers} state legislative chambers and {measures} statewide ballot measures. The president is not on the ballot.",
  "catchup.senate_lead": "The Senate.",
  /** {needD}/{needR} = seats each party needs among the {senate} on the ballot; {tossups} = Toss-up races. */
  "catchup.senate_body":
    "Republicans control it now. By the forecasters' consensus, Democrats need {needD} of the {senate} seats on the ballot to take control and Republicans need {needR} to keep it. {tossups} races are Toss-ups.",
  "catchup.house_lead": "The House.",
  /** {leanD} seats leaning Democratic, {leanR} leaning Republican, {tossups} Toss-ups. 218 is the majority. */
  "catchup.house_body": "218 seats make a majority. {leanD} seats are rated toward the Democrats, {leanR} toward the Republicans, and {tossups} are Toss-ups.",
  "catchup.mood_lead": "The national mood.",
  /** {margin} = the polling lead, e.g. "D+8.6" (see `margin.*`). The generic ballot asks which party people would vote for. */
  "catchup.mood_body": "The generic-ballot polling average, which asks which party people would vote for, is {margin}.",
  /** Same, with {date} = the date of the latest poll average, e.g. "Oct 30". */
  "catchup.mood_body_asof": "The generic-ballot polling average, which asks which party people would vote for, is {margin} as of {date}.",
  "catchup.echo_lead": "A historical echo.",
  /** {year} = a past presidential election year such as 2020. */
  "catchup.echo_body": "State by state, polling sits closest to the {year} presidential map. That is a comparison, not a forecast.",

  // ---------------------------------------------------------------------------------------------------------------
  // Questions and answers (also published as FAQ structured data for search engines).
  // {place}: "outside the US" on the hub page, or the country with its preposition ("in Spain").
  // ---------------------------------------------------------------------------------------------------------------
  "place.world": "outside the US",
  /** The clock used for times in answers: UTC on the hub page, a city's time on a country page ("London time"). */
  "clock.utc": "UTC",
  "clock.city": "{city} time",
  "qa.close_q": "What time do US polls close {place}?",
  /** {first}/{big}/{west}/{last} = date and time of those poll closings; {clock} = see `clock.*`; {states} = a few of the first states, comma separated. */
  "qa.close_a":
    "The first polls close at {first} {clock} ({states}). The biggest wave closes at {big}, polls on the West Coast close at {west}, and the last ones, in Alaska, close at {last}.",
  /** Used for {west} when the West Coast closing time is not in the data. */
  "qa.end_of_night": "the end of the night",
  "qa.results_q": "When will the US midterm results be known {place}?",
  "qa.results_a":
    "Results start arriving within minutes of each closing time, from {first} {clock}. Most races are projected overnight, which for readers {place} usually means by the following morning or day. Close races, and states that count mail ballots slowly, can take several days. The Big Board updates every minute through the night.",
  "qa.what_q": "What are the US midterm elections?",
  /** {senate} = Senate seats up of 100. */
  "qa.what_a":
    "Midterms are the national elections held halfway through a president's four-year term. On Tuesday, November 3, 2026, Americans elect all {house} members of the House of Representatives, {senate} of the 100 senators, {governors} state governors, {chambers} state legislative chambers, and vote on {measures} statewide ballot measures.",
  /** Same, when some of the Senate seats are special elections ({specials} of them). */
  "qa.what_a_specials":
    "Midterms are the national elections held halfway through a president's four-year term. On Tuesday, November 3, 2026, Americans elect all {house} members of the House of Representatives, {senate} of the 100 senators (including {specials} special elections), {governors} state governors, {chambers} state legislative chambers, and vote on {measures} statewide ballot measures.",
  "qa.president_q": "Is the US president on the ballot in 2026?",
  "qa.president_a":
    "No. The president was elected in 2024 and serves until January 2029. The midterms decide which party controls Congress, which writes laws, sets the budget and, in the Senate, approves treaties, judges and cabinet nominees.",
  "qa.matter_q": "Why do the US midterms matter outside America?",
  "qa.matter_a":
    "Congress controls US spending, including foreign aid and defence budgets, writes tariff and trade law, can impose or lift sanctions, and the Senate must approve treaties and ambassadors. A Congress controlled by the president's opponents can block much of the president's agenda for the next two years.",
  "qa.senate_q": "Who is expected to win the US Senate in 2026?",
  "qa.senate_a":
    "Republicans hold the Senate going in. By the consensus of the race forecasters, Democrats need {needD} of the {senate} seats on the ballot for control and Republicans need {needR}; {tossups} races are rated Toss-up.",
  "qa.house_q": "Who is expected to win the US House in 2026?",
  "qa.house_a": "{leanD} House seats are rated toward the Democrats, {leanR} toward the Republicans and {tossups} are Toss-ups; 218 seats make a majority.",
  /** Same, with the generic-ballot sentence. {margin} = e.g. "D+8.6"; {party} = `party.democrats` or `party.republicans`. */
  "qa.house_a_generic":
    "{leanD} House seats are rated toward the Democrats, {leanR} toward the Republicans and {tossups} are Toss-ups; 218 seats make a majority. The national generic-ballot polling average is {margin}, meaning {party} lead the question of which party people would vote for.",
  "qa.echo_q": "Which past US election does 2026 look like?",
  /** {year} = presidential election year; {gap} = average distance in points, e.g. "7.4". */
  "qa.echo_a":
    "State by state, current polling sits closest to the {year} presidential result, an average of {gap} points away. Polls can move and midterm electorates differ from presidential ones, so it is a comparison, not a forecast.",
  "qa.live_q": "How can I follow the US election results live {place}?",
  "qa.live_a":
    "The Big Board is free, needs no account and works on a phone. It shows the balance of power in the Senate and House, every race's count as states report it, and its own projections. It does not republish calls by US television networks or the Associated Press.",
  "qa.congress_q": "When does the new US Congress take office?",
  "qa.congress_a": "The new Congress is sworn in on January 3, 2027. Newly elected governors take office in January in most states.",

  // ---------------------------------------------------------------------------------------------------------------
  // Countries. Per country: the name, a short form for headings, the name with its preposition as it follows
  // "results come in ..." ("in Spain", "en España"), and the city whose clock the page uses.
  // ---------------------------------------------------------------------------------------------------------------
  "country.uk.name": "United Kingdom",
  "country.uk.short": "UK",
  "country.uk.in": "in the UK",
  "country.uk.city": "London",
  "country.ireland.name": "Ireland",
  "country.ireland.short": "Ireland",
  "country.ireland.in": "in Ireland",
  "country.ireland.city": "Dublin",
  "country.canada.name": "Canada",
  "country.canada.short": "Canada",
  "country.canada.in": "in Canada",
  "country.canada.city": "Toronto",
  /** The second city for countries with more than one time zone. */
  "country.canada.city_also": "Vancouver",
  "country.australia.name": "Australia",
  "country.australia.short": "Australia",
  "country.australia.in": "in Australia",
  "country.australia.city": "Sydney",
  "country.australia.city_also": "Perth",
  "country.new-zealand.name": "New Zealand",
  "country.new-zealand.short": "New Zealand",
  "country.new-zealand.in": "in New Zealand",
  "country.new-zealand.city": "Auckland",
  "country.india.name": "India",
  "country.india.short": "India",
  "country.india.in": "in India",
  "country.india.city": "New Delhi",
  "country.pakistan.name": "Pakistan",
  "country.pakistan.short": "Pakistan",
  "country.pakistan.in": "in Pakistan",
  "country.pakistan.city": "Karachi",
  "country.singapore.name": "Singapore",
  "country.singapore.short": "Singapore",
  "country.singapore.in": "in Singapore",
  "country.singapore.city": "Singapore",
  "country.philippines.name": "Philippines",
  "country.philippines.short": "Philippines",
  "country.philippines.in": "in the Philippines",
  "country.philippines.city": "Manila",
  "country.hong-kong.name": "Hong Kong",
  "country.hong-kong.short": "Hong Kong",
  "country.hong-kong.in": "in Hong Kong",
  "country.hong-kong.city": "Hong Kong",
  "country.japan.name": "Japan",
  "country.japan.short": "Japan",
  "country.japan.in": "in Japan",
  "country.japan.city": "Tokyo",
  "country.south-korea.name": "South Korea",
  "country.south-korea.short": "South Korea",
  "country.south-korea.in": "in South Korea",
  "country.south-korea.city": "Seoul",
  "country.uae.name": "United Arab Emirates",
  "country.uae.short": "United Arab Emirates",
  "country.uae.in": "in the UAE",
  "country.uae.city": "Dubai",
  "country.israel.name": "Israel",
  "country.israel.short": "Israel",
  "country.israel.in": "in Israel",
  "country.israel.city": "Jerusalem",
  "country.germany.name": "Germany",
  "country.germany.short": "Germany",
  "country.germany.in": "in Germany",
  "country.germany.city": "Berlin",
  "country.france.name": "France",
  "country.france.short": "France",
  "country.france.in": "in France",
  "country.france.city": "Paris",
  "country.spain.name": "Spain",
  "country.spain.short": "Spain",
  "country.spain.in": "in Spain",
  "country.spain.city": "Madrid",
  "country.italy.name": "Italy",
  "country.italy.short": "Italy",
  "country.italy.in": "in Italy",
  "country.italy.city": "Rome",
  "country.netherlands.name": "Netherlands",
  "country.netherlands.short": "Netherlands",
  "country.netherlands.in": "in the Netherlands",
  "country.netherlands.city": "Amsterdam",
  "country.south-africa.name": "South Africa",
  "country.south-africa.short": "South Africa",
  "country.south-africa.in": "in South Africa",
  "country.south-africa.city": "Johannesburg",
  "country.nigeria.name": "Nigeria",
  "country.nigeria.short": "Nigeria",
  "country.nigeria.in": "in Nigeria",
  "country.nigeria.city": "Lagos",
  "country.kenya.name": "Kenya",
  "country.kenya.short": "Kenya",
  "country.kenya.in": "in Kenya",
  "country.kenya.city": "Nairobi",
  "country.mexico.name": "Mexico",
  "country.mexico.short": "Mexico",
  "country.mexico.in": "in Mexico",
  "country.mexico.city": "Mexico City",
  "country.brazil.name": "Brazil",
  "country.brazil.short": "Brazil",
  "country.brazil.in": "in Brazil",
  "country.brazil.city": "São Paulo",

  // ---------------------------------------------------------------------------------------------------------------
  // US state names, as they appear in the election-night table.
  // ---------------------------------------------------------------------------------------------------------------
  "state.AL": "Alabama",
  "state.AK": "Alaska",
  "state.AZ": "Arizona",
  "state.AR": "Arkansas",
  "state.CA": "California",
  "state.CO": "Colorado",
  "state.CT": "Connecticut",
  "state.DE": "Delaware",
  "state.DC": "District of Columbia",
  "state.FL": "Florida",
  "state.GA": "Georgia",
  "state.HI": "Hawaii",
  "state.ID": "Idaho",
  "state.IL": "Illinois",
  "state.IN": "Indiana",
  "state.IA": "Iowa",
  "state.KS": "Kansas",
  "state.KY": "Kentucky",
  "state.LA": "Louisiana",
  "state.ME": "Maine",
  "state.MD": "Maryland",
  "state.MA": "Massachusetts",
  "state.MI": "Michigan",
  "state.MN": "Minnesota",
  "state.MS": "Mississippi",
  "state.MO": "Missouri",
  "state.MT": "Montana",
  "state.NE": "Nebraska",
  "state.NV": "Nevada",
  "state.NH": "New Hampshire",
  "state.NJ": "New Jersey",
  "state.NM": "New Mexico",
  "state.NY": "New York",
  "state.NC": "North Carolina",
  "state.ND": "North Dakota",
  "state.OH": "Ohio",
  "state.OK": "Oklahoma",
  "state.OR": "Oregon",
  "state.PA": "Pennsylvania",
  "state.RI": "Rhode Island",
  "state.SC": "South Carolina",
  "state.SD": "South Dakota",
  "state.TN": "Tennessee",
  "state.TX": "Texas",
  "state.UT": "Utah",
  "state.VT": "Vermont",
  "state.VA": "Virginia",
  "state.WA": "Washington",
  "state.WV": "West Virginia",
  "state.WI": "Wisconsin",
  "state.WY": "Wyoming",
};

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
