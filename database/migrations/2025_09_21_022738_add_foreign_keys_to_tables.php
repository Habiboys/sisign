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
        // Foreign keys akan ditambahkan nanti setelah struktur dasar selesai
        // Schema::table('users', function (Blueprint $table) {
        //     $table->foreign('roleId')->references('id')->on('roles')->onUpdate('cascade')->onDelete('set null');
        // });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['roleId']);
        });

        Schema::table('review', function (Blueprint $table) {
            $table->dropForeign(['disetujui']);
        });

        Schema::table('document', function (Blueprint $table) {
            $table->dropForeign(['userId']);
            $table->dropForeign(['to']);
            $table->dropForeign(['reviewId']);
        });

        Schema::table('template_sertif', function (Blueprint $table) {
            $table->dropForeign(['reviewId']);
        });

        Schema::table('sertifikat', function (Blueprint $table) {
            $table->dropForeign(['templateSertifId']);
        });

        Schema::table('certificate_recipients', function (Blueprint $table) {
            $table->dropForeign(['sertifikatId']);
            $table->dropForeign(['userId']);
        });

        Schema::table('signatures', function (Blueprint $table) {
            $table->dropForeign(['documentId']);
            $table->dropForeign(['userId']);
        });

        Schema::table('logs', function (Blueprint $table) {
            $table->dropForeign(['userId']);
        });

        Schema::table('encryption_keys', function (Blueprint $table) {
            $table->dropForeign(['userId']);
        });
    }
};
