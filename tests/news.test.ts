import assert from "node:assert/strict";
import test from "node:test";
import { parseTransfers } from "../src/lib/news.ts";

test("parses a Liquipedia transfer row", () => {
  const rows = parseTransfers(`<div class="divRow mainpage-transfer-from-team">
    <div class="divCell Date">2026-09-06</div>
    <div class="divCell Name"><span class="name"><a href="/dota2/Bonkers" title="Bonkers">Bonkers</a></span></div>
    <div class="divCell Team OldTeam"><a href="/dota2/Team_Falcons" title="Team Falcons">Falcons</a></div>
    <div class="divCell Icon">→</div>
    <div class="divCell Team NewTeam"><span>None</span></div>
    <div class="divCell Ref"><a class="external text" href="https://example.com/source">source</a></div>
  </div>`);

  assert.deepEqual(rows, [{ date: "2026-09-06", players: ["Bonkers"], previous: "Team Falcons", current: "None", sourceUrl: "https://example.com/source" }]);
});

test("marks inactive to active changes within the same team", () => {
  const rows = parseTransfers(`<div class="divRow mainpage-transfer-neutral">
    <div class="divCell Date">2026-09-07</div>
    <div class="divCell Name"><span class="name"><a title="Scofield">Scofield</a></span></div>
    <div class="divCell Team OldTeam"><span class="team-template-team-icon"><a title="PlayTime">PlayTime</a></span><br>Inactive</div>
    <div class="divCell Icon">→</div>
    <div class="divCell Team NewTeam"><span class="team-template-team-icon"><a title="PlayTime">PlayTime</a></span></div>
    <div class="divCell Ref"></div>
  </div>`);
  assert.equal(rows[0].statusChange, "inactive_to_active");
});

test("marks active to inactive changes within the same team", () => {
  const rows = parseTransfers(`<div class="divRow mainpage-transfer-neutral">
    <div class="divCell Date">2026-09-08</div>
    <div class="divCell Name"><span class="name"><a title="Player">Player</a></span></div>
    <div class="divCell Team OldTeam"><span class="team-template-team-icon"><a title="Example Team">Example Team</a></span></div>
    <div class="divCell Icon">→</div>
    <div class="divCell Team NewTeam"><span class="team-template-team2-icon"><a title="Example Team">Example Team</a></span><br>Inactive</div>
    <div class="divCell Ref"></div>
  </div>`);
  assert.equal(rows[0].statusChange, "active_to_inactive");
  assert.equal(rows[0].currentRole, "Inactive");
});

test("keeps coach and stand-in roles", () => {
  const rows = parseTransfers(`<div class="divRow mainpage-transfer-neutral">
    <div class="divCell Date">2026-09-08</div>
    <div class="divCell Name"><span class="name"><a title="Person">Person</a></span></div>
    <div class="divCell Team OldTeam"><a title="Example Team">Example</a><br>Coach</div>
    <div class="divCell Icon">→</div>
    <div class="divCell Team NewTeam"><a title="Example Team">Example</a><br>Stand-in</div>
    <div class="divCell Ref"></div>
  </div>`);
  assert.equal(rows[0].previousRole, "Coach");
  assert.equal(rows[0].currentRole, "Stand-In");
});
