<?php

namespace App\Services;

use App\Models\Document;
use App\Models\EncryptionKey;
use App\Models\Signature;
use App\Models\TemplateSertif;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use setasign\Fpdi\Fpdi;
use Exception;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;

class SignatureService
{
    protected EncryptionService $encryptionService;

    public function __construct(EncryptionService $encryptionService)
    {
        $this->encryptionService = $encryptionService;
    }
    /**
     * Create a physical signature (canvas-based)
     */
    public function createPhysicalSignature(array $data): Signature
    {
        $documentId = $data['documentId'] ?? null;
        $templateSertifId = $data['templateSertifId'] ?? null;
        $userId = $data['userId'];
        $signatureData = $data['signatureData']; // base64 canvas data
        $position = $data['position'] ?? [];

        Log::info('SignatureService: Creating physical signature', [
            'documentId' => $documentId,
            'templateSertifId' => $templateSertifId,
            'userId' => $userId,
            'position' => $position,
            'signatureDataLength' => strlen($signatureData),
        ]);

        // Ensure either documentId or templateSertifId is provided
        if (!$documentId && !$templateSertifId) {
            throw new Exception('Either documentId or templateSertifId must be provided');
        }

        try {
            // Decode base64 signature data
            Log::info('SignatureService: Saving canvas signature');
            $signatureImage = $this->saveCanvasSignature($signatureData, $userId);
            Log::info('SignatureService: Canvas signature saved', ['path' => $signatureImage]);

            Log::info('SignatureService: Creating signature record in database');
            $signature = Signature::create([
                'documentId' => $documentId,
                'templateSertifId' => $templateSertifId,
                'userId' => $userId,
                'type' => 'physical',
                'signatureFile' => $signatureImage,
                'signatureData' => $signatureData,
                'position_x' => $position['x'] ?? null,
                'position_y' => $position['y'] ?? null,
                'width' => $position['width'] ?? 150,
                'height' => $position['height'] ?? 75,
                'page_number' => $position['page'] ?? 1,
                'signedAt' => now(),
            ]);

            Log::info('SignatureService: Physical signature created successfully', ['id' => $signature->id]);

            return $signature;
        } catch (\Exception $e) {
            Log::error('SignatureService: Failed to create physical signature', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Create a digital signature (cryptographic)
     */
    public function createDigitalSignature(array $data): Signature
    {
        $documentId = $data['documentId'] ?? null;
        $templateSertifId = $data['templateSertifId'] ?? null;
        $userId = $data['userId'];
        $position = $data['position'] ?? [];

        // Ensure either documentId or templateSertifId is provided
        if (!$documentId && !$templateSertifId) {
            throw new Exception('Either documentId or templateSertifId must be provided');
        }

        // Get user's encryption keys
        $encryptionKey = EncryptionKey::where('userId', $userId)->first();
        if (!$encryptionKey) {
            throw new Exception('User encryption keys not found. Please generate keys first.');
        }

        // Create document hash
        if ($documentId) {
            $document = Document::findOrFail($documentId);
            $documentHash = $this->createDocumentHash($document);
        } else {
            $template = TemplateSertif::findOrFail($templateSertifId);
            $documentHash = $this->createTemplateHash($template);
        }

        $digitalSignature = $this->encryptionService->signData($documentHash, $encryptionKey->privateKey, $data['passphrase'] ?? null);

        return Signature::create([
            'documentId' => $documentId,
            'templateSertifId' => $templateSertifId,
            'userId' => $userId,
            'type' => 'digital',
            'signatureHash' => $documentHash,
            'digital_signature' => $digitalSignature,
            'signature_timestamp' => now(),
            'certificate_info' => $this->generateCertificateInfo($encryptionKey),
            'position_x' => $position['x'] ?? null,
            'position_y' => $position['y'] ?? null,
            'width' => $position['width'] ?? 200,
            'height' => $position['height'] ?? 100,
            'page_number' => $position['page'] ?? 1,
            'signedAt' => now(),
        ]);
    }

    /**
     * Apply signatures to PDF document
     */
    public function applySignaturesToPDF(Document $document): string
    {
        $originalPath = storage_path('app/public/documents/' . $document->files);
        $signedPath = storage_path('app/signed/' . Str::uuid() . '.pdf');

        // Ensure signed directory exists
        if (!file_exists(dirname($signedPath))) {
            mkdir(dirname($signedPath), 0755, true);
        }

        // Initialize FPDI
        $pdf = new Fpdi();
        $pageCount = $pdf->setSourceFile($originalPath);

        $signatures = $document->signatures()
            ->with('user:id,name')
            ->orderBy('created_at')
            ->get();

        // Process each page ONCE - don't create new pages for each signature
        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);

            // Add page ONCE for this original page
            $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
            $pdf->useTemplate($templateId);

            // Get ALL signatures for this page
            $pageSignatures = $signatures->where('page_number', $pageNo);

            // Apply signatures to the page
            foreach ($pageSignatures as $signature) {
                $this->applySignatureToPage($pdf, $signature, $size);
            }

            // Add QR code verification only on the last page if the document is fully signed
            if ($pageNo === $pageCount && $document->isCompleted()) {
                $this->addVerificationQRCode($pdf, $document, $size);
            }
        }

        $pdf->Output($signedPath, 'F');

        return $signedPath;
    }

    /**
     * Apply individual signature to PDF page
     */
    private function applySignatureToPage(Fpdi $pdf, Signature $signature, array $pageSize): void
    {
        if ($signature->type === 'physical') {
            $this->applyPhysicalSignature($pdf, $signature, $pageSize);
        } else {
            $this->applyDigitalSignature($pdf, $signature, $pageSize);
        }
    }

    /**
     * Apply physical signature to PDF
     */
    private function applyPhysicalSignature(Fpdi $pdf, Signature $signature, array $pageSize): void
    {
        // Check if signature has data
        if (empty($signature->signatureData)) {
            return;
        }

        // Create temporary file from base64 data
        try {
            $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $signature->signatureData);
            $imageData = base64_decode($base64Data);

            if ($imageData === false) {
                return;
            }

            $tempPath = storage_path('app/temp_signature_' . uniqid() . '.png');
            file_put_contents($tempPath, $imageData);

            if (!file_exists($tempPath)) {
                return;
            }

            $signaturePath = $tempPath;
        } catch (\Exception $e) {
            return;
        }

        // Get signature dimensions with defaults
        $sigWidth = $signature->width ?? 150;
        $sigHeight = $signature->height ?? 75;

        // Get stored web coordinates
        $webX = $signature->position_x ?? 100;
        $webY = $signature->position_y ?? 100;

        // Convert web coordinates to PDF coordinates
        // PDF viewer dimensions in the web interface (updated to match actual size)
        $webViewerWidth = 800;
        $webViewerHeight = 750;

        // Account for PDF viewer toolbar and padding offset (approximately 120px total)
        $toolbarOffset = 120;
        $actualWebHeight = $webViewerHeight - $toolbarOffset;

        // Calculate scaling factors
        $scaleX = $pageSize['width'] / $webViewerWidth;
        $scaleY = $pageSize['height'] / $actualWebHeight;

        // Apply scaling to position with toolbar offset
        $x = $webX * $scaleX;
        $y = ($webY - $toolbarOffset) * $scaleY;

        // Scale signature size proportionally
        $sigWidth = $sigWidth * $scaleX;
        $sigHeight = $sigHeight * $scaleY;

        // Ensure minimum size
        $sigWidth = max($sigWidth, 20);
        $sigHeight = max($sigHeight, 10);

        Log::info("Signature positioning - Web: ({$webX}, {$webY}) -> PDF: ({$x}, {$y}) [Page: {$pageSize['width']}x{$pageSize['height']}, Sig: {$sigWidth}x{$sigHeight}, ToolbarOffset: {$toolbarOffset}]");

        $pdf->Image(
            $signaturePath,
            $x,
            $y,
            $sigWidth,
            $sigHeight,
            'PNG'
        );

        // No text below signature - just the signature image

        // Clean up temporary file
        if (file_exists($tempPath)) {
            unlink($tempPath);
        }
    }

