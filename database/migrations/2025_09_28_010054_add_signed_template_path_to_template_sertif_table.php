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
        Schema::table('template_sertif', function (Blueprint $table) {
            $table->string('signed_template_path')->nullable()->after('files');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('template_sertif', function (Blueprint $table) {
            $table->dropColumn('signed_template_path');
        });
    }
};
