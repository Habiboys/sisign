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
        // SHA-256 hash of the exact byte content of the final signed PDF / certificate
        // file, computed right after it is written to disk. Used by QR-code verification
        // to detect tampering by recomputing the hash of the file currently on server and
        // comparing it against this stored value.
        Schema::table('document', function (Blueprint $table) {
            $table->string('content_hash', 64)->nullable()->after('signed_file');
        });

        Schema::table('template_sertif', function (Blueprint $table) {
            $table->string('content_hash', 64)->nullable()->after('signed_template_path');
        });

        Schema::table('sertifikat', function (Blueprint $table) {
            $table->string('content_hash', 64)->nullable()->after('file_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('document', function (Blueprint $table) {
            $table->dropColumn('content_hash');
        });

        Schema::table('template_sertif', function (Blueprint $table) {
            $table->dropColumn('content_hash');
        });

        Schema::table('sertifikat', function (Blueprint $table) {
            $table->dropColumn('content_hash');
        });
    }
};
