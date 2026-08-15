<?php

use Fotolio\Core\Config;

require __DIR__ . '/vendor/autoload.php';

Config::boot(__DIR__);

date_default_timezone_set('UTC');

if (config('app.debug')) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    ini_set('display_errors', '0');
}
