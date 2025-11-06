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
            Log::info('Processing row', ['index' => $index, 'row' => $row]);

            try {
                $nomorSertif = $row['nomor_sertif'] ?? null;
                $userEmail = $row['email'] ?? null;
                $issuedAt = $row['issued_at'] ?? now()->format('Y-m-d');

                if (!$nomorSertif || !$userEmail) {
                    $errors[] = "Baris " . ($index + 1) . ": Nomor sertifikat dan email wajib diisi";
                    continue;
                }

                $user = \App\Models\User::where('email', $userEmail)->first();
                Log::info('Looking for user', ['email' => $userEmail, 'user_found' => $user ? 'YES' : 'NO']);

                if (!$user) {
                    // Auto-create user dari data Excel
                    $namaLengkap = $row['nama_lengkap'] ?? 'User';
                    $user = \App\Models\User::create([
                        'name' => $namaLengkap,
                        'email' => $userEmail,
                        'password' => bcrypt('defaultpassword'), // Default password
                        'role' => 'pengaju',
                        'email_verified_at' => now()
                    ]);
                    Log::info('User auto-created from Excel data', ['user_id' => $user->id, 'email' => $userEmail]);
                }

                Log::info('User found, checking nomor sertif', ['user_id' => $user->id, 'nomor_sertif' => $nomorSertif]);

                if (\App\Models\Sertifikat::where('nomor_sertif', $nomorSertif)->exists()) {
                    $errors[] = "Baris " . ($index + 1) . ": Nomor sertifikat $nomorSertif sudah ada";
                    Log::info('Nomor sertifikat already exists, skipping', ['nomor_sertif' => $nomorSertif]);
                    continue;
                }

                Log::info('Generating PDF first before saving to database', [
                    'nomor_sertif' => $nomorSertif,
                    'template_id' => $template->id,
                    'user_id' => $user->id
                ]);

                // Generate PDF dulu sebelum simpan ke database
                $passphrase = $data['passphrase'] ?? null;
                $certificatePdf = $this->generateIndividualCertificateFromExcel(
                    $signedTemplatePath,
                    $template,
                    $user,
                    $row,
                    $nomorSertif,
                    $passphrase
                );

                Log::info('Certificate PDF generated successfully, now saving to database', ['pdf_path' => $certificatePdf]);

                // Kalau PDF berhasil dibuat, baru simpan ke database
                $sertifikat = Sertifikat::create([
                    'templateSertifId' => $template->id,
                    'nomor_sertif' => $nomorSertif,
                    'file_path' => 'certificates/' . basename($certificatePdf)
                ]);

                Log::info('Sertifikat created, creating recipient', ['sertifikat_id' => $sertifikat->id]);

                CertificateRecipient::create([
                    'sertifikatId' => $sertifikat->id,
                    'userId' => $user->id,
                    'issuedAt' => $issuedAt
                ]);

                Log::info('Certificate generation completed successfully', [
                    'sertifikat_id' => $sertifikat->id,
                    'pdf_path' => $certificatePdf
                ]);

                $generatedCertificates[] = [
                    'sertifikat' => $sertifikat,
                    'pdf_path' => $certificatePdf,
                    'recipient' => $user,
                    'email' => $userEmail
                ];
            } catch (\Exception $e) {
                $errors[] = "Error pada baris " . ($index + 1) . ": " . $e->getMessage();
            }
        }

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

    private function generateIndividualCertificateFromExcel(string $signedTemplatePath, TemplateSertif $template, User $user, array $excelRow, string $nomorSertif, ?string $passphrase = null): string
    {
        Log::info('Starting generateIndividualCertificateFromExcel', [
            'signedTemplatePath' => $signedTemplatePath,
            'template_id' => $template->id,
            'user_id' => $user->id,
            'nomor_sertif' => $nomorSertif,
            'excelRow' => $excelRow,
            'has_passphrase' => $passphrase ? 'YES' : 'NO'
        ]);

        // Copy template PDF yang sudah ditandatangani dan tambahkan data dynamic
        try {
            Log::info('Loading signed template PDF with FPDI - using exact template');

            $pdf = new Fpdi();
            $pageCount = $pdf->setSourceFile($signedTemplatePath);
            Log::info('PDF template loaded', ['pageCount' => $pageCount]);

            // Generate unique filename
            $filename = 'certificate_' . $nomorSertif . '_' . time() . '.pdf';
            $outputPath = storage_path('app/certificates/' . $filename);

            // Copy semua halaman template
            for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
                $templateId = $pdf->importPage($pageNo);
                $size = $pdf->getTemplateSize($templateId);

                $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
                $pdf->useTemplate($templateId);

                // Tambahkan data dynamic dan digital signature unik pada halaman terakhir
                if ($pageNo === $pageCount) {
                    // Tambahkan text overlay untuk mengganti placeholder
                    $this->addTextOverlay($pdf, $template, $user, $excelRow, $nomorSertif, $passphrase, $size);
                }
            }

            $pdf->Output($outputPath, 'F');

            Log::info('Certificate PDF generated successfully', ['outputPath' => $outputPath]);
            return $outputPath;
        } catch (\Exception $e) {
            Log::error('FPDI failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            throw new Exception('Gagal load template PDF yang sudah ditandatangani: ' . $e->getMessage());
        }
    }

    private function addTextOverlay(Fpdi $pdf, TemplateSertif $template, User $user, array $excelRow, string $nomorSertif, ?string $passphrase, array $pageSize): void
    {
        Log::info('Adding text overlay to signed template', [
            'pageSize' => $pageSize
        ]);

        // Prepare data
        $namaPenerima = $excelRow['nama_lengkap'] ?? $user->name;
        $tanggalTerbit = isset($excelRow['issued_at']) ? date('d/m/Y', strtotime($excelRow['issued_at'])) : now()->format('d/m/Y');
        $jabatan = $excelRow['jabatan'] ?? '';
        $departemen = $excelRow['departemen'] ?? '';

        // Set font untuk overlay
        $pdf->SetFont('Arial', 'B', 14);
        $pdf->SetTextColor(0, 0, 0);

        // Print text di posisi center untuk placeholder
        // Asumsi template punya placeholder di tengah halaman
        $centerX = $pageSize['width'] / 2;

        // Find and replace {{NAMA_PENERIMA}} - letakkan di tengah atas
        $pdf->SetXY($centerX - ($pdf->GetStringWidth($namaPenerima) / 2), 100);
        $pdf->Cell($pdf->GetStringWidth($namaPenerima) + 10, 8, $namaPenerima, 0, 0, 'C');

        // Add other data if needed
        if ($jabatan) {
            $pdf->SetFont('Arial', '', 12);
            $pdf->SetXY($centerX - ($pdf->GetStringWidth('Jabatan: ' . $jabatan) / 2), 120);
            $pdf->Cell($pdf->GetStringWidth('Jabatan: ' . $jabatan) + 10, 8, 'Jabatan: ' . $jabatan, 0, 0, 'C');
        }

        if ($departemen) {
            $pdf->SetFont('Arial', '', 12);
            $pdf->SetXY($centerX - ($pdf->GetStringWidth('Departemen: ' . $departemen) / 2), 135);
            $pdf->Cell($pdf->GetStringWidth('Departemen: ' . $departemen) + 10, 8, 'Departemen: ' . $departemen, 0, 0, 'C');
        }

        // Add nomor sertifikat
        $pdf->SetFont('Arial', '', 10);
        $pdf->SetXY($centerX - ($pdf->GetStringWidth('Nomor: ' . $nomorSertif) / 2), 150);
        $pdf->Cell($pdf->GetStringWidth('Nomor: ' . $nomorSertif) + 10, 8, 'Nomor: ' . $nomorSertif, 0, 0, 'C');

        // Add tanggal terbit
        $pdf->SetXY($centerX - ($pdf->GetStringWidth('Tanggal: ' . $tanggalTerbit) / 2), 160);
        $pdf->Cell($pdf->GetStringWidth('Tanggal: ' . $tanggalTerbit) + 10, 8, 'Tanggal: ' . $tanggalTerbit, 0, 0, 'C');

        // Add QR code dengan digital signature
        $this->addUniqueDigitalSignatureToTemplate($pdf, $template, $nomorSertif, $passphrase, $pageSize);
    }

    private function addDynamicDataToSignedTemplate(Fpdi $pdf, TemplateSertif $template, User $user, array $excelRow, string $nomorSertif, ?string $passphrase, array $pageSize): void
    {
        Log::info('Adding dynamic data and unique QR code to signed template');

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

        // Add unique digital signature QR code at bottom right
        $this->addUniqueDigitalSignatureToTemplate($pdf, $template, $nomorSertif, $passphrase, $pageSize);
    }

    private function addTemplateSignature(Fpdi $pdf, User $signer, array $signatureData, array $pageSize): void
    {
        // Handle signature image from canvas (base64 data)
        if (isset($signatureData['signatureData'])) {
            // Extract and add the signature image directly from canvas
            $this->addSignatureImage($pdf, $signatureData['signatureData'], 0, 0, $pageSize['width'], $pageSize['height']);
        }

        // Add digital signature info as text (optional, since we have QR code)
        $pdf->SetFont('Arial', '', 8);
        $pdf->SetTextColor(100, 100, 100);

        $signatureY = $pageSize['height'] - 15;
        $pdf->SetXY(50, $signatureY);
        $pdf->Cell(100, 5, 'Template ditandatangani digital oleh: ' . $signer->name, 0, 1, 'L');

        $pdf->SetXY(50, $signatureY + 5);
        $pdf->Cell(100, 5, 'Tanggal: ' . now()->format('d/m/Y H:i:s'), 0, 1, 'L');
    }

    private function addDynamicData(Fpdi $pdf, Sertifikat $sertifikat, User $recipient, array $pageSize): void
    {
        $pdf->SetFont('Arial', '', 10);
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

    private function addDynamicDataFromExcel(Fpdi $pdf, TemplateSertif $template, User $user, array $excelRow, array $pageSize): void
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

    private function replacePlaceholdersInPDF(Fpdi $pdf, array $placeholders, array $pageSize): void
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

                // Set font and color
                $pdf->SetFont('Arial', 'B', $pos['size']);
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

    private function addFallbackData(Fpdi $pdf, string $namaPenerima, string $nomorSertif, string $tanggalTerbit, string $jabatan, string $departemen, array $pageSize): void
    {
        // Fallback method - add data at fixed positions
        $pdf->SetFont('Arial', '', 10);
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

    private function addUniqueDigitalSignatureToTemplate(Fpdi $pdf, TemplateSertif $template, string $nomorSertif, ?string $passphrase, array $pageSize): void
    {
        try {
            // Generate unique verification data for this certificate
            $verificationData = [
                'certificate_number' => $nomorSertif,
                'template_id' => $template->id,
                'issued_at' => now()->toISOString(),
                'verification_url' => url('/verify-certificate/' . $nomorSertif),
                'hash' => hash('sha256', $nomorSertif . $template->id . now()->toISOString())
            ];

            // Add digital signature if passphrase provided
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

            $qrData = json_encode($verificationData);

            // Generate QR code
            $qrCode = $this->generateQRCode($qrData);

            // Position QR code (bottom right corner)
            $qrSize = min(50, $pageSize['width'] / 15);
            $qrX = $pageSize['width'] - $qrSize - 20;
            $qrY = $pageSize['height'] - $qrSize - 20;

            // Add QR code to PDF
            $pdf->Image($qrCode, $qrX, $qrY, $qrSize, $qrSize, 'PNG');

            // Add verification text
            $pdf->SetFont('Arial', '', 8);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY($qrX, $qrY + $qrSize + 5);
            $pdf->Cell($qrSize, 4, 'Digital Verification', 0, 1, 'C');

            Log::info('Added unique digital signature QR code', [
                'certificate_number' => $nomorSertif,
                'qr_position' => ['x' => $qrX, 'y' => $qrY, 'size' => $qrSize]
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to add digital signature QR code', [
                'certificate_number' => $nomorSertif,
                'error' => $e->getMessage()
            ]);
        }
    }

    private function addUniqueDigitalSignature(Fpdi $pdf, TemplateSertif $template, string $nomorSertif, array $pageSize): void
    {
        try {
            // Generate unique verification data for this certificate
            $verificationData = [
                'certificate_number' => $nomorSertif,
                'template_id' => $template->id,
                'issued_at' => now()->toISOString(),
                'verification_url' => url('/verify-certificate/' . $nomorSertif),
                'hash' => hash('sha256', $nomorSertif . $template->id . now()->toISOString())
            ];

            $qrData = json_encode($verificationData);

            // Generate QR code
            $qrCode = $this->generateQRCode($qrData);

            // Position QR code (bottom right corner)
            $qrSize = min(50, $pageSize['width'] / 15);
            $qrX = $pageSize['width'] - $qrSize - 20;
            $qrY = $pageSize['height'] - $qrSize - 20;

            // Add QR code to PDF
            $pdf->Image($qrCode, $qrX, $qrY, $qrSize, $qrSize, 'PNG');

            // Add verification text
            $pdf->SetFont('Arial', '', 8);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY($qrX, $qrY + $qrSize + 5);
            $pdf->Cell($qrSize, 4, 'Digital Verification', 0, 1, 'C');

            Log::info('Added unique digital signature QR code', [
                'certificate_number' => $nomorSertif,
                'template_id' => $template->id,
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

    private function addSignatureImage(Fpdi $pdf, string $signatureData, int $x, int $y, int $width, int $height): void
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
        $certificatePath = storage_path('app/certificates/' . $sertifikat->id . '.pdf');

        if (!file_exists($certificatePath)) {
            throw new Exception('File sertifikat tidak ditemukan');
        }

        return $certificatePath;
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
