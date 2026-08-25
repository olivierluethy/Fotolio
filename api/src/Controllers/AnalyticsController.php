<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Database;
use Fotolio\Core\HttpException;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\AnalyticsService;
use Fotolio\Services\SiteService;
use Fotolio\Support\XlsxWriter;

/**
 * First-party analytics: a public, unauthenticated collect beacon (called by
 * the tracking script embedded in every published site) plus the authenticated
 * reads that power the Analytics dashboard — overview, goals, suggestions,
 * export and multi-site comparison. See docs/ANALYTICS.md.
 */
final class AnalyticsController extends Controller
{
    public function __construct(
        private AnalyticsService $analytics,
        private SiteService $sites,
    ) {
    }

    /**
     * Public ingestion endpoint. Always answers 204 — a tracking beacon must
     * never leak errors or slow a visitor down.
     */
    public function collect(Request $request): Response
    {
        try {
            $siteId = (int) $request->input('site_id', 0);
            if ($siteId > 0 && $this->siteExists($siteId)) {
                $this->analytics->ingest(
                    $siteId,
                    $request->all(),
                    $request->ip(),
                    $request->header('User-Agent')
                );
            }
        } catch (\Throwable) {
            // swallow — never surface tracking failures to a visitor
        }
        return Response::noContent(204);
    }

    public function overview(Request $request): Response
    {
        $siteId = $this->siteId($request);
        $range = $this->range($request);
        $payload = $this->analytics->overview($siteId, $range);
        $payload['goals'] = $this->analytics->goalsReport($siteId, $range['from'], $range['to']);
        $payload['suggestions'] = $this->analytics->suggestions($siteId, $range['from'], $range['to']);
        return Response::json($payload);
    }

    public function realtime(Request $request): Response
    {
        return Response::json($this->analytics->realtime($this->siteId($request)));
    }

    public function goals(Request $request): Response
    {
        return Response::json(['goals' => $this->analytics->goals($this->siteId($request))]);
    }

    public function storeGoal(Request $request): Response
    {
        $data = $this->validated($request, [
            'name' => 'required|string|min:1|max:120',
            'metric' => 'required|in:pageview,click,lightbox,nav,visit',
            'threshold' => 'nullable',
            'path' => 'nullable|string|max:400',
            'label_match' => 'nullable|string|max:200',
        ]);
        $goal = $this->analytics->createGoal($this->siteId($request), $data);
        return Response::json(['goal' => $goal], 201);
    }

    public function destroyGoal(Request $request, array $params): Response
    {
        $this->analytics->deleteGoal($this->siteId($request), (int) $params['id']);
        return Response::json(['message' => 'Goal deleted.']);
    }

    public function compare(Request $request): Response
    {
        return Response::json($this->analytics->compareSites($this->user($request)->id));
    }

    /** Stream the range's event log as CSV or XLSX. */
    public function export(Request $request): Response
    {
        $siteId = $this->siteId($request);
        $range = $this->range($request);
        $format = strtolower((string) $request->query('format', 'csv'));
        $rows = $this->analytics->exportRows($siteId, $range['from'], $range['to']);

        $headers = ['Time (UTC)', 'Type', 'Path', 'Label', 'Session', 'Country', 'Country code', 'Device', 'Browser', 'OS', 'Referrer'];
        $keys = ['created_at', 'type', 'path', 'label', 'session_id', 'country', 'country_code', 'device', 'browser', 'os', 'referrer'];
        $table = array_map(fn ($r) => array_map(fn ($k) => $r[$k] ?? '', $keys), $rows);
        $name = 'analytics-' . substr($range['from'], 0, 10) . '_to_' . substr($range['to'], 0, 10);

        if ($format === 'xlsx') {
            $body = XlsxWriter::build($headers, $table);
            return $this->download($body, $name . '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        }

        $fh = fopen('php://temp', 'r+');
        fputcsv($fh, $headers);
        foreach ($table as $line) {
            fputcsv($fh, $line);
        }
        rewind($fh);
        $body = (string) stream_get_contents($fh);
        fclose($fh);
        return $this->download("\xEF\xBB\xBF" . $body, $name . '.csv', 'text/csv; charset=utf-8');
    }

    private function download(string $body, string $filename, string $contentType): Response
    {
        return new Response($body, 200, [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Content-Length' => (string) strlen($body),
        ]);
    }

    /** Resolve the requested reporting range from the query string. */
    private function range(Request $request): array
    {
        $preset = $request->query('range');
        $from = $request->query('from');
        $to = $request->query('to');
        if (!$preset && $request->query('days') !== null) {
            $days = max(1, min(365, (int) $request->query('days')));
            return AnalyticsService::resolveRange('custom', gmdate('Y-m-d', time() - ($days - 1) * 86400), gmdate('Y-m-d'));
        }
        return AnalyticsService::resolveRange($preset, $from, $to);
    }

    private function siteId(Request $request): int
    {
        $site = $this->sites->forUser($this->user($request)->id);
        if (!$site) {
            throw HttpException::notFound('No site found.');
        }
        return (int) $site['id'];
    }

    private function siteExists(int $id): bool
    {
        return Database::column('SELECT id FROM sites WHERE id = :id', ['id' => $id]) !== null;
    }
}
