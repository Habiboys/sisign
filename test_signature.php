<?php

// Simple test to generate PDF with signature
echo "Testing PDF signature generation...\n";

try {
    // Run via artisan command
    $output = shell_exec('php artisan tinker --execute="
        $doc = App\Models\Document::latest()->first();
        if ($doc) {
            echo \"Document ID: \" . $doc->id . \"\\n\";
            echo \"Original file: \" . $doc->files . \"\\n\";
            
            $signatureService = new App\Services\SignatureService(new App\Services\EncryptionService());
            $pdfPath = $signatureService->applySignaturesToPDF($doc);
            
            echo \"Generated PDF: \" . $pdfPath . \"\\n\";
            echo \"File exists: \" . (file_exists($pdfPath) ? \"Yes\" : \"No\") . \"\\n\";
        } else {
            echo \"No document found\\n\";
        }
    " 2>&1');
    
    echo $output;
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}