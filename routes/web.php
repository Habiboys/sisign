<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

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
    Route::post('signatures', [App\Http\Controllers\SignatureController::class, 'store'])->name('signatures.store');
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
