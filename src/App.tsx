import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import "./App.css";

interface Usage {
  rx: number;
  tx: number;
}

interface UsageReport {
  today: Usage;
  week: Usage;
  month: Usage;
  all_time: Usage;
}

export default function App() {
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const db = await Database.load("sqlite:overlay.db");

      const today = await db.select<Usage[]>(
        `SELECT
          COALESCE(SUM(rx_bytes), 0) as rx,
          COALESCE(SUM(tx_bytes), 0) as tx
         FROM network_usage
         WHERE date = date('now', 'localtime')`,
      );

      const week = await db.select<Usage[]>(
        `SELECT
          COALESCE(SUM(rx_bytes), 0) as rx,
          COALESCE(SUM(tx_bytes), 0) as tx
         FROM network_usage
         WHERE date >= date('now', 'localtime', '-7 days')`,
      );

      const month = await db.select<Usage[]>(
        `SELECT
          COALESCE(SUM(rx_bytes), 0) as rx,
          COALESCE(SUM(tx_bytes), 0) as tx
         FROM network_usage
         WHERE date >= date('now', 'localtime', '-30 days')`,
      );

      const allTime = await db.select<Usage[]>(
        `SELECT
          COALESCE(SUM(rx_bytes), 0) as rx,
          COALESCE(SUM(tx_bytes), 0) as tx
         FROM network_usage`,
      );

      setUsage({
        today: today[0] || { rx: 0, tx: 0 },
        week: week[0] || { rx: 0, tx: 0 },
        month: month[0] || { rx: 0, tx: 0 },
        all_time: allTime[0] || { rx: 0, tx: 0 },
      });
    } catch (e) {
      console.error("Failed to fetch usage from database:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    invoke<boolean>("is_autostart_enabled")
      .then((v) => setAutostart(v))
      .catch(() => setAutostart(null));

    fetchUsage();
    const interval = setInterval(fetchUsage, 10000);
    return () => clearInterval(interval);
  }, []);

  async function toggleAutostart() {
    if (autostart === null) return;
    await invoke("set_autostart_enabled", { enabled: !autostart });
    setAutostart(!autostart);
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const totalTraffic = useMemo(() => {
    if (!usage) return 0;
    return usage.all_time.rx + usage.all_time.tx;
  }, [usage]);

  const downloadShare = useMemo(() => {
    if (!usage) return 0;
    const total = usage.all_time.rx + usage.all_time.tx;
    if (total === 0) return 0;
    return Math.round((usage.all_time.rx / total) * 100);
  }, [usage]);

  const uploadShare = 100 - downloadShare;

  const strongestPeriod = useMemo(() => {
    if (!usage) return null;

    const periods = [
      { name: "Today", total: usage.today.rx + usage.today.tx },
      { name: "Past 7 Days", total: usage.week.rx + usage.week.tx },
      { name: "Past 30 Days", total: usage.month.rx + usage.month.tx },
      { name: "All Time", total: usage.all_time.rx + usage.all_time.tx },
    ];

    return periods.reduce(
      (max, p) => (p.total > max.total ? p : max),
      periods[0],
    );
  }, [usage]);

  return (
    <main className="container">
      <section className="hero">
        <div>
          <p className="eyebrow">Network analytics</p>
          <h1>Peek Dashboard</h1>
          <p className="subtitle">
            A clean overview of your traffic usage, upload and download history,
            and system tracking — designed for quick understanding.
          </p>
        </div>

        <button
          className={`autostart-btn ${autostart ? "enabled" : "disabled"}`}
          onClick={toggleAutostart}
          disabled={autostart === null}
        >
          <span className="dot" />
          {autostart === null
            ? "Checking autostart..."
            : autostart
              ? "Autostart Enabled"
              : "Autostart Disabled"}
        </button>
      </section>

      {loading ? (
        <div className="loading-card">Loading network statistics...</div>
      ) : usage ? (
        <>
          <section className="section">
            <div className="section-header">
              <h2>Overview</h2>
              <span className="muted">Updated every 10 seconds</span>
            </div>

            <div className="grid">
              <UsageCard
                title="Today"
                data={usage.today}
                formatBytes={formatBytes}
                accent="green"
              />
              <UsageCard
                title="Past 7 Days"
                data={usage.week}
                formatBytes={formatBytes}
                accent="blue"
              />
              <UsageCard
                title="Past 30 Days"
                data={usage.month}
                formatBytes={formatBytes}
                accent="purple"
              />
              <UsageCard
                title="All Time"
                data={usage.all_time}
                formatBytes={formatBytes}
                accent="orange"
              />
            </div>
          </section>

          <section className="section insights-grid">
            <div className="panel">
              <h3>Traffic Summary</h3>
              <div className="big-stat">{formatBytes(totalTraffic)}</div>
              <p className="muted">
                Total network traffic recorded across all tracked time.
              </p>
            </div>

            <div className="panel">
              <h3>Most Active Window</h3>
              <div className="big-stat">{strongestPeriod?.name ?? "—"}</div>
              <p className="muted">
                Highest combined upload and download usage among the tracked
                summary periods.
              </p>
            </div>
          </section>

          <section className="section">
            <div className="section-header">
              <h2>Upload vs Download</h2>
              <span className="muted">All-time distribution</span>
            </div>

            <div className="panel">
              <div className="split-header">
                <div>
                  <span className="legend download" /> Download {downloadShare}%
                </div>
                <div>
                  <span className="legend upload" /> Upload {uploadShare}%
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className="progress download-bar"
                  style={{ width: `${downloadShare}%` }}
                />
                <div
                  className="progress upload-bar"
                  style={{ width: `${uploadShare}%` }}
                />
              </div>

              <div className="split-values">
                <div>
                  <span className="mini-label">Download</span>
                  <strong>{formatBytes(usage.all_time.rx)}</strong>
                </div>
                <div>
                  <span className="mini-label">Upload</span>
                  <strong>{formatBytes(usage.all_time.tx)}</strong>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="loading-card">No usage data found.</div>
      )}
    </main>
  );
}

function UsageCard({
  title,
  data,
  formatBytes,
  accent,
}: {
  title: string;
  data: Usage;
  formatBytes: (b: number) => string;
  accent: "green" | "blue" | "purple" | "orange";
}) {
  return (
    <div className={`card ${accent}`}>
      <div className="card-top">
        <h3>{title}</h3>
        <span className="pill">Tracked</span>
      </div>

      <div className="stats">
        <div className="stat-row">
          <span className="icon download-icon">↓</span>
          <div className="info">
            <span className="label">Download</span>
            <span className="value">{formatBytes(data.rx)}</span>
          </div>
        </div>

        <div className="stat-row">
          <span className="icon upload-icon">↑</span>
          <div className="info">
            <span className="label">Upload</span>
            <span className="value">{formatBytes(data.tx)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
