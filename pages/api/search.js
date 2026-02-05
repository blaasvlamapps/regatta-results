const { pool } = require("../../lib/db");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const year =
    typeof req.query.year === "string" ? Number(req.query.year) : null;
  const limit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : 200;

  if (!rawQuery || rawQuery.length < 2) {
    return res.status(200).json({ results: [] });
  }

  const safeLimit = Number.isNaN(limit) ? 200 : Math.min(Math.max(limit, 1), 500);
  const query = `%${rawQuery}%`;

  try {
    const { rows } = await pool.query(
      `SELECT
         'results' AS type,
         g.uuid AS regatta_uuid,
         g.name AS regatta_name,
         g.year AS regatta_year,
         g.url AS regatta_url,
         e.event_id AS event_id,
         e.event_name AS event_name,
         r.race_label AS race_label,
         r.race_date AS race_date,
         r.race_time AS race_time,
         r.details_url AS details_url,
         rr.position AS position,
         NULL::text AS lane,
         rr.athlete AS competitor,
         rr.school AS school
       FROM regatta_results_rows rr
       JOIN regatta_races r ON r.id = rr.race_id
       JOIN regatta_events e ON e.id = r.event_id
       JOIN regattas g ON g.uuid = e.regatta_uuid
       WHERE (rr.athlete ILIKE $1 OR rr.school ILIKE $1)
         AND ($2::int IS NULL OR g.year = $2)
       UNION ALL
       SELECT
         'lane_draw' AS type,
         g.uuid AS regatta_uuid,
         g.name AS regatta_name,
         g.year AS regatta_year,
         g.url AS regatta_url,
         e.event_id AS event_id,
         e.event_name AS event_name,
         r.race_label AS race_label,
         r.race_date AS race_date,
         r.race_time AS race_time,
         r.details_url AS details_url,
         NULL::text AS position,
         ld.lane AS lane,
         ld.crew AS competitor,
         ld.school AS school
       FROM regatta_lane_draw_rows ld
       JOIN regatta_races r ON r.id = ld.race_id
       JOIN regatta_events e ON e.id = r.event_id
       JOIN regattas g ON g.uuid = e.regatta_uuid
       WHERE (ld.crew ILIKE $1 OR ld.school ILIKE $1)
         AND ($2::int IS NULL OR g.year = $2)
       ORDER BY regatta_year DESC, race_date DESC NULLS LAST, race_time DESC NULLS LAST
       LIMIT $3`,
      [query, Number.isNaN(year) ? null : year, safeLimit]
    );

    return res.status(200).json({ results: rows });
  } catch (error) {
    console.error("Search failed", error);
    return res.status(500).json({ error: "Search failed" });
  }
}
