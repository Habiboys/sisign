<?php

use Illuminate\Support\Facades\Schema;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

if (Schema::hasTable('document_signers')) {
    echo "Table document_signers exists.\n";
    
    // Check columns
    $columns = Schema::getColumnListing('document_signers');
    echo "Columns: " . implode(', ', $columns) . "\n";
} else {
    echo "Table document_signers DOES NOT exist.\n";
}
