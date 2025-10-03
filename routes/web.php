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
Route::get('verify-template/{template}', [App\Http\Controllers\TemplateSertifController::class, 'verifyTemplate'])->name('templates.verify');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [App\Http\Controllers\DashboardController::class, 'index'])->name('dashboard');

    // Documents
    Route::resource('documents', App\Http\Controllers\DocumentController::class);
    Route::post('documents/{document}/review', [App\Http\Controllers\DocumentController::class, 'review'])->name('documents.review');

    // Templates
    Route::resource('templates', App\Http\Controllers\TemplateSertifController::class);
    Route::get('templates/{template}/sign', [App\Http\Controllers\TemplateSertifController::class, 'sign'])->name('templates.sign');
    Route::get('templates/{template}/preview', [App\Http\Controllers\TemplateSertifController::class, 'preview'])->name('templates.preview');
    Route::get('templates/{template}/download-signed', [App\Http\Controllers\TemplateSertifController::class, 'downloadSigned'])->name('templates.download-signed');
    Route::delete('templates/{template}/remove-signature', [App\Http\Controllers\TemplateSertifController::class, 'removeSignature'])->name('templates.remove-signature');
    Route::post('templates/{template}/review', [App\Http\Controllers\TemplateSertifController::class, 'review'])->name('templates.review');

    // Template Guide
    Route::get('template-guide', [App\Http\Controllers\TemplateGuideController::class, 'index'])->name('template-guide.index');
    Route::get('template-guide/download-example', [App\Http\Controllers\TemplateGuideController::class, 'downloadExampleTemplate'])->name('template-guide.download-example');

    // Certificates
    Route::resource('certificates', App\Http\Controllers\SertifikatController::class);
    Route::get('certificates/bulk/create', [App\Http\Controllers\SertifikatController::class, 'bulkCreate'])->name('certificates.bulk.create');
    Route::post('certificates/bulk', [App\Http\Controllers\SertifikatController::class, 'bulkStore'])->name('certificates.bulk.store');

    // Certificate template signing
    Route::post('templates/{template}/sign', [App\Http\Controllers\SertifikatController::class, 'signTemplate'])->name('templates.sign');
    Route::get('templates/{template}/check-signed', [App\Http\Controllers\SertifikatController::class, 'checkTemplateSigned'])->name('templates.check-signed');

    // Certificate generation and download
    Route::post('certificates/generate-bulk', [App\Http\Controllers\SertifikatController::class, 'generateBulkCertificates'])->name('certificates.generate-bulk');
    Route::post('certificates/generate-from-excel', [App\Http\Controllers\SertifikatController::class, 'generateBulkFromExcel'])->name('certificates.generate-from-excel');
    Route::get('certificates/{certificate}/download', [App\Http\Controllers\SertifikatController::class, 'downloadCertificate'])->name('certificates.download');
    Route::post('certificates/download-bulk', [App\Http\Controllers\SertifikatController::class, 'downloadBulkCertificates'])->name('certificates.download-bulk');

    // Excel template and email
    Route::get('templates/{template}/download-excel-template', [App\Http\Controllers\SertifikatController::class, 'downloadExcelTemplate'])->name('templates.download-excel-template');
    Route::post('certificates/send-emails', [App\Http\Controllers\SertifikatController::class, 'sendCertificateEmails'])->name('certificates.send-emails');

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
