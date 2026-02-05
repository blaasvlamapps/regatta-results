const { schedule } = require("@netlify/functions");
const cheerio = require("cheerio");
const { Pool } = require("pg");

function normalizeConnectionString(value) {
  if (!value) return value;
  const url = new URL(value);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode && sslmode.toLowerCase() === "require") {
    if (!url.searchParams.has("uselibpqcompat")) {
      url.searchParams.set("uselibpqcompat", "true");
    }
  }
  return url.toString();
}

const pool = new Pool({
  connectionString: normalizeConnectionString(
    process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL
  ),
  ssl: { rejectUnauthorized: false },
});

const USER_AGENT = "regatta-results-bot/1.0";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseDateText(value) {
  const match = String(value || "").match(
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/
  );
  if (!match) return null;
  const day = Number(match[1]);
  const monthName = match[2].toLowerCase();
  const year = Number(match[3]);
  const monthMap = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  const month = monthMap[monthName];
  if (!month) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseTimeText(value) {
  const match = String(value || "").match(/(\d{1,2}:\d{2}:\d{2})/);
  return match ? match[1] : null;
}

function findEventTable($) {
  const tables = $("table").toArray();
  for (const table of tables) {
    const headers = $(table)
      .find("th")
      .map((_, th) => $(th).text().trim())
      .get()
      .map(normalizeHeader);
    if (headers.includes("event id") && headers.includes("event name")) {
      return $(table);
    }
  }
  return $("table").first();
}

function extractTable($) {
  const tables = $("table").toArray();
  let bestTable = null;
  let bestRowCount = 0;
  for (const table of tables) {
    const rowCount = $(table).find("tr td").length;
    if (rowCount > bestRowCount) {
      bestRowCount = rowCount;
      bestTable = table;
    }
  }
  if (!bestTable) return { headers: [], rows: [] };

  const $table = $(bestTable);
  const headerRow = $table.find("tr").filter((_, tr) => {
    return $(tr).find("th").length > 0;
  });
  const headers = headerRow
    .first()
    .find("th")
    .map((_, th) => $(th).text().trim())
    .get();

  const rows = [];
  $table.find("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    if (!cells.length) return;
    const row = {};
    const usedHeaders =
      headers.length >= cells.length
        ? headers
        : cells.map((_, idx) => `col_${idx + 1}`);
    usedHeaders.forEach((header, idx) => {
      row[header || `col_${idx + 1}`] = cells[idx] || "";
    });
    rows.push(row);
  });

  return { headers, rows };
}

function pickFirst(row, candidates) {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const match = keys.find(
      (key) => normalizeHeader(key) === normalizeHeader(candidate)
    );
    if (match && row[match]) return row[match];
  }
  return null;
}

function inferAthlete(row) {
  const direct = pickFirst(row, [
    "athlete",
    "name",
    "competitor",
    "crew",
    "rower",
  ]);
  if (direct) return direct;
  const first = pickFirst(row, ["first name", "firstname"]);
  const last = pickFirst(row, ["surname", "last name", "lastname"]);
  if (first || last) return `${first || ""} ${last || ""}`.trim();
  return null;
}

function inferSchool(row) {
  return pickFirst(row, ["school", "club", "team"]);
}

function inferPosition(row) {
  return pickFirst(row, ["pos", "position", "place", "rank"]);
}

function inferLane(row) {
  return pickFirst(row, ["lane"]);
}

function inferCrew(row) {
  return pickFirst(row, ["crew", "boat", "entry", "club", "school"]);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return response.text();
}

