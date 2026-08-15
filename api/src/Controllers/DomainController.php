<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\DomainService;

final class DomainController extends Controller
{
    public function __construct(private DomainService $domains)
    {
    }

    public function setSubdomain(Request $request): Response
    {
        $enabled = filter_var($request->input('enabled', true), FILTER_VALIDATE_BOOLEAN);
        $site = $this->domains->setSubdomain($this->user($request)->id, $request->input('subdomain'), $enabled);
        return Response::json(['site' => $site, 'message' => 'Subdomain saved.']);
    }

    public function setDomain(Request $request): Response
    {
        $data = $this->validated($request, ['domain' => 'required|string|max:191']);
        $result = $this->domains->setDomain($this->user($request)->id, $data['domain']);
        return Response::json($result + ['message' => 'Add these DNS records, then verify.']);
    }

    public function verify(Request $request): Response
    {
        $result = $this->domains->verify($this->user($request)->id);
        $result['message'] = $result['verified']
            ? 'Domain verified.'
            : 'We couldn’t find the records yet. DNS can take a while to update — try again shortly.';
        return Response::json($result);
    }

    public function removeDomain(Request $request): Response
    {
        $site = $this->domains->removeDomain($this->user($request)->id);
        return Response::json(['site' => $site, 'message' => 'Domain removed.']);
    }
}
