import assert from "node:assert/strict";
import test from "node:test";
import { parseTeamMembersHtml } from "../src/lib/liquipedia-team.ts";

test("parses active players and coaching staff", () => {
  const rows = parseTeamMembersHtml(`<h3><span id="Active_Roster">Active Roster</span></h3><table><tr><th>ID</th></tr><tr><td><a href="/dota2/Nisha" title="Nisha">Nisha</a></td><td>Michał Jankowski</td><td>2</td><td>2022-12-09</td></tr></table><h3>Coaching Staff</h3><table><tr><td><a href="/dota2/Blitz" title="Blitz">Blitz</a></td><td>William Lee</td><td>Coach</td><td>2019-10-12</td></tr></table><h2>Timeline</h2>`);
  assert.deepEqual(rows.map(({ handle, role }) => ({ handle, role })), [{ handle: "Nisha", role: "2" }, { handle: "Blitz", role: "Coach" }]);
});
