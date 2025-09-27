<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\Storage;
use App\Models\Document;

echo "=== Storage Debug ===\n";

// Check storage directories
echo "1. Storage directories:\n";
echo "   storage/app/public: " . (is_dir(storage_path('app/public')) ? 'EXISTS' : 'NOT EXISTS') . "\n";
echo "   public/storage: " . (is_dir(public_path('storage')) ? 'EXISTS' : 'NOT EXISTS') . "\n";
echo "   public/storage symlink: " . (is_link(public_path('storage')) ? 'EXISTS (symlink)' : 'NOT EXISTS') . "\n";

// Check documents directory
echo "\n2. Documents directory:\n";
$documentsDir = storage_path('app/public/documents');
echo "   storage/app/public/documents: " . (is_dir($documentsDir) ? 'EXISTS' : 'NOT EXISTS') . "\n";

if (is_dir($documentsDir)) {
    $files = scandir($documentsDir);
    echo "   Files in documents directory:\n";
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..') {
            echo "     - $file\n";
        }
    }
}

// Check signed directory
echo "\n3. Signed directory:\n";
$signedDir = storage_path('app/public/documents/signed');
echo "   storage/app/public/documents/signed: " . (is_dir($signedDir) ? 'EXISTS' : 'NOT EXISTS') . "\n";

if (is_dir($signedDir)) {
    $files = scandir($signedDir);
    echo "   Files in signed directory:\n";
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..') {
            echo "     - $file\n";
        }
    }
}

// Check documents in database
echo "\n4. Documents in database:\n";
$documents = Document::all();
foreach ($documents as $doc) {
    echo "   Document ID: {$doc->id}\n";
    echo "   Title: {$doc->title}\n";
    echo "   Files: {$doc->files}\n";
    echo "   Signed File: " . ($doc->signed_file ?? 'NULL') . "\n";
    
    // Check if file exists
    $filePath = 'documents/' . $doc->files;
    $exists = Storage::disk('public')->exists($filePath);
    echo "   Original file exists: " . ($exists ? 'YES' : 'NO') . "\n";
    
    if ($doc->signed_file) {
        $signedExists = Storage::disk('public')->exists($doc->signed_file);
        echo "   Signed file exists: " . ($signedExists ? 'YES' : 'NO') . "\n";
    }
    
    echo "   ---\n";
}

echo "\n=== End Debug ===\n";