    /**
     * Apply digital signature to PDF
     */
    private function applyDigitalSignature(Fpdi $pdf, Signature $signature, array $pageSize): void
    {
        $x = $signature->position_x ?? ($pageSize['width'] - $signature->width - 20);
        $y = $signature->position_y ?? ($pageSize['height'] - $signature->height - 20);

        // Draw signature box
        $pdf->SetDrawColor(0, 0, 0);
        $pdf->SetFillColor(240, 240, 240);
        $pdf->Rect($x, $y, $signature->width, $signature->height, 'FD');

        // Add digital signature info
        $pdf->SetFont('Arial', 'B', 10);
        $pdf->SetXY($x + 5, $y + 5);
        $pdf->Cell($signature->width - 10, 8, 'DIGITALLY SIGNED', 0, 1, 'C');

        $pdf->SetFont('Arial', '', 8);
        $pdf->SetXY($x + 5, $y + 15);
        $pdf->Cell($signature->width - 10, 5, 'By: ' . $signature->user->name, 0, 1, 'L');

        $pdf->SetXY($x + 5, $y + 22);
        $pdf->Cell($signature->width - 10, 5, 'Date: ' . $signature->signedAt->format('d/m/Y H:i:s'), 0, 1, 'L');

        $pdf->SetXY($x + 5, $y + 29);
        $pdf->Cell($signature->width - 10, 5, 'Hash: ' . substr($signature->signatureHash, 0, 20) . '...', 0, 1, 'L');

        // Add verification info
        $pdf->SetFont('Arial', 'I', 7);
        $pdf->SetXY($x + 5, $y + $signature->height - 10);
        $pdf->Cell($signature->width - 10, 5, 'Cryptographically Verified', 0, 1, 'C');
    }

