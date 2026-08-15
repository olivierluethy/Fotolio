import Analytics from '../components/Analytics';

/**
 * Dedicated Analytics tab: the visitor analytics panel plus the world globe,
 * lifted out of Overview into its own page.
 */
export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="eyebrow">Insights</div>
        <h1 className="font-display font-bold text-3xl text-ink mt-1">Analytics</h1>
        <p className="text-ink-muted text-sm mt-1.5">Who’s visiting your published site, where they are, and what they’re doing right now.</p>
      </div>
      <Analytics showGlobe heading={false} />
    </div>
  );
}
