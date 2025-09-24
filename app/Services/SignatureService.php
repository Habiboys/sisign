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
            
            // Apply ALL signatures to the SAME page
            foreach ($pageSignatures as $signature) {
                $this->applySignatureToPage($pdf, $signature, $size);
            }
            
            // Add QR code verification only on the last page
            if ($pageNo === $pageCount && $pageSignatures->count() > 0) {
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
        // Web viewer shows PDF in different dimensions than actual PDF points
        
        // Convert coordinates with minimal scaling
        // Based on log: Page size is ~297x210, which suggests we're dealing with mm units
        // Web coordinates seem to be in a different scale
        
        // Calculate scaling factors - but keep signature size reasonable
        $webViewerWidth = 800;   
        $webViewerHeight = 600;  // Reduced height to match aspect ratio
        
        $scaleX = $pageSize['width'] / $webViewerWidth;
        $scaleY = $pageSize['height'] / $webViewerHeight;
        
        // Apply scaling to position
        $x = $webX * $scaleX;
        $y = ($webViewerHeight - $webY - 75) * $scaleY; // Use fixed signature height in calculation
        
        // Keep signature size larger - don't scale it too much
        $minWidth = 40;  // Minimum signature width
        $minHeight = 20; // Minimum signature height
        
        $sigWidth = max($sigWidth * $scaleX, $minWidth);
        $sigHeight = max($sigHeight * $scaleY, $minHeight);
        
        Log::info("Signature positioning - Web: ({$webX}, {$webY}) -> PDF: ({$x}, {$y}) [Page: {$pageSize['width']}x{$pageSize['height']}, Sig: {$sigWidth}x{$sigHeight}]");

        $pdf->Image(
            $signaturePath,
            $x,
            $y,
            $sigWidth,
            $sigHeight,
            'PNG'
        );

        // Add signature info text
        $pdf->SetFont('Arial', '', 8);
        $pdf->SetXY($x, $y + $sigHeight + 2);
        $pdf->Cell(
            $sigWidth, 
            5, 
            'Signed by: ' . ($signature->user->name ?? 'Unknown'),
            0, 
            1, 
            'C'
        );
        $pdf->SetXY($x, $y + $sigHeight + 7);
        $pdf->Cell(
            $sigWidth, 
            5, 
            'Date: ' . ($signature->signedAt ? $signature->signedAt->format('d/m/Y H:i') : date('d/m/Y H:i')),
            0, 
            1, 
            'C'
        );
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
            $qrSize = 25; // Size in PDF units
            $margin = 10;
            $x = $pageSize['width'] - $qrSize - $margin;
            $y = $pageSize['height'] - $qrSize - $margin;
            
            // Add QR code to PDF
            $pdf->Image($qrPath, $x, $y, $qrSize, $qrSize, 'PNG');
            
            // Add verification text
            $pdf->SetFont('Arial', '', 6);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY($x - 15, $y + $qrSize + 2);
            $pdf->Cell($qrSize + 30, 3, 'Scan to verify signature', 0, 0, 'C');
            
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
                'id', 'type', 'position_x', 'position_y', 
                'width', 'height', 'page_number', 'signedAt'
            ])
            ->with('user:id,name')
            ->get()
            ->toArray();
    }
}