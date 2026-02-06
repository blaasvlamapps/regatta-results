import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Nav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
          setLoadError("Unable to load regattas.");
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
    <div className="nav-shell">
      <div className="nav-bar">
        <Link href="/" className="nav-brand">
          Regatta Results
        </Link>
        <button
          type="button"
          className="nav-toggle"
          onClick={() => setOpen(true)}
          aria-label="Open regatta menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="nav-overlay"
            onClick={() => setOpen(false)}
            aria-label="Close regatta menu"
          />
          <div className="nav-panel" role="dialog" aria-modal="true">
            <div className="nav-panel-header">
              <h2>Regattas</h2>
              <button
                type="button"
                className="nav-close"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            {loading ? (
              <div className="skeleton-list">
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line" />
              </div>
            ) : loadError ? (
              <p className="muted">{loadError}</p>
            ) : (
              <div className="nav-list">
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
                          <button
                            type="button"
                            className="nav-link"
                            onClick={() => {
                              setOpen(false);
                              router.push(`/regattas/${regatta.uuid}`);
                            }}
                          >
                            {regatta.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
