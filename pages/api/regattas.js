const { pool } = require("../../lib/db");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const year =
    typeof req.query.year === "string" ? Number(req.query.year) : null;

  try {
    const params = [];
    let whereClause = "";
    if (year && !Number.isNaN(year)) {
      params.push(year);
      whereClause = "WHERE year = $1";
    }

    const { rows } = await pool.query(
      `SELECT uuid, slug, name, year, url, start_at, end_at
       FROM regattas
       ${whereClause}
       ORDER BY year DESC, start_at ASC`,
      params
    );

    const grouped = rows.reduce((acc, row) => {
      const key = String(row.year);
      if (!acc[key]) {
        acc[key] = { year: row.year, regattas: [] };
      }
      acc[key].regattas.push({
        uuid: row.uuid,
        slug: row.slug,
        name: row.name,
        url: row.url,
        start_at: row.start_at,
        end_at: row.end_at,
      });
      return acc;
    }, {});

    const years = Object.values(grouped).sort((a, b) => b.year - a.year);

    return res.status(200).json({ years });
  } catch (error) {
    console.error("Failed to load regattas", error);
    return res.status(500).json({ error: "Failed to load regattas" });
  }
}
