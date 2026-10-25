import { strokePath, type StrokeDoc } from "@/lib/strokes";

const WIDTH = 500;

// A signature drawn from its strokes, in the surrounding text colour.
export function SignatureSvg({ signature, label, className }: { signature: StrokeDoc; label: string; className?: string }) {
  const height = WIDTH / signature.aspect;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className={className} role="img" aria-label={label}>
      {signature.strokes.map((stroke, i) => (
        <path key={i} d={strokePath(stroke, WIDTH, height)} fill="currentColor" />
      ))}
    </svg>
  );
}
