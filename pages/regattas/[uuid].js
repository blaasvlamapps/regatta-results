import Head from "next/head";
import { Fragment, useEffect, useMemo, useState } from "react";

function getDataField(row, keys) {
    if (!row || !row.data) return null;
    for (const key of keys) {
      const value = row.data[key];
      if (value) return value;
    }
    return null;
  }

  function getResultPosition(row) {
    return (
      row.position ||
      getDataField(row, ["Place", "Position", "Pos", "col_1"]) ||
      "—"
    );
  }

  function getResultAthlete(row) {
    return (
      row.athlete ||
      getDataField(row, ["Athlete", "Competitor", "Name", "col_9"]) ||
      "—"
    );
  }

  function getResultSchool(row) {
    return (
      row.school ||
      getDataField(row, ["Org. Name", "Organization", "School", "Club", "col_4"]) ||
      "—"
    );
  }

  function getResultTime(row) {
    return (
      getDataField(row, ["Finish Time", "Time", "Result", "col_5"]) || "—"
    );
  }

  function getLaneNumber(row) {
    return row.lane || getDataField(row, ["Lane", "col_1"]) || "—";
  }

  function getLaneCrew(row) {
    return (
      row.crew ||
      getDataField(row, [
        "Athletes",
        "Crew",
        "Athlete",
        "Competitor",
        "col_4",
      ]) ||
      "—"
    );
  }

  function getLaneBoat(row) {
    return getDataField(row, ["Boat", "Boat ID", "col_2"]) || "—";
  }

  function getLaneSchool(row) {
    return (
      row.school ||
      getDataField(row, [
        "Org. Name",
        "Organization",
        "School",
        "Club",
        "col_3",
      ]) ||
      "—"
    );
  }

  function isLaneHeaderRow(row) {
    const lane = getLaneNumber(row);
    const crew = getLaneCrew(row);
    const school = getLaneSchool(row);
    return (
      lane === "Lane" ||
      crew === "Athletes" ||
      school === "Org. Name" ||
      (lane === "—" && crew === "—" && school === "—")
    );
  }

  function isResultHeaderRow(row) {
    const position = getResultPosition(row);
    const athlete = getResultAthlete(row);
    const school = getResultSchool(row);
    const time = getResultTime(row);
    return (
      position === "Place" ||
      athlete === "Athlete" ||
      school === "Org. Name" ||
      time === "Finish Time"
    );
  }

