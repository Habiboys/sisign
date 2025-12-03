<?php

namespace App\Services;

use App\Models\Sertifikat;
use App\Models\TemplateSertif;
use App\Models\CertificateRecipient;
use App\Models\User;
use App\Models\EncryptionKey;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use setasign\Fpdi\Fpdi;
use setasign\Fpdi\PdfParser\StreamReader;
use setasign\Fpdi\Tcpdf\Fpdi as FpdiTcpdf;

use Exception;

class CertificateService
{
    protected SignatureService $signatureService;
    protected $encryptionService;

    public function __construct(SignatureService $signatureService)
    {
        $this->signatureService = $signatureService;
        $this->encryptionService = app(\App\Services\EncryptionService::class);
    }

    public function generateBulkCertificates(array $data): array
    {
        $template = TemplateSertif::findOrFail($data['templateSertifId']);
        $recipients = $data['recipients'];
        $signedTemplatePath = $this->getSignedTemplatePath($template);

        if (!$signedTemplatePath) {
            throw new Exception('Template belum ditandatangani. Silakan tandatangani template terlebih dahulu.');
        }

        $generatedCertificates = [];
        $errors = [];

        foreach ($recipients as $index => $recipient) {
            try {
                $sertifikat = Sertifikat::create([
                    'templateSertifId' => $template->id,
                    'nomor_sertif' => $recipient['nomor_sertif']
                ]);

                CertificateRecipient::create([
                    'sertifikatId' => $sertifikat->id,
                    'userId' => $recipient['userId'],
                    'issuedAt' => $recipient['issuedAt'] ?? now()
                ]);

                $certificatePdf = $this->generateIndividualCertificate(
                    $signedTemplatePath,
                    $sertifikat,
                    $recipient
                );

                $generatedCertificates[] = [
                    'sertifikat' => $sertifikat,
                    'pdf_path' => $certificatePdf,
                    'recipient' => $recipient
                ];
            } catch (\Exception $e) {
                $errors[] = "Error pada penerima ke-" . ($index + 1) . ": " . $e->getMessage();
            }
        }

        return [
            'generated' => $generatedCertificates,
            'errors' => $errors,
            'success_count' => count($generatedCertificates),
            'error_count' => count($errors)
        ];
    }

