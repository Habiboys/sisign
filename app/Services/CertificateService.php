<?php

namespace App\Services;

use App\Models\Sertifikat;
use App\Models\TemplateSertif;
use App\Models\CertificateRecipient;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use setasign\Fpdi\Fpdi;
use Exception;

class CertificateService
{
    protected SignatureService $signatureService;

    public function __construct(SignatureService $signatureService)
    {
        $this->signatureService = $signatureService;
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
        $template = TemplateSertif::findOrFail($data['templateSertifId']);
        $excelData = $data['excelData'];
        $signedTemplatePath = $this->getSignedTemplatePath($template);

        if (!$signedTemplatePath) {
            throw new Exception('Template belum ditandatangani. Silakan tandatangani template terlebih dahulu.');
        }

        $generatedCertificates = [];
        $errors = [];

        foreach ($excelData as $index => $row) {
            try {
                $nomorSertif = $row['nomor_sertif'] ?? null;
                $userEmail = $row['email'] ?? null;
                $issuedAt = $row['issued_at'] ?? now()->format('Y-m-d');

                if (!$nomorSertif || !$userEmail) {
                    $errors[] = "Baris " . ($index + 1) . ": Nomor sertifikat dan email wajib diisi";
                    continue;
                }

                $user = \App\Models\User::where('email', $userEmail)->first();
                if (!$user) {
                    $errors[] = "Baris " . ($index + 1) . ": User dengan email $userEmail tidak ditemukan";
                    continue;
                }

                if (\App\Models\Sertifikat::where('nomor_sertif', $nomorSertif)->exists()) {
                    $errors[] = "Baris " . ($index + 1) . ": Nomor sertifikat $nomorSertif sudah ada";
                    continue;
                }

                $sertifikat = Sertifikat::create([
                    'templateSertifId' => $template->id,
                    'nomor_sertif' => $nomorSertif
                ]);

                CertificateRecipient::create([
                    'sertifikatId' => $sertifikat->id,
                    'userId' => $user->id,
                    'issuedAt' => $issuedAt
                ]);

                $certificatePdf = $this->generateIndividualCertificateFromExcel(
                    $signedTemplatePath,
                    $sertifikat,
                    $user,
                    $row
                );

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

        $signedPath = $this->getSignedTemplatePath($template);

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

    private function generateIndividualCertificateFromExcel(string $signedTemplatePath, Sertifikat $sertifikat, User $user, array $excelRow): string
    {
        $pdf = new Fpdi();
        $pageCount = $pdf->setSourceFile($signedTemplatePath);

        $outputPath = storage_path('app/certificates/' . $sertifikat->id . '.pdf');

        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);

            $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
            $pdf->useTemplate($templateId);

            $this->addDynamicDataFromExcel($pdf, $sertifikat, $user, $excelRow, $size);
        }

        $pdf->Output($outputPath, 'F');

        return $outputPath;
    }

    private function addTemplateSignature(Fpdi $pdf, User $signer, array $signatureData, array $pageSize): void
    {
        $pdf->SetFont('Arial', 'B', 12);
        $pdf->SetTextColor(0, 0, 0);

        $signatureY = $pageSize['height'] - 80;

        $pdf->SetXY(50, $signatureY);
        $pdf->Cell(100, 10, 'Ditandatangani secara digital oleh:', 0, 1, 'L');

        $pdf->SetXY(50, $signatureY + 20);
        $pdf->Cell(100, 10, $signer->name, 0, 1, 'L');

        $pdf->SetXY(50, $signatureY + 30);
        $pdf->Cell(100, 10, 'Tanggal: ' . now()->format('d/m/Y H:i:s'), 0, 1, 'L');

        if (isset($signatureData['signatureImage'])) {
            $this->addSignatureImage($pdf, $signatureData['signatureImage'], 50, $signatureY + 40, 80, 30);
        }
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

    private function addDynamicDataFromExcel(Fpdi $pdf, Sertifikat $sertifikat, User $user, array $excelRow, array $pageSize): void
    {
        $pdf->SetFont('Arial', '', 10);
        $pdf->SetTextColor(0, 0, 0);

        $data = [
            ['Nama Penerima:', $user->name, 50, 100],
            ['Nomor Sertifikat:', $sertifikat->nomor_sertif, 50, 120],
            ['Tanggal Terbit:', $sertifikat->created_at->format('d/m/Y'), 50, 140],
            ['Email:', $user->email, 50, 160],
        ];

        // Add additional data from Excel if available
        if (isset($excelRow['nama_lengkap'])) {
            $data[0][1] = $excelRow['nama_lengkap'];
        }
        if (isset($excelRow['tanggal_terbit'])) {
            $data[2][1] = date('d/m/Y', strtotime($excelRow['tanggal_terbit']));
        }
        if (isset($excelRow['jabatan'])) {
            $data[] = ['Jabatan:', $excelRow['jabatan'], 50, 180];
        }
        if (isset($excelRow['departemen'])) {
            $data[] = ['Departemen:', $excelRow['departemen'], 50, 200];
        }

        foreach ($data as [$label, $value, $x, $y]) {
            $pdf->SetXY($x, $y);
            $pdf->Cell(60, 8, $label, 0, 0, 'L');
            $pdf->SetXY($x + 80, $y);
            $pdf->Cell(100, 8, $value, 0, 1, 'L');
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
        if ($template->signed_template_path && file_exists($template->signed_template_path)) {
            return $template->signed_template_path;
        }

        $defaultPath = storage_path('app/signed_templates/' . $template->id . '.pdf');
        return file_exists($defaultPath) ? $defaultPath : null;
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
