<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\HttpException;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\GeocodingService;

/**
 * Thin authed proxy in front of {@see GeocodingService}, used by the photo
 * Location field: forward autocomplete and reverse ("use my current location").
 */
final class GeocodeController extends Controller
{
    public function __construct(private GeocodingService $geo)
    {
    }

    public function search(Request $request): Response
    {
        $q = (string) $request->query('q', '');
        return Response::json(['results' => $this->geo->search($q)]);
    }

    public function reverse(Request $request): Response
    {
        $lat = $request->query('lat');
        $lng = $request->query('lng');
        if (!is_numeric($lat) || !is_numeric($lng)) {
            throw HttpException::unprocessable('lat and lng are required.');
        }
        return Response::json(['result' => $this->geo->reverse((float) $lat, (float) $lng)]);
    }
}