    public function generateBulkCertificatesFromExcel(array $data): array
    {
        Log::info('CertificateService::generateBulkCertificatesFromExcel called', [
            'templateSertifId' => $data['templateSertifId'],
            'excelData_count' => count($data['excelData'] ?? [])
        ]);

        $template = TemplateSertif::findOrFail($data['templateSertifId']);
        $excelData = $data['excelData'];
        $signedTemplatePath = $this->getSignedTemplatePath($template);

        Log::info('Template and signed path found', [
            'template_id' => $template->id,
            'signed_path' => $signedTemplatePath
        ]);

        if (!$signedTemplatePath) {
            throw new Exception('Template belum ditandatangani. Silakan tandatangani template terlebih dahulu.');
        }

        $generatedCertificates = [];
        $errors = [];

        Log::info('Starting to process excel data', ['count' => count($excelData)]);

        foreach ($excelData as $index => $row) {
            Log::info('Processing row', [
                'index' => $index,
                'row' => $row,
                'row_count' => count($row),
                'variable_positions_count' => count($template->variable_positions ?? [])
            ]);

            try {
                // Get nomor sertifikat from Excel row berdasarkan urutan variabel
                // Excel row adalah array dengan urutan sesuai kolom Excel (sesuai urutan variable_positions)
                $variablePositions = $template->variable_positions ?? [];
                $nomorSertif = null;
                $email = null;

                // Cek apakah nomor_sertif dan email ada di variabel atau di akhir (jika ditambahkan otomatis)
                $hasNomorSertifInVariables = false;
                $hasEmailInVariables = false;
                $nomorSertifIndex = null;
                $emailIndex = null;

                if (!empty($variablePositions)) {
                    foreach ($variablePositions as $varIndex => $var) {
                        $varName = strtolower($var['name']);
                        if (in_array($varName, ['nomor_sertif', 'nomor', 'no_sertifikat', 'no', 'nomor_sertifikat'])) {
                            $hasNomorSertifInVariables = true;
                            $nomorSertifIndex = $varIndex;
                        }
                        if (in_array($varName, ['email', 'e_mail', 'alamat_email', 'email_peserta'])) {
                            $hasEmailInVariables = true;
                            $emailIndex = $varIndex;
                        }
                    }
                }

                // Cari nomor sertifikat - dari variabel atau dari kolom akhir jika ditambahkan otomatis
                if ($hasNomorSertifInVariables && $nomorSertifIndex !== null) {
                    // Ambil dari variabel
                    $nomorSertif = $row[$nomorSertifIndex] ?? null;
                } elseif (!$hasNomorSertifInVariables && count($row) > count($variablePositions)) {
                    // Ambil dari kolom akhir (jika ditambahkan otomatis)
                    // Nomor sertifikat di kolom sebelum email (jika email juga ditambahkan otomatis)
                    $autoColumnsCount = 0;
                    if (!$hasEmailInVariables) {
                        $autoColumnsCount = 2; // nomor_sertif + email
                    } else {
                        $autoColumnsCount = 1; // hanya nomor_sertif
                    }
                    $nomorSertifIndex = count($variablePositions) + ($autoColumnsCount - 2);
                    $nomorSertif = $row[$nomorSertifIndex] ?? null;
                }

                // Cari email - dari variabel atau dari kolom akhir jika ditambahkan otomatis
                if ($hasEmailInVariables && $emailIndex !== null) {
                    // Ambil dari variabel
                    $email = $row[$emailIndex] ?? null;
                } elseif (!$hasEmailInVariables && count($row) > count($variablePositions)) {
                    // Ambil dari kolom terakhir (jika ditambahkan otomatis)
                    $emailIndex = count($row) - 1;
                    $email = $row[$emailIndex] ?? null;
                }

                // Validasi: Nomor sertifikat WAJIB
                if (!$nomorSertif || trim($nomorSertif) === '') {
                    $errors[] = "Baris " . ($index + 1) . ": Nomor sertifikat wajib diisi";
                    Log::warning('Nomor sertifikat is required but empty', ['row_index' => $index + 1]);
                    continue;
                }

                // Cek duplikasi nomor sertifikat
                if (\App\Models\Sertifikat::where('nomor_sertif', $nomorSertif)->exists()) {
                    $errors[] = "Baris " . ($index + 1) . ": Nomor sertifikat $nomorSertif sudah ada";
                    Log::info('Nomor sertifikat already exists, skipping', ['nomor_sertif' => $nomorSertif]);
                    continue;
                }

                Log::info('Generating PDF first before saving to database', [
                    'nomor_sertif' => $nomorSertif,
                    'template_id' => $template->id,
                    'excel_row_count' => count($row)
                ]);

                // Generate PDF dulu sebelum simpan ke database
                // Pastikan row Excel sesuai dengan urutan variabel (tidak termasuk nomor_sertif dan email di akhir jika ditambahkan otomatis)
                $excelRowForOverlay = $row;
                $autoColumnsCount = 0;
                if (!$hasNomorSertifInVariables) {
                    $autoColumnsCount++;
                }
                if (!$hasEmailInVariables) {
                    $autoColumnsCount++;
                }

                if ($autoColumnsCount > 0 && count($row) > count($variablePositions)) {
                    // Hapus kolom otomatis (nomor_sertif dan/atau email) dari akhir jika ditambahkan otomatis
                    $excelRowForOverlay = array_slice($row, 0, count($variablePositions));
                }

                // Validasi: Email WAJIB untuk pengiriman sertifikat (cek sebelum create sertifikat)
                if (!$email || trim($email) === '') {
                    $errors[] = "Baris " . ($index + 1) . ": Email wajib diisi untuk pengiriman sertifikat";
                    Log::warning('Email is required but empty', ['row_index' => $index + 1]);
                    continue;
                }

                // Create sertifikat dulu untuk mendapatkan ID (untuk QR code)
                // File path akan di-update setelah PDF dibuat
                $sertifikat = Sertifikat::create([
                    'templateSertifId' => $template->id,
                    'nomor_sertif' => $nomorSertif,
                    'email' => $email,
                    'file_path' => null // Akan di-update setelah PDF dibuat
                ]);

                Log::info('Sertifikat created first (for ID)', [
                    'sertifikat_id' => $sertifikat->id,
                    'nomor_sertif' => $nomorSertif,
                    'email' => $email
                ]);

                $passphrase = $data['passphrase'] ?? null;
                $certificatePdf = $this->generateIndividualCertificateFromExcel(
                    $signedTemplatePath,
                    $template,
                    $excelRowForOverlay,
                    $nomorSertif,
                    $passphrase,
                    $sertifikat->id // Pass sertifikat ID untuk QR code
                );

                Log::info('Certificate PDF generated successfully, now updating database', [
                    'pdf_path' => $certificatePdf,
                    'file_exists' => file_exists($certificatePdf),
                    'file_size' => file_exists($certificatePdf) ? filesize($certificatePdf) : 0
                ]);

                // Pastikan file benar-benar ada sebelum update database
                if (!file_exists($certificatePdf)) {
                    // Hapus sertifikat yang sudah dibuat jika PDF gagal
                    $sertifikat->delete();
                    throw new Exception('File PDF tidak berhasil dibuat: ' . $certificatePdf);
                }

                // Update file_path setelah PDF berhasil dibuat
                $relativePath = str_replace(storage_path('app/'), '', $certificatePdf);
                $sertifikat->update(['file_path' => $relativePath]);

                Log::info('Sertifikat saved to database', [
                    'sertifikat_id' => $sertifikat->id,
                    'file_path' => $relativePath,
                    'email' => $email,
                    'file_exists_after_save' => file_exists($certificatePdf)
                ]);

                Log::info('Sertifikat created successfully', [
                    'sertifikat_id' => $sertifikat->id,
                    'email' => $email
                ]);

                Log::info('Certificate generation completed successfully', [
                    'sertifikat_id' => $sertifikat->id,
                    'pdf_path' => $certificatePdf,
                    'email' => $email
                ]);

                $generatedCertificates[] = [
                    'sertifikat' => $sertifikat,
                    'pdf_path' => $certificatePdf,
                    'nomor_sertif' => $nomorSertif,
                    'email' => $email,
                ];
            } catch (\Exception $e) {
                $errorMsg = "Error pada baris " . ($index + 1) . ": " . $e->getMessage();
                $errors[] = $errorMsg;
                Log::error('Error processing Excel row', [
                    'row_index' => $index + 1,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
            }
        }

        Log::info('Bulk certificate generation completed', [
            'total_processed' => count($excelData),
            'success_count' => count($generatedCertificates),
            'error_count' => count($errors),
            'generated_certificates' => array_map(function ($cert) {
                return [
                    'id' => $cert['sertifikat']->id ?? 'N/A',
                    'nomor_sertif' => $cert['nomor_sertif'] ?? 'N/A',
                    'file_path' => $cert['sertifikat']->file_path ?? 'N/A'
                ];
            }, $generatedCertificates)
        ]);

        return [
            'generated' => $generatedCertificates,
            'errors' => $errors,
            'success_count' => count($generatedCertificates),
            'error_count' => count($errors)
        ];
    }

    public function signTemplate(TemplateSertif $template, User $signer, array $signatureData): string
    {
        $templatePath = storage_path('app/public/templates/' . $template->files);

        if (!file_exists($templatePath)) {
            throw new Exception('File template tidak ditemukan');
        }

        $signedPath = storage_path('app/signed_templates/' . $template->id . '.pdf');

        // Create directory if it doesn't exist
        $signedDir = dirname($signedPath);
        if (!is_dir($signedDir)) {
            mkdir($signedDir, 0755, true);
        }

        $pdf = new Fpdi();
        $pageCount = $pdf->setSourceFile($templatePath);

        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);

            $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
            $pdf->useTemplate($templateId);

            if ($pageNo === $pageCount) {
                $this->addTemplateSignature($pdf, $signer, $signatureData, $size);
            }
        }

        $pdf->Output($signedPath, 'F');

        $template->update(['signed_template_path' => $signedPath]);

        return $signedPath;
    }

