<?php

use App\Models\Document;
use App\Services\SignatureService; 
use App\Services\EncryptionService;

// Get latest document
$doc = Document::latest()->first();

if (!$doc) {
    echo "No document found\n";
    exit;
}

echo "Document: {$doc->id}\n";
echo "File: {$doc->files}\n";

// Get signatures count
$sigCount = $doc->signatures()->count();
echo "Signatures: {$sigCount}\n";

try {
    $service = new SignatureService(new EncryptionService());
    $path = $service->applySignaturesToPDF($doc);
    
    echo "PDF generated: {$path}\n";
    echo "Exists: " . (file_exists($path) ? "Yes" : "No") . "\n";
    echo "Size: " . (file_exists($path) ? filesize($path) : 0) . " bytes\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}