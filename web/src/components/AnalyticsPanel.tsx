import { useMemo, useState } from "react";
import { formatUnits } from "viem";

import type { PoolAnalytics, PricePoint, VolumeBucket } from "../hooks/usePoolAnalytics";

const WIDTH = 464;
const PRICE_HEIGHT = 180;
const VOLUME_HEIGHT = 110;
const PAD = { top: 12, right: 12, bottom: 22, left: 46 };

function formatPrice(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

function formatVolume(raw: bigint, decimals: number): string {
  const value = Number(formatUnits(raw, decimals));
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

interface PriceChartProps {
  series: PricePoint[];
  baseSymbol: string;
  quoteSymbol: string;
}

function PriceChart({ series, baseSymbol, quoteSymbol }: PriceChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plot = useMemo(() => {
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = PRICE_HEIGHT - PAD.top - PAD.bottom;

    const t0 = series[0].timestamp;
    const t1 = series[series.length - 1].timestamp;
    const tSpan = Math.max(t1 - t0, 1);

    let min = Infinity;
    let max = -Infinity;
    for (const point of series) {
      if (point.price < min) min = point.price;
      if (point.price > max) max = point.price;
    }
    // Flat series still needs a visible band.
    if (max === min) {
      max += max === 0 ? 1 : Math.abs(max) * 0.05;
      min -= min === 0 ? 1 : Math.abs(min) * 0.05;
    }
    const pSpan = max - min;

    const xy = series.map((point) => ({
      x: PAD.left + ((point.timestamp - t0) / tSpan) * innerW,
      y: PAD.top + (1 - (point.price - min) / pSpan) * innerH
    }));

    const line = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const baselineY = PAD.top + innerH;
    const area = `${line} L${xy[xy.length - 1].x.toFixed(1)},${baselineY} L${xy[0].x.toFixed(1)},${baselineY} Z`;

    return { xy, line, area, min, max, t0, t1, baselineY };
  }, [series]);

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    plot.xy.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hover = hoverIndex !== null ? { point: series[hoverIndex], pos: plot.xy[hoverIndex] } : null;
  const last = plot.xy[plot.xy.length - 1];

  return (
    <div className="analytics-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${PRICE_HEIGHT}`}
        role="img"
        aria-label={`${baseSymbol} price in ${quoteSymbol} over the last 24 hours`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* gridlines: min / mid / max, hairline */}
        {[plot.max, (plot.max + plot.min) / 2, plot.min].map((value, i) => {
          const y = PAD.top + (i * (PRICE_HEIGHT - PAD.top - PAD.bottom)) / 2;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="analytics-grid" />
              <text x={PAD.left - 6} y={y + 3.5} textAnchor="end" className="analytics-axis-label">
                {formatPrice(value)}
              </text>
            </g>
          );
        })}

        <text x={PAD.left} y={PRICE_HEIGHT - 6} className="analytics-axis-label">
          {formatTime(plot.t0)}
        </text>
        <text x={WIDTH - PAD.right} y={PRICE_HEIGHT - 6} textAnchor="end" className="analytics-axis-label">
          {formatTime(plot.t1)}
        </text>

        <path d={plot.area} className="analytics-area" />
        <path d={plot.line} className="analytics-line" />

        {/* end dot with surface ring */}
        <circle cx={last.x} cy={last.y} r={6} className="analytics-dot-ring" />
        <circle cx={last.x} cy={last.y} r={4} className="analytics-dot" />

        {hover && (
          <g>
            <line
              x1={hover.pos.x}
              x2={hover.pos.x}
              y1={PAD.top}
              y2={plot.baselineY}
              className="analytics-crosshair"
            />
            <circle cx={hover.pos.x} cy={hover.pos.y} r={6} className="analytics-dot-ring" />
            <circle cx={hover.pos.x} cy={hover.pos.y} r={4} className="analytics-dot" />
          </g>
        )}
      </svg>
      <div className="analytics-readout" aria-live="polite">
        {hover ? (
          <>
            <strong>{formatPrice(hover.point.price)} {quoteSymbol}</strong>
            <span>{formatDateTime(hover.point.timestamp)}</span>
          </>
        ) : (
          <>
            <strong>
              {formatPrice(series[series.length - 1].price)} {quoteSymbol}
            </strong>
            <span>current, per {baseSymbol}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface VolumeChartProps {
  buckets: VolumeBucket[];
  quoteSymbol: string;
  quoteDecimals: number;
}

function VolumeChart({ buckets, quoteSymbol, quoteDecimals }: VolumeChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = VOLUME_HEIGHT - PAD.top - PAD.bottom;
  const baselineY = PAD.top + innerH;

  const maxVolume = buckets.reduce((max, b) => (b.quoteAmount > max ? b.quoteAmount : max), 0n);
  const maxValue = Number(formatUnits(maxVolume, quoteDecimals));

  const slot = innerW / buckets.length;
  const barWidth = Math.min(slot - 2, 24);

  const hover = hoverIndex !== null ? buckets[hoverIndex] : null;

  return (
    <div className="analytics-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${VOLUME_HEIGHT}`}
        role="img"
        aria-label={`Swap volume in ${quoteSymbol} over the recent log window`}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={baselineY} y2={baselineY} className="analytics-baseline" />
        {maxValue > 0 && (
          <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" className="analytics-axis-label">
            {formatVolume(maxVolume, quoteDecimals)}
          </text>
        )}

        <text x={PAD.left} y={VOLUME_HEIGHT - 6} className="analytics-axis-label">
          {formatTime(buckets[0].startTimestamp)}
        </text>
        <text x={WIDTH - PAD.right} y={VOLUME_HEIGHT - 6} textAnchor="end" className="analytics-axis-label">
          {formatTime(buckets[buckets.length - 1].endTimestamp)}
        </text>

        {buckets.map((bucket, i) => {
          const value = Number(formatUnits(bucket.quoteAmount, quoteDecimals));
          const h = maxValue > 0 ? Math.max((value / maxValue) * innerH, value > 0 ? 2 : 0) : 0;
          const x = PAD.left + i * slot + (slot - barWidth) / 2;
          const y = baselineY - h;
          const r = Math.min(4, h / 2, barWidth / 2);

          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x},${baselineY} V${y + r} Q${x},${y} ${x + r},${y} H${x + barWidth - r} Q${x + barWidth},${y} ${x + barWidth},${y + r} V${baselineY} Z`}
                  className={i === hoverIndex ? "analytics-bar analytics-bar-hover" : "analytics-bar"}
                />
              )}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setHoverIndex(i)}
              />
            </g>
          );
        })}
      </svg>
      <div className="analytics-readout" aria-live="polite">
        {hover ? (
          <>
            <strong>
              {formatVolume(hover.quoteAmount, quoteDecimals)} {quoteSymbol}
            </strong>
            <span>
              {formatTime(hover.startTimestamp)} to {formatTime(hover.endTimestamp)}
            </span>
          </>
        ) : (
          <span>Hover a bar for bucket detail.</span>
        )}
      </div>
    </div>
  );
}

export interface AnalyticsPanelProps {
  analytics: PoolAnalytics;
}

/**
 * Hand-rolled SVG charts (no chart dependency): a price line over ~24h of
 * sampled reserves and volume bars over the recent Swap-log window.
 */
export function AnalyticsPanel({ analytics }: AnalyticsPanelProps) {
  const {
    priceSeries,
    volumeBuckets,
    totalVolume,
    swapCount,
    baseSymbol,
    quoteSymbol,
    quoteDecimals,
    volumeFromTimestamp,
    volumeToTimestamp
  } = analytics;

  return (
    <div className="analytics-panel">
      <h4 className="analytics-title">
        {baseSymbol} price <span className="analytics-subtle">in {quoteSymbol}, last 24h</span>
      </h4>
      {priceSeries.length >= 2 ? (
        <PriceChart series={priceSeries} baseSymbol={baseSymbol} quoteSymbol={quoteSymbol} />
      ) : (
        <p className="analytics-empty">Not enough price history for this pool yet.</p>
      )}

      <h4 className="analytics-title">
        Volume{" "}
        <span className="analytics-subtle">
          in {quoteSymbol}, {formatTime(volumeFromTimestamp)} to {formatTime(volumeToTimestamp)}
        </span>
      </h4>
      {volumeBuckets.length > 0 ? (
        <>
          <VolumeChart buckets={volumeBuckets} quoteSymbol={quoteSymbol} quoteDecimals={quoteDecimals} />
          <div className="info-row">
            <span>Window volume</span>
            <strong>
              {formatVolume(totalVolume, quoteDecimals)} {quoteSymbol} · {swapCount} swap{swapCount === 1 ? "" : "s"}
            </strong>
          </div>
        </>
      ) : (
        <p className="analytics-empty">No swap data available.</p>
      )}
    </div>
  );
}