    private function generateIndividualCertificate(string $signedTemplatePath, Sertifikat $sertifikat, array $recipientData): string
    {
        $recipient = User::findOrFail($recipientData['userId']);

        $pdf = new Fpdi();
        $pageCount = $pdf->setSourceFile($signedTemplatePath);

        $outputPath = storage_path('app/certificates/' . $sertifikat->id . '.pdf');

        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);

            $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
            $pdf->useTemplate($templateId);

            $this->addDynamicData($pdf, $sertifikat, $recipient, $size);
        }

        $pdf->Output($outputPath, 'F');

        return $outputPath;
    }

    private function generateIndividualCertificateFromExcel(string $signedTemplatePath, TemplateSertif $template, array $excelRow, ?string $nomorSertif, ?string $passphrase = null, ?string $sertifikatId = null): string
    {
        Log::info('Starting generateIndividualCertificateFromExcel', [
            'signedTemplatePath' => $signedTemplatePath,
            'template_id' => $template->id,
            'nomor_sertif' => $nomorSertif,
            'excelRow' => $excelRow,
            'has_passphrase' => $passphrase ? 'YES' : 'NO'
        ]);

        // Copy template PDF yang sudah ditandatangani dan tambahkan data dynamic
        // Gunakan FPDI-TCPDF untuk bulk generation karena bisa handle Object Streams
        // (Berbeda dengan signature yang pakai FPDI biasa)
        try {
            Log::info('Loading signed template PDF with FPDI-TCPDF for bulk generation (supports Object Streams)');

            // Gunakan FPDI-TCPDF yang bisa handle Object Streams
            $pdf = new FpdiTcpdf();
            $pdf->setPrintHeader(false);
            $pdf->setPrintFooter(false);
            // Nonaktifkan auto page break untuk mencegah text membuat halaman baru
            $pdf->SetAutoPageBreak(false);

            $pageCount = $pdf->setSourceFile($signedTemplatePath);
            Log::info('PDF template loaded with FPDI-TCPDF', ['pageCount' => $pageCount]);

            // Generate unique filename (gunakan nomor sertifikat jika ada, atau timestamp)
            $filename = 'certificate_' . ($nomorSertif ?? 'auto_' . time()) . '_' . time() . '.pdf';
            $outputPath = storage_path('app/certificates/' . $filename);

            // Pastikan directory exists
            $certDir = dirname($outputPath);
            if (!is_dir($certDir)) {
                mkdir($certDir, 0755, true);
            }

            // Copy semua halaman template
            for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
                $templateId = $pdf->importPage($pageNo);
                $size = $pdf->getTemplateSize($templateId);

                $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
                $pdf->useTemplate($templateId);

                // Tambahkan data dynamic dan QR code unik pada halaman terakhir
                if ($pageNo === $pageCount) {
                    // Tambahkan text overlay menggunakan variable positions
                    $this->addTextOverlayWithVariables($pdf, $template, $excelRow, $nomorSertif, $passphrase, $size, $sertifikatId);
                }
            }

            $pdf->Output($outputPath, 'F');

            Log::info('Certificate PDF generated successfully', [
                'outputPath' => $outputPath,
                'file_exists' => file_exists($outputPath),
                'file_size' => file_exists($outputPath) ? filesize($outputPath) : 0
            ]);

            if (!file_exists($outputPath)) {
                throw new Exception('File PDF tidak berhasil dibuat: ' . $outputPath);
            }

            return $outputPath;
        } catch (\Exception $e) {
            Log::error('FPDI-TCPDF failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'signedTemplatePath' => $signedTemplatePath,
                'file_exists' => file_exists($signedTemplatePath)
            ]);

            // Jika error karena kompresi, coba convert dengan Ghostscript dulu
            if (strpos($e->getMessage(), 'compression') !== false || strpos($e->getMessage(), 'Object Streams') !== false) {
                Log::info('PDF uses Object Streams, attempting to convert with Ghostscript', [
                    'path' => $signedTemplatePath
                ]);

                $convertedPath = $this->convertPDFWithGhostscript($signedTemplatePath);
                if ($convertedPath && file_exists($convertedPath)) {
                    // Retry dengan PDF yang sudah di-convert
                    try {
                        $pdf = new FpdiTcpdf();
                        $pdf->setPrintHeader(false);
                        $pdf->setPrintFooter(false);
                        // Nonaktifkan auto page break untuk mencegah text membuat halaman baru
                        $pdf->SetAutoPageBreak(false);

                        $pageCount = $pdf->setSourceFile($convertedPath);
                        Log::info('PDF converted and loaded successfully', ['pageCount' => $pageCount]);

                        // Generate unique filename
                        $filename = 'certificate_' . ($nomorSertif ?? 'auto_' . time()) . '_' . time() . '.pdf';
                        $outputPath = storage_path('app/certificates/' . $filename);

                        $certDir = dirname($outputPath);
                        if (!is_dir($certDir)) {
                            mkdir($certDir, 0755, true);
                        }

                        // Copy semua halaman template
                        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
                            $templateId = $pdf->importPage($pageNo);
                            $size = $pdf->getTemplateSize($templateId);

                            $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
                            $pdf->useTemplate($templateId);

                            if ($pageNo === $pageCount) {
                                $this->addTextOverlayWithVariables($pdf, $template, $excelRow, $nomorSertif, $passphrase, $size, $sertifikatId);
                            }
                        }

                        $pdf->Output($outputPath, 'F');

                        // Clean up converted file
                        if (file_exists($convertedPath) && $convertedPath !== $signedTemplatePath) {
                            @unlink($convertedPath);
                        }

                        return $outputPath;
                    } catch (\Exception $retryError) {
                        Log::error('Failed to use converted PDF', ['error' => $retryError->getMessage()]);
                    }
                }

                // Jika convert juga gagal, throw error yang jelas
                $errorMessage = "PDF template menggunakan kompresi Object Streams yang tidak didukung.\n\n";
                $errorMessage .= "SOLUSI:\n";
                $errorMessage .= "1. Install Ghostscript:\n";
                $errorMessage .= "   - Windows: Download dari https://www.ghostscript.com/download/gsdnld.html\n";
                $errorMessage .= "   - Linux: sudo apt-get install ghostscript\n";
                $errorMessage .= "   - Mac: brew install ghostscript\n\n";
                $errorMessage .= "2. Setelah install, restart server dan coba bulk generation lagi.\n\n";
                $errorMessage .= "ATAU convert PDF template secara manual sebelum upload.";

                throw new Exception($errorMessage);
            }

            throw new Exception('Gagal load template PDF yang sudah ditandatangani: ' . $e->getMessage());
        }
    }

    /**
     * Convert PDF dengan Ghostscript (jika tersedia)
     */
    private function convertPDFWithGhostscript(string $pdfPath): ?string
    {
        Log::info('Attempting to convert PDF with Ghostscript', ['path' => $pdfPath]);

        // Cek apakah Ghostscript tersedia
        $gsCommand = $this->findGhostscriptCommand();
        if (!$gsCommand) {
            Log::warning('Ghostscript not found, cannot convert PDF');
            return null;
        }

        // Convert PDF menggunakan Ghostscript
        $convertedPath = storage_path('app/temp/converted_' . uniqid() . '_' . basename($pdfPath));
        $convertedDir = dirname($convertedPath);
        if (!is_dir($convertedDir)) {
            mkdir($convertedDir, 0755, true);
        }

        // Ghostscript command untuk convert PDF ke PDF 1.4 (tanpa object streams)
        $command = escapeshellarg($gsCommand) . ' -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/prepress -dUseObjectStreams=false -dUseFlateCompression=true -dCompressFonts=false -dSubsetFonts=false -sOutputFile=' . escapeshellarg($convertedPath) . ' ' . escapeshellarg($pdfPath) . ' 2>&1';

        exec($command, $output, $returnCode);

        if ($returnCode === 0 && file_exists($convertedPath) && filesize($convertedPath) > 0) {
            Log::info('PDF converted successfully', [
                'original' => $pdfPath,
                'converted' => $convertedPath,
                'original_size' => filesize($pdfPath),
                'converted_size' => filesize($convertedPath)
            ]);
            return $convertedPath;
        } else {
            Log::error('PDF conversion failed', [
                'command' => $command,
                'output' => implode("\n", $output),
                'returnCode' => $returnCode
            ]);
            return null;
        }
    }

    /**
     * Find Ghostscript command
     */
    private function findGhostscriptCommand(): ?string
    {
        $commands = ['gs', 'gswin64c', 'gswin32c'];

        foreach ($commands as $cmd) {
            $output = [];
            $returnCode = 0;
            exec(escapeshellarg($cmd) . ' --version 2>&1', $output, $returnCode);

            if ($returnCode === 0) {
                return $cmd;
            }
        }

        return null;
    }

    private function addTextOverlayWithVariables($pdf, TemplateSertif $template, array $excelRow, string $nomorSertif, ?string $passphrase, array $pageSize, string $sertifikatId): void
    {
        Log::info('Adding text overlay with variable positions', [
            'pageSize' => $pageSize,
            'variable_positions_count' => count($template->variable_positions ?? []),
            'excel_row_count' => count($excelRow)
        ]);

        $variablePositions = $template->variable_positions ?? [];

        if (empty($variablePositions)) {
            Log::warning('No variable positions found, using fallback');
            // Fallback to old method if no variables mapped
            $this->addTextOverlayFallback($pdf, $excelRow, $nomorSertif, $pageSize);
        } else {
            // Use variable positions to overlay text
            // PENTING: $varIndex = urutan variabel di variable_positions = urutan kolom di Excel
            // Excel row[0] = variable_positions[0], row[1] = variable_positions[1], dst
            foreach ($variablePositions as $varIndex => $variable) {
                $varName = strtolower($variable['name']);
                $x = $variable['x'] ?? 0;
                $y = $variable['y'] ?? 0;
                $fontSize = $variable['fontSize'] ?? 12;
                $fontFamily = $variable['fontFamily'] ?? 'Arial';
                $alignment = $variable['alignment'] ?? 'C';

                // Get value from excel row based on variable index
                // IMPORTANT: $varIndex = urutan variabel di variable_positions = urutan kolom di Excel
                $value = $excelRow[$varIndex] ?? '';

                Log::info('Processing variable', [
                    'varIndex' => $varIndex,
                    'varName' => $varName,
                    'excelValue' => $value,
                    'excelRow' => $excelRow
                ]);

                // Handle special variables - override dengan nilai khusus jika diperlukan
                if (in_array($varName, ['nomor_sertif', 'nomor', 'no_sertifikat', 'no', 'nomor_sertifikat'])) {
                    // Gunakan nomor sertifikat yang sudah di-extract sebelumnya (jika ada)
                    $value = $nomorSertif ?? $value;
                } elseif (in_array($varName, ['issued_at', 'tanggal_terbit', 'tanggal', 'tgl_terbit', 'date'])) {
                    // Format tanggal dari Excel
                    if (isset($excelRow[$varIndex]) && $excelRow[$varIndex] && trim($excelRow[$varIndex]) !== '') {
                        try {
                            $value = date('d/m/Y', strtotime($excelRow[$varIndex]));
                        } catch (\Exception $e) {
                            $value = $excelRow[$varIndex]; // Use as is if date parsing fails
                        }
                    } else {
                        $value = now()->format('d/m/Y');
                    }
                } else {
                    // Untuk variabel lain, gunakan nilai langsung dari Excel
                    $value = $excelRow[$varIndex] ?? '';
                }

                if ($value) {
                    // Check if we have percentage-based coordinates (new method)
                    if (isset($variable['x_pct']) && isset($variable['y_pct'])) {
                        // Calculate PDF coordinates based on percentage and actual page size
                        // Origin is Top-Left (standard for FPDF/TCPDF)
                        $pdfX = $variable['x_pct'] * $pageSize['width'];
                        $pdfY = $variable['y_pct'] * $pageSize['height'];
                        
                        Log::info('Using percentage coordinates', [
                            'varName' => $varName,
                            'x_pct' => $variable['x_pct'],
                            'y_pct' => $variable['y_pct'],
                            'pdfX' => $pdfX,
                            'pdfY' => $pdfY,
                            'pageSize' => $pageSize
                        ]);
                    } else {
                        // Fallback to old method (legacy support)
                        // Convert web/canvas coordinates to PDF coordinates
                        // PDF viewer dimensions in the web interface
                        $webViewerWidth = 800;
                        $webViewerHeight = 750;
    
                        // Account for PDF viewer toolbar and padding offset
                        $toolbarOffset = 120;
                        $actualWebHeight = $webViewerHeight - $toolbarOffset;
    
                        // Calculate scaling factors
                        $scaleX = $pageSize['width'] / $webViewerWidth;
                        $scaleY = $pageSize['height'] / $actualWebHeight;
    
                        // Convert web coordinates to PDF coordinates
                        $pdfX = $x * $scaleX;
                        $scaledY = ($y - $toolbarOffset) * $scaleY;
                        
                        // Old logic inverted Y, which might have been the cause of the issue.
                        // We'll keep it for legacy compatibility but it might be incorrect.
                        $pdfY = $pageSize['height'] - $scaledY;
                        
                        Log::info('Using legacy coordinates', [
                            'varName' => $varName,
                            'pdfX' => $pdfX,
                            'pdfY' => $pdfY
                        ]);
                    }

                    // Ensure Y is within bounds
                    $pdfY = max(0, min($pdfY, $pageSize['height'] - 5));

                    // Set font dengan font family yang dipilih (auto-detect TCPDF atau FPDF)
                    $this->setFontForPDF($pdf, $fontFamily, 'B', $fontSize);
                    $pdf->SetTextColor(0, 0, 0);

                    // Calculate position based on alignment
                    $textWidth = $pdf->GetStringWidth($value);
                    $xPos = $pdfX;

                    if ($alignment === 'C') {
                        $xPos = $pdfX - ($textWidth / 2);
                    } elseif ($alignment === 'R') {
                        $xPos = $pdfX - $textWidth;
                    }

                    // Add text - timpa di atas PDF
                    $pdf->SetXY($xPos, $pdfY);
                    $pdf->Cell($textWidth + 10, 8, $value, 0, 0, $alignment);

                    Log::info('Text overlay added', [
                        'varName' => $varName,
                        'value' => $value,
                        'pdfCoords' => ['x' => $xPos, 'y' => $pdfY],
                    ]);
                }
            }
        }

        // Add unique QR code for each certificate (not in template signature)
        $this->addUniqueDigitalSignatureToTemplate($pdf, $template, $nomorSertif, $passphrase, $pageSize);
    }

    private function addTextOverlayFallback($pdf, array $excelRow, string $nomorSertif, array $pageSize): void
    {
        // Fallback method if no variables mapped
        $namaPenerima = $excelRow[1] ?? 'Peserta';
        $tanggalTerbit = isset($excelRow[2]) ? date('d/m/Y', strtotime($excelRow[2])) : now()->format('d/m/Y');

        $centerX = $pageSize['width'] / 2;

        $this->setFontForPDF($pdf, 'Arial', 'B', 14);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetXY($centerX - ($pdf->GetStringWidth($namaPenerima) / 2), 100);
        $pdf->Cell($pdf->GetStringWidth($namaPenerima) + 10, 8, $namaPenerima, 0, 0, 'C');

        $this->setFontForPDF($pdf, 'Arial', '', 10);
        $pdf->SetXY($centerX - ($pdf->GetStringWidth('Nomor: ' . $nomorSertif) / 2), 150);
        $pdf->Cell($pdf->GetStringWidth('Nomor: ' . $nomorSertif) + 10, 8, 'Nomor: ' . $nomorSertif, 0, 0, 'C');

        $pdf->SetXY($centerX - ($pdf->GetStringWidth('Tanggal: ' . $tanggalTerbit) / 2), 160);
        $pdf->Cell($pdf->GetStringWidth('Tanggal: ' . $tanggalTerbit) + 10, 8, 'Tanggal: ' . $tanggalTerbit, 0, 0, 'C');
    }

    private function mapFontFamilyToFPDF(string $fontFamily): string
    {
        // Map font family names to FPDF supported fonts
        $fontMap = [
            'Arial' => 'Arial',
            'Helvetica' => 'Arial',
            'Times' => 'Times',
            'Times-Roman' => 'Times',
            'Courier' => 'Courier',
        ];

        return $fontMap[$fontFamily] ?? 'Arial';
    }

    /**
     * Map font family untuk TCPDF (FPDI-TCPDF)
     * TCPDF menggunakan font names yang berbeda dari FPDF
     */
    private function mapFontFamilyToTCPDF(string $fontFamily): string
    {
        // Map font family names to TCPDF supported fonts
        // TCPDF default fonts: helvetica, times, courier (lowercase)
        $fontMap = [
            'Arial' => 'helvetica',
            'Helvetica' => 'helvetica',
            'Times' => 'times',
            'Times-Roman' => 'times',
            'Courier' => 'courier',
        ];

        return $fontMap[$fontFamily] ?? 'helvetica';
    }

    /**
     * Set font dengan auto-detect apakah menggunakan TCPDF atau FPDF
     */
    private function setFontForPDF($pdf, string $fontFamily, string $style, float $size): void
    {
        // Deteksi apakah ini TCPDF (FPDI-TCPDF) atau FPDF (FPDI biasa)
        // TCPDF memiliki method getFontFamily() yang berbeda
        if ($pdf instanceof FpdiTcpdf) {
            // Gunakan font mapping untuk TCPDF
            $tcpdfFont = $this->mapFontFamilyToTCPDF($fontFamily);
            $pdf->SetFont($tcpdfFont, $style, $size);
        } else {
            // Gunakan font mapping untuk FPDF
            $fpdfFont = $this->mapFontFamilyToFPDF($fontFamily);
            $pdf->SetFont($fpdfFont, $style, $size);
        }
    }

    private function addDynamicDataToSignedTemplate($pdf, TemplateSertif $template, User $user, array $excelRow, string $nomorSertif, ?string $passphrase, array $pageSize): void
    {
        Log::info('Adding dynamic data to signed template (NO QR CODE - QR code hanya di sertifikat hasil bulk)');

        // Prepare data
        $namaPenerima = $excelRow['nama_lengkap'] ?? $user->name;
        $tanggalTerbit = isset($excelRow['issued_at']) ? date('d/m/Y', strtotime($excelRow['issued_at'])) : now()->format('d/m/Y');
        $jabatan = $excelRow['jabatan'] ?? '';
        $departemen = $excelRow['departemen'] ?? '';

        // Try to replace placeholders
        $placeholders = [
            ['{{NAMA_PENERIMA}}', $namaPenerima, 0, 0, 12, 'C'],
            ['{{NOMOR_SERTIF}}', $nomorSertif, 0, 0, 10, 'C'],
            ['{{TANGGAL_TERBIT}}', $tanggalTerbit, 0, 0, 10, 'C'],
            ['{{JABATAN}}', $jabatan, 0, 0, 10, 'C'],
            ['{{DEPARTEMEN}}', $departemen, 0, 0, 10, 'C'],
        ];
        $this->replacePlaceholdersInPDF($pdf, $placeholders, $pageSize);

        // TIDAK menambahkan QR code di template - QR code hanya ditambahkan di sertifikat hasil bulk generation
        // QR code akan ditambahkan di method addTextOverlayWithVariables saat generate sertifikat
    }

    private function addTemplateSignature($pdf, User $signer, array $signatureData, array $pageSize): void
    {
        // Handle signature image from canvas (base64 data)
        if (isset($signatureData['signatureData'])) {
            // Extract and add the signature image directly from canvas
            $this->addSignatureImage($pdf, $signatureData['signatureData'], 0, 0, $pageSize['width'], $pageSize['height']);
        }

        // Add digital signature info as text
        // CATATAN: Template TIDAK memiliki QR code - QR code hanya ditambahkan di sertifikat hasil bulk generation
        $this->setFontForPDF($pdf, 'Arial', '', 8);
        $pdf->SetTextColor(100, 100, 100);

        $signatureY = $pageSize['height'] - 15;
        $pdf->SetXY(50, $signatureY);
        $pdf->Cell(100, 5, 'Template ditandatangani digital oleh: ' . $signer->name, 0, 1, 'L');

        $pdf->SetXY(50, $signatureY + 5);
        $pdf->Cell(100, 5, 'Tanggal: ' . now()->format('d/m/Y H:i:s'), 0, 1, 'L');
    }

    private function addDynamicData($pdf, Sertifikat $sertifikat, User $recipient, array $pageSize): void
    {
        $this->setFontForPDF($pdf, 'Arial', '', 10);
        $pdf->SetTextColor(0, 0, 0);

        $data = [
            ['Nama Penerima:', $recipient->name, 50, 100],
            ['Nomor Sertifikat:', $sertifikat->nomor_sertif, 50, 120],
            ['Tanggal Terbit:', $sertifikat->created_at->format('d/m/Y'), 50, 140],
            ['Email:', $recipient->email, 50, 160],
        ];

        foreach ($data as [$label, $value, $x, $y]) {
            $pdf->SetXY($x, $y);
            $pdf->Cell(60, 8, $label, 0, 0, 'L');
            $pdf->SetXY($x + 80, $y);
            $pdf->Cell(100, 8, $value, 0, 1, 'L');
        }
    }

    private function addDynamicDataFromExcel($pdf, TemplateSertif $template, User $user, array $excelRow, array $pageSize): void
    {
        Log::info('Adding dynamic data from Excel', [
            'template_id' => $template->id,
            'user_id' => $user->id,
            'excelRow' => $excelRow
        ]);

        // Prepare data for replacement
        $namaPenerima = $excelRow['nama_lengkap'] ?? $user->name;
        $nomorSertif = $excelRow['nomor_sertif'];
        $tanggalTerbit = isset($excelRow['issued_at']) ?
            date('d/m/Y', strtotime($excelRow['issued_at'])) :
            now()->format('d/m/Y');
        $email = $user->email;
        $jabatan = $excelRow['jabatan'] ?? '';
        $departemen = $excelRow['departemen'] ?? '';

        // Define placeholder positions and replacements (email tidak ditampilkan di sertifikat)
        $placeholders = [
            // Format: [placeholder_text, replacement_text, x, y, font_size, alignment]
            ['{{NAMA_PENERIMA}}', $namaPenerima, 0, 0, 12, 'C'],
            ['{{NOMOR_SERTIF}}', $nomorSertif, 0, 0, 10, 'C'],
            ['{{TANGGAL_TERBIT}}', $tanggalTerbit, 0, 0, 10, 'C'],
            ['{{JABATAN}}', $jabatan, 0, 0, 10, 'C'],
            ['{{DEPARTEMEN}}', $departemen, 0, 0, 10, 'C'],
            // Email tidak ditampilkan di sertifikat, hanya untuk pengiriman
        ];

        // Try to find and replace placeholders in the PDF
        $this->replacePlaceholdersInPDF($pdf, $placeholders, $pageSize);

        // Add unique digital signature QR code for each certificate
        $this->addUniqueDigitalSignature($pdf, $template, $nomorSertif, $pageSize);

        // Fallback: Add data at fixed positions if no placeholders found (tanpa email)
        $this->addFallbackData($pdf, $namaPenerima, $nomorSertif, $tanggalTerbit, $jabatan, $departemen, $pageSize);
    }

    private function replacePlaceholdersInPDF($pdf, array $placeholders, array $pageSize): void
    {
        Log::info('Replacing placeholders in PDF', [
            'pageSize' => $pageSize,
            'placeholders_count' => count($placeholders)
        ]);

        // Define smart positioning based on page size
        $positions = $this->calculateSmartPositions($pageSize);

        foreach ($placeholders as [$placeholder, $replacement, $x, $y, $fontSize, $align]) {
            if (isset($positions[$placeholder])) {
                $pos = $positions[$placeholder];

                // Set font and color (auto-detect TCPDF atau FPDF)
                $this->setFontForPDF($pdf, 'Arial', 'B', $pos['size']);
                $pdf->SetTextColor(0, 0, 0);

                // Calculate position based on alignment
                $textWidth = $pdf->GetStringWidth($replacement);
                $xPos = $pos['x'];

                if ($pos['align'] === 'C') {
                    $xPos = $pos['x'] - ($textWidth / 2);
                } elseif ($pos['align'] === 'R') {
                    $xPos = $pos['x'] - $textWidth;
                }

                // Add text
                $pdf->SetXY($xPos, $pos['y']);
                $pdf->Cell($textWidth + 10, 8, $replacement, 0, 1, $pos['align']);

                Log::info('Added placeholder data', [
                    'placeholder' => $placeholder,
                    'replacement' => $replacement,
                    'position' => $pos,
                    'calculated_x' => $xPos,
                    'text_width' => $textWidth
                ]);
            }
        }
    }

    private function calculateSmartPositions(array $pageSize): array
    {
        $width = $pageSize['width'];
        $height = $pageSize['height'];

        // Calculate positions based on page dimensions
        // Adjust these percentages based on your template design
        return [
            '{{NAMA_PENERIMA}}' => [
                'x' => $width / 2,
                'y' => $height * 0.35,
                'size' => min(16, $width / 40),
                'align' => 'C'
            ],
            '{{NOMOR_SERTIF}}' => [
                'x' => $width / 2,
                'y' => $height * 0.55,
                'size' => min(12, $width / 50),
                'align' => 'C'
            ],
            '{{TANGGAL_TERBIT}}' => [
                'x' => $width / 2,
                'y' => $height * 0.65,
                'size' => min(10, $width / 60),
                'align' => 'C'
            ],
            // Email tidak ditampilkan di sertifikat, hanya untuk pengiriman
            '{{JABATAN}}' => [
                'x' => $width / 2,
                'y' => $height * 0.45,
                'size' => min(11, $width / 55),
                'align' => 'C'
            ],
            '{{DEPARTEMEN}}' => [
                'x' => $width / 2,
                'y' => $height * 0.5,
                'size' => min(10, $width / 60),
                'align' => 'C'
            ],
        ];
    }

    private function addFallbackData($pdf, string $namaPenerima, string $nomorSertif, string $tanggalTerbit, string $jabatan, string $departemen, array $pageSize): void
    {
        // Fallback method - add data at fixed positions
        $this->setFontForPDF($pdf, 'Arial', '', 10);
        $pdf->SetTextColor(0, 0, 0);

        $data = [
            ['Nama Penerima:', $namaPenerima, 50, 100],
            ['Nomor Sertifikat:', $nomorSertif, 50, 120],
            ['Tanggal Terbit:', $tanggalTerbit, 50, 140],
            // Email tidak ditampilkan di sertifikat, hanya untuk pengiriman
        ];

        if ($jabatan) {
            $data[] = ['Jabatan:', $jabatan, 50, 180];
        }
        if ($departemen) {
            $data[] = ['Departemen:', $departemen, 50, 200];
        }

        foreach ($data as [$label, $value, $x, $y]) {
            $pdf->SetXY($x, $y);
            $pdf->Cell(60, 8, $label, 0, 0, 'L');
            $pdf->SetXY($x + 80, $y);
            $pdf->Cell(100, 8, $value, 0, 1, 'L');
        }

        Log::info('Added fallback data', ['data_count' => count($data)]);
    }

    private function addUniqueDigitalSignatureToTemplate($pdf, TemplateSertif $template, ?string $nomorSertif, ?string $passphrase, array $pageSize): void
    {
        try {
            // Generate unique certificate number if not provided
            if (!$nomorSertif || trim($nomorSertif) === '') {
                $nomorSertif = 'CERT-' . $template->id . '-' . time() . '-' . uniqid();
                Log::info('Generated auto certificate number', ['nomor_sertif' => $nomorSertif]);
            }

            // Generate verification URL untuk QR code
            // QR code langsung berisi URL verifikasi, bukan JSON
            $verificationUrl = url('/verify-certificate/' . $nomorSertif);
            $qrData = $verificationUrl;

            // Data verifikasi tetap disimpan untuk keperluan lain (jika diperlukan)
            $verificationData = [
                'certificate_number' => $nomorSertif,
                'template_id' => $template->id,
                'issued_at' => now()->toISOString(),
                'verification_url' => $verificationUrl,
                'hash' => hash('sha256', $nomorSertif . $template->id . now()->toISOString())
            ];

            // Add digital signature if passphrase provided (untuk keperluan lain, bukan QR code)
            if ($passphrase) {
                try {
                    $encryptionKey = EncryptionKey::where('userId', Auth::id())->first();
                    if ($encryptionKey) {
                        $dataToSign = json_encode($verificationData);
                        $digitalSignature = $this->encryptionService->signData($dataToSign, $encryptionKey->privateKey, $passphrase);
                        $verificationData['digital_signature'] = $digitalSignature;
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to create digital signature', ['error' => $e->getMessage()]);
                }
            }

            // Generate QR code
            $qrCode = $this->generateQRCode($qrData);

            // Position QR code (bottom right corner)
            $qrSize = min(50, $pageSize['width'] / 15);
            $qrX = $pageSize['width'] - $qrSize - 20;
            $qrY = $pageSize['height'] - $qrSize - 20;

            // Add QR code to PDF
            $pdf->Image($qrCode, $qrX, $qrY, $qrSize, $qrSize, 'PNG');

            // Add verification text
            $this->setFontForPDF($pdf, 'Arial', '', 8);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY($qrX, $qrY + $qrSize + 5);
            $pdf->Cell($qrSize, 4, 'Digital Verification', 0, 1, 'C');

            Log::info('Added unique digital signature QR code', [
                'certificate_number' => $nomorSertif,
                'qr_data' => $qrData,
                'qr_position' => ['x' => $qrX, 'y' => $qrY, 'size' => $qrSize]
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to add digital signature QR code', [
                'certificate_number' => $nomorSertif,
                'error' => $e->getMessage()
            ]);
        }
    }

    private function addUniqueDigitalSignature($pdf, TemplateSertif $template, string $nomorSertif, array $pageSize): void
    {
        try {
            // Generate verification URL untuk QR code
            // QR code langsung berisi URL verifikasi, bukan JSON
            $verificationUrl = url('/verify-certificate/' . $nomorSertif);
            $qrData = $verificationUrl;

            // Generate QR code
            $qrCode = $this->generateQRCode($qrData);

            // Position QR code (bottom right corner)
            $qrSize = min(50, $pageSize['width'] / 15);
            $qrX = $pageSize['width'] - $qrSize - 20;
            $qrY = $pageSize['height'] - $qrSize - 20;

            // Add QR code to PDF
            $pdf->Image($qrCode, $qrX, $qrY, $qrSize, $qrSize, 'PNG');

            // Add verification text
            $this->setFontForPDF($pdf, 'Arial', '', 8);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY($qrX, $qrY + $qrSize + 5);
            $pdf->Cell($qrSize, 4, 'Digital Verification', 0, 1, 'C');

            Log::info('Added unique digital signature QR code', [
                'certificate_number' => $nomorSertif,
                'template_id' => $template->id,
                'qr_data' => $qrData,
                'qr_position' => ['x' => $qrX, 'y' => $qrY, 'size' => $qrSize]
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to add digital signature QR code', [
                'certificate_number' => $nomorSertif,
                'template_id' => $template->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    private function generateQRCode(string $data): string
    {
        try {
            // Generate QR code using endroid/qr-code v6 API
            $builder = new \Endroid\QrCode\Builder\Builder(
                writer: new \Endroid\QrCode\Writer\PngWriter(),
                data: $data,
                size: 300,
                margin: 10
            );

            $result = $builder->build();

            // Save QR code to temporary file
            $tempPath = storage_path('app/temp_qr_' . uniqid() . '.png');
            file_put_contents($tempPath, $result->getString());

            Log::info('QR code generated successfully', [
                'temp_path' => $tempPath,
                'data_length' => strlen($data)
            ]);

            return $tempPath;
        } catch (\Exception $e) {
            Log::error('Failed to generate QR code', [
                'data' => $data,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            // Return empty string if QR generation fails
            return '';
        }
    }

    private function addSignatureImage($pdf, string $signatureData, int $x, int $y, int $width, int $height): void
    {
        try {
            $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $signatureData);
            $imageData = base64_decode($base64Data);

            if ($imageData === false) {
                return;
            }

            $tempPath = storage_path('app/temp_signature_' . uniqid() . '.png');
            file_put_contents($tempPath, $imageData);

            if (file_exists($tempPath)) {
                $pdf->Image($tempPath, $x, $y, $width, $height, 'PNG');
                unlink($tempPath);
            }
        } catch (\Exception $e) {
            // Ignore signature image errors
        }
    }

    private function getSignedTemplatePath(TemplateSertif $template): ?string
    {
        Log::info('Checking signed template path', [
            'template_id' => $template->id,
            'signed_template_path' => $template->signed_template_path,
        ]);

        if ($template->signed_template_path) {
            // Try dengan storage_path untuk path relatif dari database
            $fullPath = storage_path('app/public/' . $template->signed_template_path);
            if (file_exists($fullPath)) {
                Log::info('Using signed_template_path from database with storage_path', ['path' => $fullPath]);
                return $fullPath;
            }

            // Try path absolut
            if (file_exists($template->signed_template_path)) {
                Log::info('Using absolute signed_template_path from database');
                return $template->signed_template_path;
            }
        }

        $defaultPath = storage_path('app/signed_templates/' . $template->id . '.pdf');
        $defaultExists = file_exists($defaultPath);

        Log::info('Checking default path', [
            'default_path' => $defaultPath,
            'default_exists' => $defaultExists
        ]);

        return $defaultExists ? $defaultPath : null;
    }

    public function isTemplateSigned(TemplateSertif $template): bool
    {
        return $this->getSignedTemplatePath($template) !== null;
    }

    public function downloadCertificate(Sertifikat $sertifikat): string
    {
        // Gunakan file_path dari database jika ada
        if ($sertifikat->file_path) {
            $certificatePath = storage_path('app/' . $sertifikat->file_path);
            if (file_exists($certificatePath)) {
                return $certificatePath;
            }
        }

        // Fallback ke path lama (untuk backward compatibility)
        $certificatePath = storage_path('app/certificates/' . $sertifikat->id . '.pdf');
        if (file_exists($certificatePath)) {
            return $certificatePath;
        }

        throw new Exception('File sertifikat tidak ditemukan. Path: ' . ($sertifikat->file_path ?? 'N/A'));
    }

    public function downloadBulkCertificates(array $sertifikatIds): string
    {
        $zipPath = storage_path('app/certificates_bulk_' . time() . '.zip');
        $zip = new \ZipArchive();

        if ($zip->open($zipPath, \ZipArchive::CREATE) !== TRUE) {
            throw new Exception('Tidak dapat membuat file ZIP');
        }

        foreach ($sertifikatIds as $sertifikatId) {
            $sertifikat = Sertifikat::findOrFail($sertifikatId);
            $certificatePath = $this->downloadCertificate($sertifikat);

            $filename = 'Sertifikat_' . $sertifikat->nomor_sertif . '.pdf';
            $zip->addFile($certificatePath, $filename);
        }

        $zip->close();

        return $zipPath;
    }
}
