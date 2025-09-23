<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('signatures', function (Blueprint $table) {
            $table->uuid('templateSertifId')->nullable()->after('documentId');
            $table->longText('signatureData')->nullable()->after('signatureHash');
            $table->boolean('isUnique')->default(true)->after('signatureData');

            // Add foreign key for template
            $table->foreign('templateSertifId')->references('id')->on('template_sertif')->onUpdate('cascade')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('signatures', function (Blueprint $table) {
            $table->dropForeign(['templateSertifId']);
            $table->dropColumn(['templateSertifId', 'signatureData', 'isUnique']);
        });
    }
};
