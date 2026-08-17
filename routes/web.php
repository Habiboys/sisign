<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\SertifikatController;
use App\Http\Controllers\SignatureController;
use App\Http\Controllers\TemplateGuideController;
use App\Http\Controllers\TemplateSertifController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    return redirect()->route('login');
})->name('home');

// Public verification route
Route::middleware('throttle:verification')->group(function () {
    Route::get('verify-document/{document}', [SignatureController::class, 'verifyDocument'])->name('documents.verify');
    Route::get('verify-template/{template}', [TemplateSertifController::class, 'verifyTemplate'])->name('templates.verify');
    Route::get('verify-certificate/{certificate}', [SertifikatController::class, 'verifyCertificate'])->name('certificates.verify');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Documents
    Route::resource('documents', DocumentController::class);
    Route::post('documents/{document}/review', [DocumentController::class, 'review'])->name('documents.review');

    // Users
    Route::resource('users', UserController::class);

    // Templates
    Route::resource('templates', TemplateSertifController::class);
    Route::get('templates/{template}/sign', [TemplateSertifController::class, 'sign'])->name('templates.sign');
    Route::get('templates/{template}/preview', [TemplateSertifController::class, 'preview'])->name('templates.preview');
    Route::get('templates/{template}/download-signed', [TemplateSertifController::class, 'downloadSigned'])->name('templates.download-signed');
    Route::delete('templates/{template}/remove-signature', [TemplateSertifController::class, 'removeSignature'])->name('templates.remove-signature');
    Route::post('templates/{template}/review', [TemplateSertifController::class, 'review'])->name('templates.review');
    Route::get('templates/{template}/map-variables', [TemplateSertifController::class, 'mapVariables'])->name('templates.map-variables');
    Route::post('templates/{template}/save-variable-positions', [TemplateSertifController::class, 'saveVariablePositions'])->name('templates.save-variable-positions');

    // Template Guide
    Route::get('template-guide', [TemplateGuideController::class, 'index'])->name('template-guide.index');
    Route::get('template-guide/download-example', [TemplateGuideController::class, 'downloadExampleTemplate'])->name('template-guide.download-example');

    // Certificates
    Route::resource('certificates', SertifikatController::class);
    Route::get('certificates/bulk/create', [SertifikatController::class, 'bulkCreate'])->name('certificates.bulk.create');
    Route::post('certificates/bulk', [SertifikatController::class, 'bulkStore'])->name('certificates.bulk.store');

    // Certificate template signing (POST handled by TemplateSertifController so
    // GET and POST share the same controller/authorization flow)
    Route::post('templates/{template}/sign', [TemplateSertifController::class, 'signTemplate'])->middleware('throttle:pin-attempts')->name('templates.sign-post');
    Route::get('templates/{template}/check-signed', [SertifikatController::class, 'checkTemplateSigned'])->name('templates.check-signed');

    // Certificate generation and download
    Route::post('certificates/generate-bulk', [SertifikatController::class, 'generateBulkCertificates'])->name('certificates.generate-bulk');
    Route::post('certificates/generate-from-excel', [SertifikatController::class, 'generateBulkFromExcel'])->name('certificates.generate-from-excel');
    Route::get('certificates/bulk/progress/{batchId}', [SertifikatController::class, 'bulkProgress'])->name('certificates.bulk.progress');
    Route::get('certificates/batch-status/{batchId}', [SertifikatController::class, 'checkBatchStatus'])->name('certificates.batch.status');
    Route::get('certificates/{certificate}/download', [SertifikatController::class, 'downloadCertificate'])->name('certificates.download');
    Route::get('certificates/{certificate}/view', [SertifikatController::class, 'viewCertificate'])->name('certificates.view');
    Route::post('certificates/download-bulk', [SertifikatController::class, 'downloadBulkCertificates'])->name('certificates.download-bulk');

    // Excel template and email
    Route::get('templates/{template}/download-excel-template', [SertifikatController::class, 'downloadExcelTemplate'])->name('templates.download-excel-template');
    Route::post('certificates/send-emails', [SertifikatController::class, 'sendCertificateEmails'])->name('certificates.sendEmails');
    Route::get('certificates/email/progress/{batchId}', [SertifikatController::class, 'emailProgress'])->name('certificates.emailProgress');
    Route::get('certificates/email-batch-status/{batchId}', [SertifikatController::class, 'checkEmailBatchStatus'])->name('certificates.emailBatchStatus');
    Route::post('certificates/bulk-delete', [SertifikatController::class, 'bulkDelete'])->name('certificates.bulk-delete');

    // Signatures
    Route::resource('signatures', SignatureController::class)->except(['destroy']);
    Route::get('signatures/create', [SignatureController::class, 'create'])->name('signatures.create');

    // Signature routes for documents
    Route::get('documents/{document}/sign', [SignatureController::class, 'show'])->name('documents.sign');
    Route::post('documents/{document}/sign/physical', [SignatureController::class, 'storePhysical'])->name('signatures.physical');
    Route::post('documents/{document}/sign/digital', [SignatureController::class, 'storeDigital'])->middleware('throttle:pin-attempts')->name('signatures.digital');
    Route::post('documents/{document}/sign/combined', [SignatureController::class, 'storeCombined'])->middleware('throttle:pin-attempts')->name('signatures.combined');
    // Removes the current user's physical + digital signature together for this document.
    Route::delete('documents/{document}/signature', [SignatureController::class, 'destroy'])->name('signatures.destroy');
    Route::get('documents/{document}/signed-pdf', [SignatureController::class, 'generateSignedPDF'])->name('documents.signed-pdf');
    Route::post('signatures/{signature}/verify', [SignatureController::class, 'verifyDigital'])->name('signatures.verify');
    Route::patch('signatures/{signature}/position', [SignatureController::class, 'updatePosition'])->name('signatures.position');

    // File access routes
    Route::get('documents/{document}/pdf', [DocumentController::class, 'viewPDF'])->name('documents.pdf');
    Route::get('documents/{document}/signed-pdf/preview', [SignatureController::class, 'previewSignedPDF'])->name('documents.signed-pdf.preview');
    Route::get('templates/{template}/signed-pdf', [TemplateSertifController::class, 'viewSignedPDF'])->name('templates.signed-pdf');

});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
