<?php

namespace Fotolio\Core;

/**
 * Small rule-based validator. Rules: required, email, string, int, bool, array,
 * min:n, max:n, in:a,b,c, slug, url, confirmed, nullable.
 * Throws HttpException(422) with a field=>message map on failure.
 */
final class Validator
{
    private array $errors = [];
    private array $clean = [];

    public function __construct(private array $data)
    {
    }

    public static function make(array $data, array $rules): array
    {
        return (new self($data))->validate($rules);
    }

    public function validate(array $rules): array
    {
        foreach ($rules as $field => $ruleset) {
            $rulesList = is_array($ruleset) ? $ruleset : explode('|', $ruleset);
            $value = $this->data[$field] ?? null;
            $nullable = in_array('nullable', $rulesList, true);

            if (($value === null || $value === '') && $nullable) {
                $this->clean[$field] = $value === '' ? null : $value;
                continue;
            }

            foreach ($rulesList as $rule) {
                if ($rule === 'nullable') {
                    continue;
                }
                [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);
                $this->apply($field, $name, $arg, $value);
            }
            if (!isset($this->errors[$field])) {
                $this->clean[$field] = $value;
            }
        }

        if ($this->errors) {
            throw HttpException::unprocessable('Please check the highlighted fields.', $this->errors);
        }
        return $this->clean;
    }

    private function apply(string $field, string $rule, ?string $arg, mixed $value): void
    {
        $label = ucfirst(str_replace('_', ' ', $field));
        switch ($rule) {
            case 'required':
                if ($value === null || $value === '' || (is_array($value) && count($value) === 0)) {
                    $this->fail($field, "$label is required.");
                }
                break;
            case 'email':
                if ($value !== null && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $this->fail($field, 'Enter a valid email address.');
                }
                break;
            case 'url':
                if ($value !== null && $value !== '' && !filter_var($value, FILTER_VALIDATE_URL)) {
                    $this->fail($field, 'Enter a valid URL.');
                }
                break;
            case 'string':
                if ($value !== null && !is_string($value)) {
                    $this->fail($field, "$label must be text.");
                }
                break;
            case 'int':
                if ($value !== null && filter_var($value, FILTER_VALIDATE_INT) === false) {
                    $this->fail($field, "$label must be a whole number.");
                }
                break;
            case 'bool':
                if ($value !== null && !is_bool($value) && !in_array($value, [0, 1, '0', '1', true, false], true)) {
                    $this->fail($field, "$label must be true or false.");
                }
                break;
            case 'array':
                if ($value !== null && !is_array($value)) {
                    $this->fail($field, "$label must be a list.");
                }
                break;
            case 'min':
                if (is_string($value) && mb_strlen($value) < (int) $arg) {
                    $this->fail($field, "$label must be at least $arg characters.");
                } elseif (is_numeric($value) && $value < (int) $arg) {
                    $this->fail($field, "$label must be at least $arg.");
                }
                break;
            case 'max':
                if (is_string($value) && mb_strlen($value) > (int) $arg) {
                    $this->fail($field, "$label must be at most $arg characters.");
                } elseif (is_numeric($value) && $value > (int) $arg) {
                    $this->fail($field, "$label must be at most $arg.");
                }
                break;
            case 'in':
                $allowed = explode(',', (string) $arg);
                if ($value !== null && !in_array((string) $value, $allowed, true)) {
                    $this->fail($field, "$label is not a valid option.");
                }
                break;
            case 'slug':
                if ($value !== null && !preg_match('/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/', (string) $value)) {
                    $this->fail($field, 'Use 3–40 lowercase letters, numbers and hyphens.');
                }
                break;
            case 'confirmed':
                if (($this->data[$field . '_confirmation'] ?? null) !== $value) {
                    $this->fail($field, "$label confirmation does not match.");
                }
                break;
        }
    }

    private function fail(string $field, string $message): void
    {
        $this->errors[$field] ??= $message;
    }
}
