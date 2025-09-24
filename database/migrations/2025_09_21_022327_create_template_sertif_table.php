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
        Schema::create('template_sertif', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('files', 255);
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->uuid('reviewId');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('template_sertif');
    }
};
