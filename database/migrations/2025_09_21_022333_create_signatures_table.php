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
        Schema::create('signatures', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('documentId');
            $table->uuid('userId');
            $table->enum('type', ['physical', 'digital'])->default('digital');
            $table->timestamp('signedAt')->useCurrent();
            $table->string('signatureFile', 255)->nullable();
            $table->text('signatureHash')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('signatures');
    }
};
