"use client";

import { useMemo } from "react";
import { ExternalLinkIcon } from "lucide-react";
import type { RaceMeta } from "@/data/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/board/status-badge";
import { Pct } from "@/components/board/num";
import { cn } from "@/lib/utils";
import { ballotpediaUrl, measureDescription, yesNo, type LiveRace } from "./states-lib";

export function BallotMeasures({ measures, live, stateNames }: { measures: RaceMeta[]; live: Map<string, LiveRace>; stateNames: Map<string, string> }) {
  const groups = useMemo(() => {
    const by = new Map<string, RaceMeta[]>();
    for (const m of measures) {
      const arr = by.get(m.state) ?? [];
      arr.push(m);
      by.set(m.state, arr);
    }
    return [...by.entries()]
      .map(([state, list]) => ({ state, name: stateNames.get(state) ?? state, list: list.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [measures, stateNames]);

  const liveCount = measures.filter((m) => live.has(m.id)).length;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Ballot measures</CardTitle>
        <p className="text-xs text-muted-foreground">
          <span className="tnum">{measures.length}</span> statewide measures in <span className="tnum">{groups.length}</span> states.{" "}
          {liveCount > 0 ? (
            <>
              Live Yes/No counts for <span className="tnum">{liveCount}</span>; the rest link out to Ballotpedia.
            </>
          ) : (
            "No live measure feeds yet; each state links out to Ballotpedia."
          )}
        </p>
      </CardHeader>
      <CardContent>
        <Table className="text-xs md:text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground">Measure</TableHead>
              <TableHead className="text-xs text-muted-foreground text-right">Yes</TableHead>
              <TableHead className="text-xs text-muted-foreground text-right">No</TableHead>
              <TableHead className="text-xs text-muted-foreground text-right">% in</TableHead>
              <TableHead className="text-xs text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <GroupRows key={g.state} group={g} live={live} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GroupRows({ group, live }: { group: { state: string; name: string; list: RaceMeta[] }; live: Map<string, LiveRace> }) {
  const url = ballotpediaUrl(group.name);
  return (
    <>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={5} className="py-1.5">
          <div className="flex items-center gap-3">
            <span className="display text-base font-semibold">{group.name}</span>
            <span className="text-[11px] text-muted-foreground tnum">
              {group.list.length} measure{group.list.length === 1 ? "" : "s"}
            </span>
            <a href={url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              Ballotpedia <ExternalLinkIcon className="size-3" />
            </a>
          </div>
        </TableCell>
      </TableRow>
      {group.list.map((m) => {
        const lr = live.get(m.id);
        const yn = yesNo(lr);
        const desc = measureDescription(m);
        const p = lr?.pctExpected;
        const leading = yn?.yes != null && yn?.no != null ? (yn.yes > yn.no ? "yes" : yn.no > yn.yes ? "no" : null) : null;
        return (
          <TableRow key={m.id}>
            <TableCell className="whitespace-normal max-w-xl align-top">
              <div className="font-medium leading-snug">{m.name}</div>
              {desc && desc !== m.name && <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{desc}</div>}
            </TableCell>
            {yn ? (
              <>
                <TableCell className={cn("text-right align-top", leading === "yes" && "font-semibold")}>
                  <Pct value={yn.yes} />
                </TableCell>
                <TableCell className={cn("text-right align-top", leading === "no" && "font-semibold")}>
                  <Pct value={yn.no} />
                </TableCell>
                <TableCell className="text-right align-top">
                  <Pct value={p == null ? undefined : p <= 1 ? p * 100 : p} digits={0} />
                </TableCell>
                <TableCell className="align-top">
                  <StatusBadge status={lr?.status ?? "not_started"} />
                </TableCell>
              </>
            ) : (
              <TableCell colSpan={4} className="align-top text-right">
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  No live feed — see Ballotpedia <ExternalLinkIcon className="size-3" />
                </a>
              </TableCell>
            )}
          </TableRow>
        );
      })}
    </>
  );
}
