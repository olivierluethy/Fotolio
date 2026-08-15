<?php

namespace Fotolio\Support;

/**
 * Minimal, dependency-free reader for the MaxMind DB (.mmdb) binary format,
 * covering exactly what a country lookup needs: binary-search-tree traversal
 * plus the map/string/uint/array/pointer subset of the data-section decoder.
 *
 * This lets Fotolio resolve visitor countries from a self-hosted
 * GeoLite2-Country.mmdb with no Composer dependency and no external calls.
 * It is intentionally not a full implementation of the spec — anything it
 * can't parse surfaces as an exception, which the caller turns into "Unknown".
 *
 * Format reference: https://maxmind.github.io/MaxMind-DB/
 */
final class MaxMindDbReader
{
    private const METADATA_MARKER = "\xab\xcd\xefMaxMind.com";
    private const DATA_SEPARATOR = 16;

    private string $buf;
    private int $nodeCount;
    private int $recordSize;
    private int $ipVersion;
    private int $searchTreeSize;   // bytes
    private int $pointerBase;      // start of data section

    public function __construct(string $path)
    {
        $contents = @file_get_contents($path);
        if ($contents === false || $contents === '') {
            throw new \RuntimeException("Cannot read MMDB at $path");
        }
        $this->buf = $contents;
        $this->readMetadata();
        $this->searchTreeSize = intdiv($this->nodeCount * $this->recordSize, 4);
        $this->pointerBase = $this->searchTreeSize + self::DATA_SEPARATOR;
    }

    /** @return array|null Decoded record for the IP, or null if not found. */
    public function get(string $ip): ?array
    {
        $packed = @inet_pton($ip);
        if ($packed === false) {
            return null;
        }
        $bytes = array_values(unpack('C*', $packed));
        if (count($bytes) === 4 && $this->ipVersion === 6) {
            // IPv4 in an IPv6 tree: prefix 96 zero bits.
            $bytes = array_merge(array_fill(0, 12, 0), $bytes);
        }
        if (count($bytes) === 16 && $this->ipVersion === 4) {
            return null; // IPv6 address, IPv4-only database
        }

        $bitCount = count($bytes) * 8;
        $node = 0;
        for ($i = 0; $i < $bitCount; $i++) {
            if ($node >= $this->nodeCount) {
                break;
            }
            $bit = ($bytes[$i >> 3] >> (7 - ($i % 8))) & 1;
            $node = $this->readNode($node, $bit);
        }

        if ($node === $this->nodeCount) {
            return null; // empty record
        }
        if ($node > $this->nodeCount) {
            $offset = $node - $this->nodeCount + $this->searchTreeSize;
            [$value] = $this->decode($offset);
            return is_array($value) ? $value : null;
        }
        return null;
    }

    private function readNode(int $node, int $index): int
    {
        $base = $node * intdiv($this->recordSize, 4);
        return match ($this->recordSize) {
            24 => $this->bytesToInt($base + $index * 3, 3),
            28 => $index === 0
                ? (($this->byte($base + 3) & 0xF0) << 20) | $this->bytesToInt($base, 3)
                : (($this->byte($base + 3) & 0x0F) << 24) | $this->bytesToInt($base + 4, 3),
            32 => $this->bytesToInt($base + $index * 4, 4),
            default => throw new \RuntimeException("Unsupported record size {$this->recordSize}"),
        };
    }

    // ---- Data-section decoder -------------------------------------------

    /** @return array{0:mixed,1:int} decoded value + offset past it */
    private function decode(int $offset): array
    {
        $ctrl = $this->byte($offset++);
        $type = $ctrl >> 5;

        if ($type === 0) { // extended type
            $type = $this->byte($offset++) + 7;
        }

        if ($type === 1) { // pointer
            return $this->decodePointer($ctrl, $offset);
        }

        [$size, $offset] = $this->sizeFromCtrl($ctrl, $offset);

        return match ($type) {
            2 => [substr($this->buf, $offset, $size), $offset + $size],        // utf-8 string
            5 => [$this->bytesToInt($offset, $size), $offset + $size],         // uint16
            6 => [$this->bytesToInt($offset, $size), $offset + $size],         // uint32
            7 => $this->decodeMap($size, $offset),                            // map
            8 => [$this->bytesToInt($offset, $size), $offset + $size],         // int32 (treated unsigned; unused here)
            9, 10 => [$this->bytesToInt($offset, $size), $offset + $size],     // uint64/128 (best effort)
            11 => $this->decodeArray($size, $offset),                         // array
            14 => [$size !== 0, $offset],                                     // boolean
            15 => [$this->decodeDouble($offset, $size), $offset + $size],      // double (lat/lng in City DBs)
            3  => [$this->decodeFloat($offset, $size), $offset + $size],       // float
            4  => [null, $offset + $size],                                    // bytes — skipped
            default => [null, $offset + $size],
        };
    }

