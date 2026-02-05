import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Header from "@components/Header";
import Footer from "@components/Footer";

export default function Home() {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadRegattas() {
      try {
        const response = await fetch("/api/regattas");
        if (!response.ok) {
          throw new Error("Failed to load regattas");
        }
        const data = await response.json();
        if (mounted) {
          setYears(data.years || []);
          setLoadError("");
        }
      } catch (error) {
        if (mounted) {
          setLoadError("Unable to load regattas right now.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRegattas();
    return () => {
      mounted = false;
    };
  }, []);

  const availableYears = useMemo(
    () => years.map((entry) => entry.year).filter(Boolean),
    [years]
  );

  async function handleSearch(event) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (yearFilter) {
        params.append("year", yearFilter);
      }
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Search failed");
      }
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="container">
      <Head>
        <title>Regatta Results</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <Header title="Regatta Results" />

        <section className="card">
          <h2>Search results</h2>
          <form onSubmit={handleSearch} className="search-form">
            <label className="field">
              <span>Athlete or school</span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Start typing a name or school"
              />
            </label>
            <label className="field">
              <span>Year</span>
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              >
                <option value="">All years</option>
                {availableYears.map((yearValue) => (
                  <option key={yearValue} value={yearValue}>
                    {yearValue}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={searching}>
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {results.length === 0 ? (
            <p className="muted">
              {query.trim().length < 2
                ? "Enter at least 2 characters to search."
                : "No matches yet. Try another name or school."}
            </p>
          ) : (
            <div className="results-table">
              <div className="results-row results-header">
                <span>Regatta</span>
                <span>Event</span>
                <span>Race</span>
                <span>Competitor</span>
                <span>School</span>
                <span>Place/Lane</span>
                <span>Type</span>
              </div>
              {results.map((row, index) => (
                <div className="results-row" key={`${row.type}-${index}`}>
                  <span>
                    <a href={row.regatta_url} target="_blank" rel="noreferrer">
                      {row.regatta_name} ({row.regatta_year})
                    </a>
                  </span>
                  <span>
                    {row.event_id} {row.event_name}
                  </span>
                  <span>
                    {row.details_url ? (
                      <a href={row.details_url} target="_blank" rel="noreferrer">
                        {row.race_label}
                      </a>
                    ) : (
                      row.race_label
                    )}
                  </span>
                  <span>{row.competitor || "—"}</span>
                  <span>{row.school || "—"}</span>
                  <span>{row.position || row.lane || "—"}</span>
                  <span>{row.type === "lane_draw" ? "Lane draw" : "Results"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Regattas by year</h2>
          {loading ? (
            <p className="muted">Loading regattas…</p>
          ) : loadError ? (
            <p className="muted">{loadError}</p>
          ) : (
            <div className="year-grid">
              {years.map((entry) => (
                <div key={entry.year} className="year-block">
                  <h3>{entry.year}</h3>
                  <ul>
                    {entry.regattas.map((regatta) => (
                      <li key={regatta.uuid}>
                        <a href={regatta.url} target="_blank" rel="noreferrer">
                          {regatta.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
