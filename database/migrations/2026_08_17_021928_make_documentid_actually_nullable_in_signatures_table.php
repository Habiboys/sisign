<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    /**
     * Make documentId nullable so digital-only signature rows created for
     * templates (templateSertifId set, documentId null) can be persisted.
     * The 2025_10_03 migration of the same intent shipped as a no-op, so this
     * repeats the fix under a new migration instead of editing the applied one.
     */
    public function up(): void
    {
        Schema::table('signatures', function (Blueprint $table) {
            $table->uuid('documentId')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('signatures', function (Blueprint $table) {
            $table->uuid('documentId')->nullable(false)->change();
        });
    }
};
