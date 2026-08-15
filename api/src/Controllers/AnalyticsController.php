<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Database;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\AnalyticsService;
use Fotolio\Services\SiteService;

/**
 * First-party analytics: a public, unauthenticated collect beacon (called by
 * the tracking script embedded in every published site) plus the authenticated
 * reads that power the Overview dashboard. See docs/ANALYTICS.md.
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
        $site = $this->sites->forUser($this->user($request)->id);
        $days = (int) $request->query('days', 14);
        return Response::json($this->analytics->overview((int) $site['id'], $days));
    }

    public function realtime(Request $request): Response
    {
        $site = $this->sites->forUser($this->user($request)->id);
        return Response::json($this->analytics->realtime((int) $site['id']));
    }

    private function siteExists(int $id): bool
    {
        return Database::column('SELECT id FROM sites WHERE id = :id', ['id' => $id]) !== null;
    }
}
