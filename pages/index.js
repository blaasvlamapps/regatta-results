import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@components/Header";
import Footer from "@components/Footer";

export default function Home() {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

  return (
    <div className="container">
      <Head>
        <title>Regatta Results</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <Header title="Regatta Results" />

        <section className="card">
          <h2>Regattas by year</h2>
          {loading ? (
            <div className="skeleton-list">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
            </div>
          ) : loadError ? (
            <p className="muted">{loadError}</p>
          ) : (
            <div className="accordion">
              {years.map((entry, index) => (
                <details
                  key={entry.year}
                  className="accordion-item"
                  open={index === 0}
                >
                  <summary className="accordion-summary">
                    <span>{entry.year}</span>
                    <span className="accordion-count">
                      {entry.regattas.length} regattas
                    </span>
                  </summary>
                  <ul className="accordion-content">
                    {entry.regattas.map((regatta) => (
                      <li key={regatta.uuid}>
                        <Link href={`/regattas/${regatta.uuid}`}>
                          {regatta.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
