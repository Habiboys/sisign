<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }
    return redirect()->route('login');
})->name('home');

// Public verification route
Route::get('verify-document/{document}', [App\Http\Controllers\SignatureController::class, 'verifyDocument'])->name('documents.verify');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [App\Http\Controllers\DashboardController::class, 'index'])->name('dashboard');

    // Documents
    Route::resource('documents', App\Http\Controllers\DocumentController::class);
    Route::post('documents/{document}/review', [App\Http\Controllers\DocumentController::class, 'review'])->name('documents.review');

    // Templates
    Route::resource('templates', App\Http\Controllers\TemplateSertifController::class);
    Route::post('templates/{template}/review', [App\Http\Controllers\TemplateSertifController::class, 'review'])->name('templates.review');

    // Certificates
    Route::resource('certificates', App\Http\Controllers\SertifikatController::class);
    Route::get('certificates/bulk/create', [App\Http\Controllers\SertifikatController::class, 'bulkCreate'])->name('certificates.bulk.create');
    Route::post('certificates/bulk', [App\Http\Controllers\SertifikatController::class, 'bulkStore'])->name('certificates.bulk.store');

    // Signatures
    Route::resource('signatures', App\Http\Controllers\SignatureController::class);
    Route::get('signatures/create', [App\Http\Controllers\SignatureController::class, 'create'])->name('signatures.create');

    // Signature routes for documents
    Route::get('documents/{document}/sign', [App\Http\Controllers\SignatureController::class, 'show'])->name('documents.sign');
    Route::post('documents/{document}/sign/physical', [App\Http\Controllers\SignatureController::class, 'storePhysical'])->name('signatures.physical');
    Route::post('documents/{document}/sign/digital', [App\Http\Controllers\SignatureController::class, 'storeDigital'])->name('signatures.digital');
    Route::post('documents/{document}/sign/combined', [App\Http\Controllers\SignatureController::class, 'storeCombined'])->name('signatures.combined');
    Route::get('documents/{document}/signed-pdf', [App\Http\Controllers\SignatureController::class, 'generateSignedPDF'])->name('documents.signed-pdf');
    Route::post('signatures/{signature}/verify', [App\Http\Controllers\SignatureController::class, 'verifyDigital'])->name('signatures.verify');
    Route::patch('signatures/{signature}/position', [App\Http\Controllers\SignatureController::class, 'updatePosition'])->name('signatures.position');

    // File access routes
    Route::get('documents/{document}/pdf', [App\Http\Controllers\DocumentController::class, 'viewPDF'])->name('documents.pdf');
    Route::get('documents/{document}/signed-pdf', [App\Http\Controllers\DocumentController::class, 'viewSignedPDF'])->name('documents.signed-pdf');
    Route::get('documents/{document}/signed-pdf/preview', [App\Http\Controllers\SignatureController::class, 'previewSignedPDF'])->name('documents.signed-pdf.preview');

    // Encryption Keys Management
    Route::prefix('encryption')->name('encryption.')->group(function () {
        Route::get('/', [App\Http\Controllers\EncryptionController::class, 'index'])->name('index');
        Route::post('generate-keys', [App\Http\Controllers\EncryptionController::class, 'generateKeys'])->name('generate');
        Route::get('export-public-key', [App\Http\Controllers\EncryptionController::class, 'exportPublicKey'])->name('export');
        Route::get('download-public-key', [App\Http\Controllers\EncryptionController::class, 'downloadPublicKey'])->name('download');
        Route::post('test', [App\Http\Controllers\EncryptionController::class, 'testEncryption'])->name('test');
        Route::delete('delete-keys', [App\Http\Controllers\EncryptionController::class, 'deleteKeys'])->name('delete');
    });
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
