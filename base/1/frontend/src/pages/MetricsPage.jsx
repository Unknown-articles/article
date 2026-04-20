import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatBytes(bytes, decimals = 1) {
  if (bytes == null || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec) {
  return `${formatBytes(bytesPerSec)}/s`;
}

// ─── Shared Components ────────────────────────────────────────────────────────

function Bar({ label, value, max = 100, unit = '%' }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const fillColor =
    pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--primary)';
  return (
    <div className="metric-bar">
      <div className="metric-label">{label}</div>
      <div className="metric-track">
        <div className="metric-fill" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <div className="metric-value">
        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
      </div>
    </div>
  );
}

function Statebadge({ state }) {
  const up = state === 'up' || state === 'running';
  return (
    <span className={`iface-state ${up ? 'iface-up' : 'iface-down'}`}>
      {state ?? 'unknown'}
    </span>
  );
}

function NoData({ label }) {
  return <p className="metric-nodata">Waiting for {label} data…</p>;
}

// ─── Section: CPU ─────────────────────────────────────────────────────────────

function CpuCard({ cpu }) {
  const loading = !cpu || cpu.average == null;
  const m = cpu?.model;
  return (
    <section className="metric-card">
      <h2>CPU</h2>
      {m && (
        <div className="hw-info">
          <span className="hw-model">{[m.manufacturer, m.brand].filter(Boolean).join(' ')}</span>
          <span className="hw-detail">
            {m.physicalCores}C / {m.cores}T
            {m.speed ? ` · ${m.speed} GHz` : ''}
            {m.speedMax ? ` (max ${m.speedMax} GHz)` : ''}
          </span>
        </div>
      )}
      {loading ? (
        <NoData label="CPU" />
      ) : (
        <>
          <Bar label="Average" value={cpu.average} />
          {cpu.cores?.map((c, i) => (
            <Bar key={i} label={`Core ${i}`} value={c} />
          ))}
        </>
      )}
    </section>
  );
}

// ─── Section: Memory ──────────────────────────────────────────────────────────

function MemoryCard({ memory }) {
  const loading = !memory || memory.usedPercent == null;
  const layout = memory?.layout ?? [];
  return (
    <section className="metric-card">
      <h2>Memory</h2>
      {layout.length > 0 && (
        <div className="hw-info">
          {layout.map((m, i) => (
            <span key={i} className="hw-detail">
              {[m.manufacturer, m.type, m.clockSpeed ? `${m.clockSpeed} MHz` : null, formatBytes(m.size)]
                .filter(Boolean).join(' · ')}
            </span>
          ))}
        </div>
      )}
      {loading ? (
        <NoData label="memory" />
      ) : (
        <>
          <Bar label="Used" value={memory.usedPercent} />
          <div className="metric-info">
            <span>Used: {((memory.used ?? 0) / 1e9).toFixed(2)} GB</span>
            <span>Total: {((memory.total ?? 0) / 1e9).toFixed(2)} GB</span>
          </div>
        </>
      )}
    </section>
  );
}

// ─── Section: Uptime ──────────────────────────────────────────────────────────

function UptimeCard({ uptime }) {
  return (
    <section className="metric-card">
      <h2>Uptime</h2>
      <p className="uptime-value">{formatUptime(uptime ?? 0)}</p>
    </section>
  );
}

// ─── Section: Disk ────────────────────────────────────────────────────────────

