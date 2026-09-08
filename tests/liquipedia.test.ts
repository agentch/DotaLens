import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchInput, parseAchievementsHtml, parsePlayerWikitext, parseTeamHistoryHtml, parseTotalWinningsHtml } from "../src/lib/liquipedia.ts";

test("parses core player fields from Liquipedia wikitext", () => {
  const player = parsePlayerWikitext(42618, "Nisha", "2026-08-11T18:16:05Z", `{{Infobox player
|id=Nisha
|ids=DEBIL, Hubert
|name=Michał Jankowski
|birth_date=2000-09-28
|country=Poland
|status=Active
|roles=mid,carry
}}`);

  assert.equal(player.handle, "Nisha");
  assert.equal(player.realName, "Michał Jankowski");
  assert.deepEqual(player.aliases, ["DEBIL", "Hubert"]);
  assert.deepEqual(player.roles, ["mid", "carry"]);
  assert.equal(player.birthDate?.toISOString(), "2000-09-28T00:00:00.000Z");
});

test("normalizes common special characters in player IDs", () => {
  assert.equal(normalizeSearchInput("  Miracle—  "), "Miracle-");
  assert.equal(normalizeSearchInput("Kuku’s ID"), "Kuku's ID");
});

test("removes Liquipedia maintenance comments from player fields", () => {
  const player = parsePlayerWikitext(42453, "GH", "2026-08-25T10:58:18Z", `{{Infobox player
|id=GH<!--DPC2023,2024-->
|name=Maroun Merhej<!--keep source note hidden-->
}}`);

  assert.equal(player.handle, "GH");
  assert.equal(player.realName, "Maroun Merhej");
});

test("parses personal total winnings from the player infobox", () => {
  assert.equal(parseTotalWinningsHtml('<div class="infobox-cell-2 infobox-description">Approx. Total Winnings:</div><div style="width:50%">$6,484,491</div>'), "$6,484,491");
});

test("parses team history and current team", () => {
  const rows = parseTeamHistoryHtml(`<tr><td class="th-mono" style="x">2018-09-11 &#8212; 2022-12-01</td><td><a href="/dota2/Team_Secret" title="Team Secret">Secret</a></td></tr>
  <tr><td class="th-mono" style="x">2022-12-09 &#8212; <b>Present</b></td><td><a href="/dota2/Team_Liquid" title="Team Liquid">Liquid</a></td></tr>`);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].teamName, "Team Secret");
  assert.equal(rows[0].endDate?.toISOString(), "2022-12-01T00:00:00.000Z");
  assert.equal(rows[1].teamName, "Team Liquid");
  assert.equal(rows[1].isCurrent, true);
});

test("parses an achievement row", () => {
  const rows = parseAchievementsHtml(`<tr class="table2&#95;&#95;row--body">
    <td>2024-09-15</td><td data-sort-value="1">1st</td><td>Tier 1</td><td></td>
    <td data-sort-value="The International 2024"><a href="/dota2/The_International/2024">TI 2024</a></td>
    <td data-sort-value="Team Liquid">Liquid</td><td>3&#160;&#58;&#160;0</td><td>GG</td><td>$1,249,445</td>
  </tr>`);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].tournament, "The International 2024");
  assert.equal(rows[0].placement, "1");
  assert.equal(rows[0].teamName, "Team Liquid");
  assert.equal(rows[0].result, "3 : 0");
  assert.equal(rows[0].prize, "$1,249,445");
});