    /**
     * Save canvas signature as image
     */
    private function saveCanvasSignature(string $base64Data, string $userId): string
    {
        // Remove data URL prefix if present
        $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $base64Data);

        $imageData = base64_decode($base64Data);
        $filename = 'signatures/' . $userId . '/' . Str::uuid() . '.png';

        // Ensure directory exists
        $directory = storage_path('app/' . dirname($filename));
        if (!file_exists($directory)) {
            mkdir($directory, 0755, true);
        }

        Storage::put($filename, $imageData);

        return $filename;
    }

    /**
     * Create document hash for digital signature
     */
    private function createDocumentHash(Document $document): string
    {
        $documentPath = storage_path('app/public/documents/' . $document->files);
        $documentContent = file_get_contents($documentPath);

        return hash('sha256', $documentContent . $document->id . now()->timestamp);
    }

    /**
     * Create template hash for digital signature
     */
    private function createTemplateHash(TemplateSertif $template): string
    {
        $templatePath = storage_path('app/public/templates/' . $template->files);
        $templateContent = file_get_contents($templatePath);

        return hash('sha256', $templateContent . $template->id . now()->timestamp);
    }

    /**
     * Add verification QR code to bottom right corner
     */
    private function addVerificationQRCode(Fpdi $pdf, Document $document, array $pageSize): void
    {
        try {
            // Create verification URL
            $baseUrl = config('app.url', 'http://localhost:8000');
            $verificationUrl = $baseUrl . "/verify-document/" . $document->id;

            // Generate QR code
            $qrCode = new QrCode($verificationUrl);

            $writer = new PngWriter();
            $result = $writer->write($qrCode);

            // Save QR code temporarily
            $qrPath = storage_path('app/temp_qr_' . uniqid() . '.png');
            file_put_contents($qrPath, $result->getString());

            Log::info("QR Code generated: {$verificationUrl}, saved to: {$qrPath}");

            // Position QR code at bottom right corner
            $qrSize = 15; // Smaller QR code size
            $margin = 10;
            $x = $pageSize['width'] - $qrSize - $margin;
            $y = $pageSize['height'] - $qrSize - $margin;

            // Add QR code to PDF
            $pdf->Image($qrPath, $x, $y, $qrSize, $qrSize, 'PNG');

            // No text below QR code to prevent page overflow

            Log::info("QR Code added to PDF at position: ({$x}, {$y})");

            // Clean up temporary QR file
            if (file_exists($qrPath)) {
                unlink($qrPath);
            }
        } catch (\Exception $e) {
            Log::error('Failed to add QR code: ' . $e->getMessage() . ' - Stack: ' . $e->getTraceAsString());
        }
    }

    /**
     * Generate certificate info
     */
    private function generateCertificateInfo(EncryptionKey $encryptionKey): string
    {
        return json_encode([
            'issuer' => 'SiSign Digital Certificate Authority',
            'subject' => $encryptionKey->user->name,
            'valid_from' => $encryptionKey->created_at->toISOString(),
            'algorithm' => 'SHA256withRSA',
            'key_size' => '2048 bits'
        ]);
    }

    /**
     * Verify digital signature
     */
    public function verifyDigitalSignature(Signature $signature): bool
    {
        $encryptionKey = EncryptionKey::where('userId', $signature->userId)->first();
        if (!$encryptionKey) {
            return false;
        }

        $publicKeyResource = openssl_pkey_get_public($encryptionKey->publicKey);
        if (!$publicKeyResource) {
            return false;
        }

        $signatureData = base64_decode($signature->digital_signature);

        return openssl_verify(
            $signature->signatureHash,
            $signatureData,
            $publicKeyResource,
            OPENSSL_ALGO_SHA256
        ) === 1;
    }

    /**
     * Get signature positioning data for frontend
     */
    public function getSignaturePositions(Document $document): array
    {
        return $document->signatures()
            ->select([
                'id',
                'type',
                'userId',
                'position_x',
                'position_y',
                'width',
                'height',
                'page_number',
                'signedAt'
            ])
            ->with('user:id,name')
            ->get()
            ->toArray();
    }

    public function saveSignedPDF(Document $document, string $signedPdfBase64): void
    {
        Log::info('saveSignedPDF called', [
            'document_id' => $document->id,
            'data_length' => strlen($signedPdfBase64)
        ]);

        // Decode base64 PDF data
        $pdfData = base64_decode($signedPdfBase64);

        Log::info('PDF decode result:', [
            'original_length' => strlen($signedPdfBase64),
            'decoded_length' => strlen($pdfData),
            'is_valid' => $pdfData !== false
        ]);

        if (!$pdfData) {
            Log::error('Failed to decode base64 PDF data');
            throw new \Exception('Failed to decode base64 PDF data');
        }

        // Generate filename (replace spaces with underscores)
        $originalFilename = str_replace(' ', '_', $document->files);
        $filename = 'signed_' . time() . '_' . $originalFilename;

        // Save to storage
        $path = 'documents/signed/' . $filename;
        $saved = Storage::disk('public')->put($path, $pdfData);

        if (!$saved) {
            Log::error('Failed to save PDF to storage');
            throw new \Exception('Failed to save PDF to storage');
        }

        // Update document with signed file path
        $document->update(['signed_file' => $path]);

        // Verify the saved file
        $savedFileSize = Storage::disk('public')->size($path);
        Log::info('Signed PDF saved successfully', [
            'document_id' => $document->id,
            'path' => $path,
            'original_size' => strlen($pdfData),
            'saved_size' => $savedFileSize,
            'size_match' => strlen($pdfData) === $savedFileSize
        ]);
    }

    public function saveSignedPDFTemplate(TemplateSertif $template, string $signedPdfBase64): void
    {
        Log::info('saveSignedPDFTemplate called', [
            'template_id' => $template->id,
            'data_length' => strlen($signedPdfBase64)
        ]);

        // Decode base64 PDF data
        $pdfData = base64_decode($signedPdfBase64);

        if (!$pdfData) {
            Log::error('Failed to decode base64 PDF data for template');
            throw new \Exception('Failed to decode base64 PDF data for template');
        }

        // Generate filename
        $originalFilename = str_replace(' ', '_', $template->files);
        // Use consistent filename for signed template to support overwriting/appending
        $filename = 'signed_' . $template->id . '_' . $originalFilename;
        $path = 'templates/signed/' . $filename;
        $outputPath = storage_path('app/public/' . $path);

        // Ensure directory exists
        $outputDir = dirname($outputPath);
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        // Save the PDF directly (frontend handles the cumulative signing by loading the previous PDF)
        // We just need to save what the frontend sends us.
        // Note: Frontend now disables Object Streams, so this should be compatible.
        file_put_contents($outputPath, $pdfData);

        // Update template with signed file path
        $template->update(['signed_template_path' => $path]);

        // Check if template is fully signed
        if ($template->fresh()->isCompleted()) {
            Log::info('Template fully signed.', ['template_id' => $template->id]);
            // QR code is NOT added to template, only to generated certificates
        }

        Log::info('Signed template PDF saved successfully', [
            'template_id' => $template->id,
            'path' => $path,
            'size' => filesize($outputPath)
        ]);
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
    /**
     * Add verification QR code to template PDF
     */
    public function addTemplateVerificationQRCode(TemplateSertif $template): void
    {
        if (!$template->signed_template_path) {
            return;
        }

        $filePath = storage_path('app/public/' . $template->signed_template_path);
        if (!file_exists($filePath)) {
            return;
        }

        try {
            // Initialize FPDI
            $pdf = new Fpdi();
            $pageCount = $pdf->setSourceFile($filePath);

            // Copy all pages
            for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
                $templateId = $pdf->importPage($pageNo);
                $size = $pdf->getTemplateSize($templateId);

                $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
                $pdf->useTemplate($templateId);

                // Add QR code on the last page
                if ($pageNo === $pageCount) {
                    // Create verification URL
                    $baseUrl = config('app.url', 'http://localhost:8000');
                    $verificationUrl = $baseUrl . "/verify-template/" . $template->id;

                    // Generate QR code
                    $qrCode = new QrCode($verificationUrl);
                    $writer = new PngWriter();
                    $result = $writer->write($qrCode);

                    // Save QR code temporarily
                    $qrPath = storage_path('app/temp_qr_' . uniqid() . '.png');
                    file_put_contents($qrPath, $result->getString());

                    // Position QR code at bottom right corner
                    $qrSize = 15;
                    $margin = 10;
                    $x = $size['width'] - $qrSize - $margin;
                    $y = $size['height'] - $qrSize - $margin;

                    // Add QR code to PDF
                    $pdf->Image($qrPath, $x, $y, $qrSize, $qrSize, 'PNG');

                    // Clean up temporary QR file
                    if (file_exists($qrPath)) {
                        unlink($qrPath);
                    }
                }
            }

            // Save back to the same path
            $pdf->Output($filePath, 'F');
            
            Log::info('QR code added to template', ['template_id' => $template->id]);

        } catch (\Exception $e) {
            Log::error('Failed to add QR code to template', [
                'template_id' => $template->id,
                'error' => $e->getMessage()
            ]);
            // Don't throw exception, just log error so the signing process completes
        }
    }

    /**
     * Reconstruct signed template PDF from original file + active signatures
     */
    public function reconstructSignedTemplate(TemplateSertif $template): void
    {
        Log::info('Reconstructing signed template', ['template_id' => $template->id]);

        // Get all active signatures for this template
        $signatures = Signature::where('templateSertifId', $template->id)
            ->orderBy('created_at')
            ->get();

        if ($signatures->isEmpty()) {
            Log::info('No signatures left, clearing signed template path');
            // Delete the signed file if exists
            if ($template->signed_template_path) {
                $fullPath = storage_path('app/public/' . $template->signed_template_path);
                if (file_exists($fullPath)) {
                    unlink($fullPath);
                }
            }
            $template->update(['signed_template_path' => null]);
            return;
        }

        // We have signatures, so we need to rebuild the PDF
        // 1. Load original template
        $originalPath = storage_path('app/public/templates/' . $template->files);
        if (!file_exists($originalPath)) {
            throw new Exception('Original template file not found');
        }

        // 2. Create new PDF from original
        // Create temp file for reconstruction
        $tempPath = storage_path('app/temp/reconstruct_' . uniqid() . '.pdf');
        $tempDir = dirname($tempPath);
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $pdf = new Fpdi();
        $pageCount = $pdf->setSourceFile($originalPath);

        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);

            $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
            $pdf->useTemplate($templateId);

            // Apply signatures for this page
            $pageSignatures = $signatures->where('page_number', $pageNo);
            foreach ($pageSignatures as $signature) {
                if ($signature->type === 'physical') {
                    $this->applyPhysicalSignature($pdf, $signature, $size);
                }
            }
        }

        // Save to temp path
        $pdf->Output($tempPath, 'F');

        // 3. Move to final signed path
        // Use consistent filename
        $originalFilename = str_replace(' ', '_', $template->files);
        $filename = 'signed_' . $template->id . '_' . $originalFilename;
        $path = 'templates/signed/' . $filename;
        $outputPath = storage_path('app/public/' . $path);

        // Ensure directory exists
        $outputDir = dirname($outputPath);
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        // Move temp file to output path
        // If file exists, overwrite it
        if (file_exists($outputPath)) {
            unlink($outputPath);
        }
        rename($tempPath, $outputPath);

        // Update template path
        $template->update(['signed_template_path' => $path]);

        // 4. Check if fully signed (again)
        if ($template->fresh()->isCompleted()) {
             // QR code is NOT added to template
        }

        Log::info('Template reconstruction complete', ['path' => $path]);
    }
}