async function upsertEventAndRace(client, regatta, row) {
  const eventId = Number(row.eventId);
  if (!eventId) return null;

  const eventResult = await client.query(
    `INSERT INTO regatta_events (regatta_uuid, event_id, event_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (regatta_uuid, event_id)
     DO UPDATE SET event_name = EXCLUDED.event_name
     RETURNING id`,
    [regatta.uuid, eventId, row.eventName]
  );
  const eventPk = eventResult.rows[0].id;

  const raceResult = await client.query(
    `INSERT INTO regatta_races
      (event_id, race_label, race_date, race_time, status, progression, details_url, details_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (event_id, race_label)
     DO UPDATE SET
       race_date = EXCLUDED.race_date,
       race_time = EXCLUDED.race_time,
       status = EXCLUDED.status,
       progression = EXCLUDED.progression,
       details_url = EXCLUDED.details_url,
       details_type = EXCLUDED.details_type
     RETURNING id, details_url, details_type`,
    [
      eventPk,
      row.raceLabel,
      row.raceDate,
      row.raceTime,
      row.status,
      row.progression,
      row.detailsUrl,
      row.detailsType,
    ]
  );

  return raceResult.rows[0];
}

async function handleLaneDraw(client, raceId, detailsUrl) {
  const exists = await client.query(
    "SELECT 1 FROM regatta_lane_draw_rows WHERE race_id = $1 LIMIT 1",
    [raceId]
  );
  if (exists.rowCount > 0) return;

  const html = await fetchHtml(detailsUrl);
  const $ = cheerio.load(html);
  const { rows } = extractTable($);
  if (!rows.length) return;

  for (const row of rows) {
    const lane = inferLane(row);
    const crew = inferCrew(row);
    const school = inferSchool(row);
    await client.query(
      `INSERT INTO regatta_lane_draw_rows (race_id, lane, crew, school, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [raceId, lane, crew, school, row]
    );
  }
}

async function handleResults(client, raceId, detailsUrl) {
  const exists = await client.query(
    "SELECT 1 FROM regatta_results_rows WHERE race_id = $1 LIMIT 1",
    [raceId]
  );
  if (exists.rowCount > 0) return;

  const html = await fetchHtml(detailsUrl);
  const $ = cheerio.load(html);
  const { rows } = extractTable($);
  if (!rows.length) return;

  for (const row of rows) {
    const position = inferPosition(row);
    const athlete = inferAthlete(row);
    const school = inferSchool(row);
    await client.query(
      `INSERT INTO regatta_results_rows (race_id, position, athlete, school, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [raceId, position, athlete, school, row]
    );
  }
}

async function processRegatta(client, regatta) {
  const html = await fetchHtml(regatta.url);
  const $ = cheerio.load(html);
  const table = findEventTable($);

  const events = [];
  table.find("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    if (cells.length < 7) return;

    const detailsCell = $(tr).find("td").last();
    const link = detailsCell.find("a").attr("href");
    const linkText = detailsCell.find("a").text().trim().toLowerCase();
    const detailsUrl = link ? new URL(link, regatta.url).toString() : null;
    const detailsType = linkText.includes("lane")
      ? "lane_draw"
      : linkText.includes("result")
      ? "results"
      : null;

    events.push({
      eventId: cells[0],
      eventName: cells[1],
      raceLabel: cells[2],
      raceDate: parseDateText(cells[3]),
      raceTime: parseTimeText(cells[4]),
      status: cells[5],
      progression: cells[6],
      detailsUrl,
      detailsType,
    });
  });

  for (const row of events) {
    const race = await upsertEventAndRace(client, regatta, row);
    if (!race || !race.details_url || !race.details_type) continue;

    if (race.details_type === "lane_draw") {
      await handleLaneDraw(client, race.id, race.details_url);
    } else if (race.details_type === "results") {
      await handleResults(client, race.id, race.details_url);
    }

    await sleep(250);
  }
}

exports.handler = schedule("*/10 * * * *", async () => {
  const client = await pool.connect();
  try {
    const { rows: regattas } = await client.query(
      `SELECT uuid, name, year, url
       FROM regattas
       WHERE start_at IS NOT NULL
         AND end_at IS NOT NULL
         AND now() BETWEEN start_at AND end_at`
    );

    for (const regatta of regattas) {
      try {
        await processRegatta(client, regatta);
      } catch (error) {
        console.error(`Failed to process regatta ${regatta.url}`, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        processed: regattas.length,
      }),
    };
  } finally {
    client.release();
  }
});