function DiskCard({ disk }) {
  const drives = Array.isArray(disk?.drives) ? disk.drives : [];
  const layout = Array.isArray(disk?.layout) ? disk.layout : [];
  const ioUtil = disk?.ioUtil ?? null;
  return (
    <section className="metric-card metric-card-wide">
      <h2>Disk</h2>
      {layout.length > 0 && (
        <div className="hw-info">
          {layout.map((d, i) => (
            <span key={i} className="hw-detail">
              {[d.vendor, d.name, d.type, d.interfaceType, formatBytes(d.size)]
                .filter(Boolean).join(' · ')}
            </span>
          ))}
        </div>
      )}
      {ioUtil != null && <Bar label="I/O Utilization" value={ioUtil} />}
      {drives.length === 0 ? (
        <NoData label="disk" />
      ) : (
        drives.map((d, i) => (
          <div key={i} className="disk-entry">
            <div className="disk-header">
              <span className="disk-fs">{d.fs}</span>
              <span className="disk-mount">{d.mount}</span>
              {d.type && <span className="disk-type">{d.type}</span>}
            </div>
            <Bar label="Used" value={d.usedPercent ?? 0} />
            <div className="metric-info">
              <span>Used: {formatBytes(d.used)}</span>
              <span>Free: {formatBytes(d.available)}</span>
              <span>Total: {formatBytes(d.size)}</span>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

// ─── Section: Network ─────────────────────────────────────────────────────────

function IfaceRow({ iface }) {
  return (
    <div className="iface-row">
      <div className="iface-header">
        <span className="iface-name">{iface.iface}</span>
        <Statebadge state={iface.operstate} />
        {iface.speed != null && iface.speed > 0 && (
          <span className="iface-speed">{iface.speed} Mbps</span>
        )}
      </div>
      <div className="iface-stats">
        <div className="iface-stat">
          <span className="iface-stat-label">&#8595; RX</span>
          <span className="iface-stat-value">{formatSpeed(iface.rx_sec)}</span>
          <span className="iface-stat-total">{formatBytes(iface.rx_bytes)} total</span>
        </div>
        <div className="iface-stat">
          <span className="iface-stat-label">&#8593; TX</span>
          <span className="iface-stat-value">{formatSpeed(iface.tx_sec)}</span>
          <span className="iface-stat-total">{formatBytes(iface.tx_bytes)} total</span>
        </div>
      </div>
    </div>
  );
}

function NetworkCard({ network }) {
  const eth = network?.ethernet ?? [];
  const wifi = network?.wifi ?? [];
  const hasEth = eth.length > 0;
  const hasWifi = wifi.length > 0;
  return (
    <section className="metric-card metric-card-wide">
      <h2>Network</h2>
      {!hasEth && !hasWifi ? (
        <NoData label="network" />
      ) : (
        <>
          {hasEth && (
            <div className="net-group">
              <div className="net-group-label">Ethernet</div>
              {eth.map((iface, i) => <IfaceRow key={i} iface={iface} />)}
            </div>
          )}
          {hasWifi && (
            <div className="net-group">
              <div className="net-group-label">Wi-Fi</div>
              {wifi.map((iface, i) => <IfaceRow key={i} iface={iface} />)}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ─── Section: GPU ─────────────────────────────────────────────────────────────

function GpuCard({ gpu }) {
  const controllers = Array.isArray(gpu) ? gpu : [];
  return (
    <section className="metric-card metric-card-wide">
      <h2>GPU</h2>
      {controllers.length === 0 ? (
        <NoData label="GPU" />
      ) : (
        controllers.map((g, i) => (
          <div key={i} className="gpu-entry">
            <div className="gpu-header">
              <span className="gpu-model">{g.model || 'Unknown GPU'}</span>
              {g.vendor && <span className="gpu-vendor">{g.vendor}</span>}
            </div>
            <div className="gpu-meta">
              {g.vramDynamic
                ? <span>VRAM: shared (dynamic)</span>
                : g.vram > 0
                  ? <span>VRAM: {g.vram} MB</span>
                  : null
              }
              {g.temperatureGpu != null && (
                <span
                  className={
                    g.temperatureGpu >= 85 ? 'gpu-temp-hot'
                    : g.temperatureGpu >= 70 ? 'gpu-temp-warm'
                    : ''
                  }
                >
                  Temp: {g.temperatureGpu}&#176;C
                </span>
              )}
            </div>
            {g.utilizationGpu != null && <Bar label="GPU" value={g.utilizationGpu} />}
            {g.utilizationMemory != null && <Bar label="VRAM" value={g.utilizationMemory} />}
            {g.utilizationGpu == null && g.utilizationMemory == null && (
              <p className="gpu-no-util">
                Utilization data unavailable for this GPU
              </p>
            )}
          </div>
        ))
      )}
    </section>
  );
}

// ─── Section: Processes ───────────────────────────────────────────────────────

function ProcessesCard({ processes }) {
  const list = Array.isArray(processes) ? processes : [];
  return (
    <section className="metric-card metric-card-wide">
      <h2>Top Processes <span className="proc-subtitle">by memory usage</span></h2>
      {list.length === 0 ? (
        <NoData label="processes" />
      ) : (
        <table className="proc-table">
          <thead>
            <tr>
              <th>Process</th>
              <th>PID</th>
              <th className="proc-num">Memory</th>
              <th className="proc-num">Mem %</th>
              <th className="proc-num">CPU %</th>
              <th>State</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={i}>
                <td className="proc-name">{p.name}</td>
                <td className="proc-pid">{p.pid}</td>
                <td className="proc-num">{formatBytes(p.mem * 1024)}</td>
                <td className="proc-num">{p.memPercent?.toFixed(1) ?? '—'}%</td>
                <td className="proc-num">{p.cpu?.toFixed(1) ?? '—'}%</td>
                <td><span className={`proc-state proc-state-${p.state}`}>{p.state ?? '—'}</span></td>
                <td className="proc-user">{p.user ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MetricsPage() {
  const [metrics, setMetrics] = useState(null);
  const { connected } = useWebSocket('ws://localhost:3001/ws/all', setMetrics);

  return (
    <main className="page metrics-page">
      <div className="metrics-header">
        <h1>System Metrics</h1>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>
      {!metrics ? (
        <p className="empty">Waiting for data…</p>
      ) : (
        <div className="metrics-grid">
          <CpuCard cpu={metrics.cpu} />
          <MemoryCard memory={metrics.memory} />
          <UptimeCard uptime={metrics.uptime} />
          <DiskCard disk={metrics.disk} />
          <NetworkCard network={metrics.network} />
          <GpuCard gpu={metrics.gpu} />
          <ProcessesCard processes={metrics.processes} />
        </div>
      )}
    </main>
  );
}