    private function decodePointer(int $ctrl, int $offset): array
    {
        $size = ($ctrl >> 3) & 0x3;
        $v = $ctrl & 0x7;
        switch ($size) {
            case 0:
                $pointer = ($v << 8) | $this->byte($offset);
                $offset += 1;
                break;
            case 1:
                $pointer = ($v << 16) | $this->bytesToInt($offset, 2);
                $pointer += 2048;
                $offset += 2;
                break;
            case 2:
                $pointer = ($v << 24) | $this->bytesToInt($offset, 3);
                $pointer += 526336;
                $offset += 3;
                break;
            default:
                $pointer = $this->bytesToInt($offset, 4);
                $offset += 4;
        }
        [$value] = $this->decode($this->pointerBase + $pointer);
        return [$value, $offset];
    }

    private function decodeMap(int $count, int $offset): array
    {
        $map = [];
        for ($i = 0; $i < $count; $i++) {
            [$key, $offset] = $this->decode($offset);
            [$val, $offset] = $this->decode($offset);
            $map[(string) $key] = $val;
        }
        return [$map, $offset];
    }

    private function decodeArray(int $count, int $offset): array
    {
        $arr = [];
        for ($i = 0; $i < $count; $i++) {
            [$val, $offset] = $this->decode($offset);
            $arr[] = $val;
        }
        return [$arr, $offset];
    }

    /** IEEE-754 64-bit big-endian double (City DB latitude/longitude). */
    private function decodeDouble(int $offset, int $size): ?float
    {
        if ($size !== 8) {
            return null;
        }
        $v = @unpack('E', substr($this->buf, $offset, 8)); // 'E' = big-endian double
        return $v ? (float) $v[1] : null;
    }

    /** IEEE-754 32-bit big-endian float. */
    private function decodeFloat(int $offset, int $size): ?float
    {
        if ($size !== 4) {
            return null;
        }
        $v = @unpack('G', substr($this->buf, $offset, 4)); // 'G' = big-endian float
        return $v ? (float) $v[1] : null;
    }

    private function sizeFromCtrl(int $ctrl, int $offset): array
    {
        $size = $ctrl & 0x1f;
        if ($size < 29) {
            return [$size, $offset];
        }
        if ($size === 29) {
            return [29 + $this->byte($offset), $offset + 1];
        }
        if ($size === 30) {
            return [285 + $this->bytesToInt($offset, 2), $offset + 2];
        }
        return [65821 + $this->bytesToInt($offset, 3), $offset + 3];
    }

    // ---- Metadata -------------------------------------------------------

    private function readMetadata(): void
    {
        $start = strrpos($this->buf, self::METADATA_MARKER);
        if ($start === false) {
            throw new \RuntimeException('Not a MaxMind DB file (no metadata marker)');
        }
        $offset = $start + strlen(self::METADATA_MARKER);
        // Metadata is a data-section map whose pointer base is the marker end.
        $savedBase = $this->pointerBase ?? 0;
        $this->pointerBase = $offset;
        [$meta] = $this->decode($offset);
        $this->pointerBase = $savedBase;

        if (!is_array($meta)) {
            throw new \RuntimeException('Malformed MMDB metadata');
        }
        $this->nodeCount = (int) ($meta['node_count'] ?? 0);
        $this->recordSize = (int) ($meta['record_size'] ?? 0);
        $this->ipVersion = (int) ($meta['ip_version'] ?? 6);
        if ($this->nodeCount === 0 || $this->recordSize === 0) {
            throw new \RuntimeException('Incomplete MMDB metadata');
        }
    }

    // ---- Byte helpers ---------------------------------------------------

    private function byte(int $i): int
    {
        return ord($this->buf[$i]);
    }

    private function bytesToInt(int $offset, int $len): int
    {
        $n = 0;
        for ($i = 0; $i < $len; $i++) {
            $n = ($n << 8) | ord($this->buf[$offset + $i]);
        }
        return $n;
    }
}
