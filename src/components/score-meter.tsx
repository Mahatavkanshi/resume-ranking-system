export function ScoreMeter({ score }: { score: number }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">Match score</span>
        <span className="font-semibold text-slate-950">{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-teal-700"
          style={{ width: `${Math.max(0, Math.min(score, 100))}%` }}
        />
      </div>
    </div>
  );
}
