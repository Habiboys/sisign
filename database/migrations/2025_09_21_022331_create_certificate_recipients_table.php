<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('certificate_recipients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sertifikatId');
            $table->uuid('userId');
            $table->timestamp('issuedAt')->useCurrent();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('certificate_recipients');
    }
};
