<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckPDFCompression extends Command
{
    protected $signature = 'pdf:check-compression {path}';
    protected $description = 'Check PDF compression type';

    public function handle()
    {
        $path = $this->argument('path');

        if (!file_exists($path)) {
            $this->error("File tidak ditemukan: {$path}");
            return 1;
        }

        $this->info("Checking PDF: {$path}");
        $this->info("File size: " . number_format(filesize($path)) . " bytes");

        $content = file_get_contents($path);

        // Check compression types
        $compressions = [];

        if (strpos($content, '/Filter/FlateDecode') !== false) {
            $compressions[] = 'FlateDecode (ZIP compression) - SUPPORTED by FPDI';
        }

        if (strpos($content, '/Filter/DCTDecode') !== false) {
            $compressions[] = 'DCTDecode (JPEG compression) - SUPPORTED by FPDI';
        }

        if (strpos($content, '/Filter/CCITTFaxDecode') !== false) {
            $compressions[] = 'CCITTFaxDecode (Fax compression) - SUPPORTED by FPDI';
        }

        if (strpos($content, '/Filter/RunLengthDecode') !== false) {
            $compressions[] = 'RunLengthDecode - SUPPORTED by FPDI';
        }

        // Check for object streams (advanced compression - NOT supported by FPDI free)
        if (preg_match('/\/Type\s*\/ObjStm/', $content)) {
            $compressions[] = 'Object Streams - NOT SUPPORTED by FPDI free (requires paid parser)';
        }

        // Check for cross-reference streams (advanced compression - NOT supported by FPDI free)
        if (preg_match('/\/Type\s*\/XRef/', $content)) {
            $compressions[] = 'Cross-Reference Streams - NOT SUPPORTED by FPDI free (requires paid parser)';
        }

        if (empty($compressions)) {
            $this->info("No compression detected (uncompressed PDF) - SUPPORTED by FPDI");
        } else {
            $this->info("Compression types found:");
            foreach ($compressions as $comp) {
                $this->line("  - {$comp}");
            }
        }

        // Check PDF version
        if (preg_match('/%PDF-(\d\.\d)/', $content, $matches)) {
            $this->info("PDF Version: {$matches[1]}");
        }

        return 0;
    }
}