export default function RegattaPage() {
  const [regatta, setRegatta] = useState(null);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    []
  );

  function formatShortDate(value) {
    if (!value) return "—";
    const dateValue =
      typeof value === "string" && value.length === 10
        ? new Date(`${value}T00:00:00Z`)
        : new Date(value);
    if (Number.isNaN(dateValue.getTime())) return "—";
    return dateFormatter.format(dateValue).replace(",", "");
  }

  function formatTime(value) {
    if (!value) return "—";
    if (typeof value === "string" && value.length >= 5) {
      return value.slice(0, 5);
    }
    return value;
  }

  useEffect(() => {
    let mounted = true;
    async function loadRegatta() {
      try {
        const uuid = window.location.pathname.split("/").pop();
        const response = await fetch(`/api/regattas/${uuid}`);
        if (!response.ok) {
          throw new Error("Failed to load regatta");
        }
        const data = await response.json();
        if (mounted) {
          setRegatta(data.regatta || null);
          setRaces(data.races || []);
          setLoadError("");
        }
      } catch (error) {
        if (mounted) {
          setLoadError("Unable to load regatta details.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRegatta();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handleScroll() {
      setIsCollapsed(window.scrollY > 120);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const statuses = useMemo(() => {
    const values = new Set();
    races.forEach((race) => {
      if (race.status) values.add(race.status);
    });
    return Array.from(values);
  }, [races]);

  const filteredRaces = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return races.filter((race) => {
      if (statusFilter && race.status !== statusFilter) return false;
      if (!lower) return true;
      const inRace =
        String(race.event_id).includes(lower) ||
        (race.event_name || "").toLowerCase().includes(lower) ||
        (race.race_label || "").toLowerCase().includes(lower);
      if (inRace) return true;

      const inLaneDraw = (race.lane_draw_rows || []).some((row) => {
        const values = [
          row.lane,
          row.crew,
          row.school,
          row.data ? JSON.stringify(row.data) : "",
        ];
        return values.some((val) =>
          String(val || "").toLowerCase().includes(lower)
        );
      });
      if (inLaneDraw) return true;

      const inResults = (race.results_rows || []).some((row) => {
        const values = [
          row.position,
          row.athlete,
          row.school,
          row.data ? JSON.stringify(row.data) : "",
        ];
        return values.some((val) =>
          String(val || "").toLowerCase().includes(lower)
        );
      });

      return inResults;
    });
  }, [query, races, statusFilter]);

  function toggleExpanded(raceId) {
    setExpanded((prev) =>
      prev.includes(raceId)
        ? prev.filter((id) => id !== raceId)
        : [...prev, raceId]
    );
  }

  return (
    <div className="container">
      <Head>
        <title>{regatta ? `${regatta.name} | Regatta` : "Regatta"}</title>
        <meta
          name="description"
          content={
            regatta
              ? `Browse ${regatta.name} (${regatta.year}) with events, lane draws, and results.`
              : "Browse regatta events, lane draws, and results."
          }
        />
        <meta
          property="og:title"
          content={regatta ? `${regatta.name} | Regatta` : "Regatta"}
        />
        <meta
          property="og:description"
          content={
            regatta
              ? `Browse ${regatta.name} (${regatta.year}) with events, lane draws, and results.`
              : "Browse regatta events, lane draws, and results."
          }
        />
        <meta property="og:type" content="website" />
      </Head>
      <main>
        <section
          className={`card regatta-hero ${isCollapsed ? "is-collapsed" : ""}`}
        >
          <a href="/" className="compact-back">
            Regatta Results
          </a>
          {loading ? (
            <div className="skeleton-list">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" />
            </div>
          ) : loadError ? (
            <p className="muted">{loadError}</p>
          ) : (
            <>
              <h1 className="title">{regatta?.name}</h1>
              <p className="muted regatta-meta">
                {regatta?.year} · {formatShortDate(regatta?.start_at)} to{" "}
                {formatShortDate(regatta?.end_at)}
              </p>
            </>
          )}
        </section>

        <section className="card">
          <h2>Events & races</h2>
          {loading ? (
            <div className="skeleton-table">
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </div>
          ) : loadError ? (
            <p className="muted">{loadError}</p>
          ) : (
            <>
              <div className="search-form">
                <label className="field">
                  <span>Filter</span>
                  <div className="input-wrap">
                    <input
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Event, race, athlete, or school"
                    />
                    {query ? (
                      <button
                        type="button"
                        className="clear-button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                      >
                        x
                      </button>
                    ) : null}
                  </div>
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {filteredRaces.length === 0 ? (
                <p className="muted">No races match that filter.</p>
              ) : (
                <div className="results-table">
                  <div className="results-row results-header">
                    <span>Event</span>
                    <span>Race</span>
                    <span>Date</span>
                    <span>Time</span>
                    <span>Status</span>
                    <span>Progression</span>
                    <span>Details</span>
                  </div>
                  {filteredRaces.map((race) => (
                    <div key={race.race_id}>
                      <div
                        className={`results-row ${
                          expanded.includes(race.race_id) ? "is-expanded" : ""
                        }`}
                        onClick={() => toggleExpanded(race.race_id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded.includes(race.race_id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleExpanded(race.race_id);
                          }
                        }}
                      >
                        <span>
                          {race.event_id} {race.event_name}
                        </span>
                        <span>{race.race_label}</span>
                        <span>{formatShortDate(race.race_date)}</span>
                        <span>{formatTime(race.race_time)}</span>
                        <span>{race.status || "—"}</span>
                        <span>{race.progression || "—"}</span>
                        <span>
                          {race.details_type || "—"}{" "}
                          {(race.lane_draw_rows?.length ||
                            race.results_rows?.length) &&
                          expanded.includes(race.race_id)
                            ? "▲"
                            : (race.lane_draw_rows?.length ||
                                race.results_rows?.length) &&
                              !expanded.includes(race.race_id)
                            ? "▼"
                            : ""}
                        </span>
                      </div>
                      {expanded.includes(race.race_id) ? (
                        <div className="expand-panel">
                          {race.results_rows?.length ? (
                            <div className="detail-section">
                              <h3>Results</h3>
                              <div className="detail-grid">
                                <span className="detail-header">Position</span>
                                <span className="detail-header">
                                  Athlete/Crew
                                </span>
                                <span className="detail-header">School</span>
                                <span className="detail-header">Time</span>
                                {race.results_rows
                                  .filter((row) => !isResultHeaderRow(row))
                                  .map((row, index, list) => (
                                    <Fragment key={`res-${index}`}>
                                      <div className="detail-row detail-row-results">
                                        <span data-label="Position">
                                          {getResultPosition(row)}
                                        </span>
                                        <span data-label="Athlete/Crew">
                                          {getResultAthlete(row)}
                                        </span>
                                        <span data-label="School">
                                          {getResultSchool(row)}
                                        </span>
                                        <span data-label="Time">
                                          {getResultTime(row)}
                                        </span>
                                      </div>
                                      {index < list.length - 1 ? (
                                        <div className="detail-divider" />
                                      ) : null}
                                    </Fragment>
                                  ))}
                              </div>
                            </div>
                          ) : null}

                          {!race.results_rows?.length &&
                          race.lane_draw_rows?.length ? (
                            <div className="detail-section">
                              <h3>Lane draw</h3>
                              <div className="detail-grid lane-grid">
                                <span className="detail-header">Lane</span>
                                <span className="detail-header">Boat</span>
                                <span className="detail-header">Athletes</span>
                                <span className="detail-header">School</span>
                                {race.lane_draw_rows
                                  .filter((row) => !isLaneHeaderRow(row))
                                  .map((row, index, list) => (
                                    <Fragment key={`lane-${index}`}>
                                      <div className="detail-row detail-row-lane">
                                        <span data-label="Lane">
                                          {getLaneNumber(row)}
                                        </span>
                                        <span data-label="Boat">
                                          {getLaneBoat(row)}
                                        </span>
                                        <span data-label="Athletes">
                                          {getLaneCrew(row)}
                                        </span>
                                        <span data-label="School">
                                          {getLaneSchool(row)}
                                        </span>
                                      </div>
                                      {index < list.length - 1 ? (
                                        <div className="detail-divider" />
                                      ) : null}
                                    </Fragment>
                                  ))}
                              </div>
                            </div>
                          ) : null}

                          {!race.results_rows?.length &&
                          !race.lane_draw_rows?.length ? (
                            <p className="muted">
                              No lane draw or results yet.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
