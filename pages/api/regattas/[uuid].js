const { pool } = require("../../../lib/db");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const uuid = typeof req.query.uuid === "string" ? req.query.uuid : "";
  if (!uuid) {
    return res.status(400).json({ error: "Missing regatta id" });
  }

  try {
    const regattaResult = await pool.query(
      `SELECT uuid, name, year, url, start_at, end_at
       FROM regattas
       WHERE uuid = $1`,
      [uuid]
    );

    if (!regattaResult.rowCount) {
      return res.status(404).json({ error: "Regatta not found" });
    }

    const regatta = regattaResult.rows[0];
    const racesResult = await pool.query(
      `SELECT
         r.id AS race_id,
         e.event_id AS event_id,
         e.event_name AS event_name,
         r.race_label AS race_label,
         r.race_date AS race_date,
         r.race_time AS race_time,
         r.status AS status,
         r.progression AS progression,
         r.details_url AS details_url,
         r.details_type AS details_type
       FROM regatta_races r
       JOIN regatta_events e ON e.id = r.event_id
       WHERE e.regatta_uuid = $1
       ORDER BY r.race_date ASC NULLS LAST, r.race_time ASC NULLS LAST`,
      [uuid]
    );

    const laneDrawResult = await pool.query(
      `SELECT
         ld.race_id AS race_id,
         ld.lane AS lane,
         ld.crew AS crew,
         ld.school AS school,
         ld.data AS data
       FROM regatta_lane_draw_rows ld
       JOIN regatta_races r ON r.id = ld.race_id
       JOIN regatta_events e ON e.id = r.event_id
       WHERE e.regatta_uuid = $1
       ORDER BY ld.race_id ASC, ld.id ASC`,
      [uuid]
    );

    const resultsResult = await pool.query(
      `SELECT
         rr.race_id AS race_id,
         rr.position AS position,
         rr.athlete AS athlete,
         rr.school AS school,
         rr.data AS data
       FROM regatta_results_rows rr
       JOIN regatta_races r ON r.id = rr.race_id
       JOIN regatta_events e ON e.id = r.event_id
       WHERE e.regatta_uuid = $1
       ORDER BY rr.race_id ASC, rr.id ASC`,
      [uuid]
    );

    const laneDrawMap = laneDrawResult.rows.reduce((acc, row) => {
      if (!acc[row.race_id]) acc[row.race_id] = [];
      acc[row.race_id].push(row);
      return acc;
    }, {});

    const resultsMap = resultsResult.rows.reduce((acc, row) => {
      if (!acc[row.race_id]) acc[row.race_id] = [];
      acc[row.race_id].push(row);
      return acc;
    }, {});

    const races = racesResult.rows.map((race) => ({
      ...race,
      lane_draw_rows: laneDrawMap[race.race_id] || [],
      results_rows: resultsMap[race.race_id] || [],
    }));

    return res.status(200).json({
      regatta,
      races,
    });
  } catch (error) {
    console.error("Failed to load regatta details", error);
    return res.status(500).json({ error: "Failed to load regatta details" });
  }
}
