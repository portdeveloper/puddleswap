import type { PricePoint, VolumeBucket } from "../lib/poolAnalytics";

type PoolAnalyticsChartProps = {
  priceSeries: PricePoint[];
  volumeBuckets: VolumeBucket[];
  className?: string;
};

const WIDTH = 460;
const PRICE_HEIGHT = 90;
const VOLUME_HEIGHT = 36;
const GAP = 10;
const PADDING_Y = 6;

function xForIndex(index: number, count: number): number {
  if (count <= 1) return 0;
  return (index / (count - 1)) * WIDTH;
}

function buildLinePath(points: { x: number; y: number }[]): string {
  return points.map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function PoolAnalyticsChart({ priceSeries, volumeBuckets, className }: PoolAnalyticsChartProps) {
  if (priceSeries.length === 0) {
    return (
      <div
        className={className}
        style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)" }}
      >
        No recent price activity in this window.
      </div>
    );
  }

  const prices = priceSeries.map((point) => point.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const pricePoints = priceSeries.map((point, i) => ({
    x: xForIndex(i, priceSeries.length),
    y:
      PADDING_Y +
      (PRICE_HEIGHT - 2 * PADDING_Y) * (1 - (point.price - minPrice) / priceRange),
  }));

  const maxVolume = Math.max(0, ...volumeBuckets.map((bucket) => bucket.volume)) || 1;
  const barWidth = volumeBuckets.length > 0 ? WIDTH / volumeBuckets.length : 0;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${WIDTH} ${PRICE_HEIGHT + GAP + VOLUME_HEIGHT}`}
      width="100%"
      height={PRICE_HEIGHT + GAP + VOLUME_HEIGHT}
      role="img"
      aria-label="Pool price history and recent volume"
    >
      {/* Price history */}
      {pricePoints.length === 1 ? (
        <circle cx={pricePoints[0].x} cy={pricePoints[0].y} r={2.5} fill="var(--brand-green)" />
      ) : (
        <path
          d={buildLinePath(pricePoints)}
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Volume bars */}
      <g transform={`translate(0 ${PRICE_HEIGHT + GAP})`}>
        <line x1={0} y1={VOLUME_HEIGHT} x2={WIDTH} y2={VOLUME_HEIGHT} stroke="var(--border-light)" />
        {volumeBuckets.map((bucket, i) => {
          const height = (bucket.volume / maxVolume) * (VOLUME_HEIGHT - 2);
          return (
            <rect
              key={`${bucket.fromBlock}-${bucket.toBlock}`}
              x={i * barWidth + barWidth * 0.15}
              y={VOLUME_HEIGHT - height}
              width={barWidth * 0.7}
              height={height}
              fill="var(--accent-blue)"
            />
          );
        })}
      </g>
    </svg>
  );
}
