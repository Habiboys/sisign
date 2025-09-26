<?php

namespace App\Services;

use App\Models\Document;
use App\Models\EncryptionKey;
use App\Models\Signature;
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
        $documentId = $data['documentId'];
        $userId = $data['userId'];
        $signatureData = $data['signatureData']; // base64 canvas data
        $position = $data['position'] ?? [];

        // Decode base64 signature data
        $signatureImage = $this->saveCanvasSignature($signatureData, $userId);

        return Signature::create([
            'documentId' => $documentId,
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
    }

    /**
     * Create a digital signature (cryptographic)
     */
    public function createDigitalSignature(array $data): Signature
    {
        $documentId = $data['documentId'];
        $userId = $data['userId'];
        $position = $data['position'] ?? [];

        // Get user's encryption keys
        $encryptionKey = EncryptionKey::where('userId', $userId)->first();
        if (!$encryptionKey) {
            throw new Exception('User encryption keys not found. Please generate keys first.');
        }

        // Get document to sign
        $document = Document::findOrFail($documentId);

        // Create digital signature hash
        $documentHash = $this->createDocumentHash($document);
        $digitalSignature = $this->encryptionService->signData($documentHash, $encryptionKey->privateKey, $data['passphrase'] ?? null);

        return Signature::create([
            'documentId' => $documentId,
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

            // Apply ONLY physical signatures to the page (digital signatures are for verification only)
            foreach ($pageSignatures as $signature) {
                if ($signature->type === 'physical') {
                    $this->applySignatureToPage($pdf, $signature, $size);
                }
            }

            // Add QR code verification only on the last page if there are signatures
            if ($pageNo === $pageCount && $signatures->count() > 0) {
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
}
